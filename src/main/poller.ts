import { insertTweet, TweetRow } from './db'
import { log } from './logger'

let pollTimer: ReturnType<typeof setTimeout> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null
let lastCheckTime: Date | null = null
let paused = false
let consecutiveEmptyPolls = 0
let adaptiveSlowdownEnabled = true

const MIN_INTERVAL_MS = 60_000  // hard floor — cannot be bypassed
const FETCH_TIMEOUT_MS = 30_000 // abort hung requests after 30s
const MAX_PAGES = 10            // credit safety cap — stop paginating after 10 pages
const POLL_OVERLAP_MS = 2 * 60_000 // overlap window to tolerate API indexing delays
// Slow interval = 5× the configured interval, capped at 30 min.
// This keeps the slowdown proportional: 1min→5min, 3.5min→17.5min, 5min→25min.
// Short intervals (≤2min) require 4 consecutive empty polls before slowing down;
// longer intervals use 3.
function emptyThreshold(intervalMs: number): number {
  return intervalMs <= 120_000 ? 4 : 3
}

export interface PollConfig {
  accounts: string[]
  intervalMs: number
  apiKey: string
  initialSince?: Date
  onNewTweet: (tweet: TweetRow) => void
  onError: (msg: string) => void
  onPollComplete?: (since: Date) => void
}

let config: PollConfig | null = null

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  const minutePart = minutes > 0 ? `${minutes} minute${minutes === 1 ? '' : 's'}` : ''
  const secondPart = seconds > 0 ? `${seconds} second${seconds === 1 ? '' : 's'}` : ''
  if (minutePart && secondPart) return `${minutePart} ${secondPart}`
  return minutePart || secondPart || '0 seconds'
}

function clearCountdownTimer(): void {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

interface ApiTweet {
  id: string
  url: string
  text: string
  retweetCount: number
  replyCount: number
  likeCount: number
  viewCount: number
  createdAt: string
  isReply: boolean
  retweeted_tweet: object | null
  author: { userName: string; name: string }
}

function apiTweetToRow(t: ApiTweet): TweetRow {
  const ts = Math.floor(new Date(t.createdAt).getTime() / 1000)
  return {
    id: t.id,
    handle: `@${t.author.userName}`,
    name: t.author.name,
    text: t.text,
    timestamp: ts,
    created_at: new Date(t.createdAt).toISOString(),
    url: t.url,
    likes: t.likeCount,
    retweets: t.retweetCount,
    replies: t.replyCount,
    views: t.viewCount,
    isReply: t.isReply,
    isRetweet: t.retweeted_tweet != null,
    photos: []
  }
}

function toQueryDate(d: Date): string {
  return d.toISOString().replace('T', '_').replace(/\.\d{3}Z$/, '_UTC')
}

async function pollAll(): Promise<void> {
  if (!config || config.accounts.length === 0) return

  const until = new Date()
  const sinceBase = lastCheckTime ?? new Date(Date.now() - 60 * 60 * 1000)
  const since = new Date(Math.max(0, sinceBase.getTime() - POLL_OVERLAP_MS))
  const windowMin = Math.round((until.getTime() - since.getTime()) / 60_000)

  const fromParts = config.accounts.map(h => `from:${h}`).join(' OR ')
  const query = `(${fromParts}) since:${toQueryDate(since)} until:${toQueryDate(until)}`

  const slow = consecutiveEmptyPolls >= emptyThreshold(config.intervalMs)
  log('INFO', `Polling ${config.accounts.length} accounts (window: ${windowMin}m${slow ? ', slow mode' : ''})`)

  const allTweets: ApiTweet[] = []
  let cursor: string | undefined
  let pages = 0

  while (pages < MAX_PAGES) {
    const params = new URLSearchParams({ query, queryType: 'Latest' })
    if (cursor) params.set('cursor', cursor)
    const url = `https://api.twitterapi.io/twitter/tweet/advanced_search?${params}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    let res: Response
    try {
      res = await fetch(url, { headers: { 'X-API-Key': config.apiKey }, signal: controller.signal })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      log('ERROR', `Poll failed: ${msg}`)
      config.onError(msg)
      return
    } finally {
      clearTimeout(timeoutId)
    }

    if (!res.ok) {
      let body = ''
      try { body = await res.text() } catch { /* ignore */ }
      log('ERROR', `HTTP ${res.status} — ${body.slice(0, 200)}`)
      config.onError(`HTTP ${res.status}`)
      return
    }

    const data = await res.json() as { tweets?: ApiTweet[]; has_next_page?: boolean; next_cursor?: string }
    const page = data.tweets ?? []
    allTweets.push(...page)
    pages++
    log('INFO', `page ${pages}: ${page.length} tweets, has_next=${data.has_next_page}`)

    if (data.has_next_page && data.next_cursor) {
      cursor = data.next_cursor
    } else {
      break
    }
  }

  if (pages >= MAX_PAGES) log('WARN', `Pagination capped at ${MAX_PAGES} pages`)

  lastCheckTime = until
  config.onPollComplete?.(until)

  if (allTweets.length === 0) {
    consecutiveEmptyPolls++
    log('INFO', `0 new tweets (empty streak: ${consecutiveEmptyPolls})`)
    return
  }

  consecutiveEmptyPolls = 0
  const rows = allTweets.map(t => apiTweetToRow(t))
  for (const row of rows) {
    if (insertTweet(row)) config.onNewTweet(row)
  }

  log('INFO', `${rows.length} new tweets`)
}

export async function _pollForTesting(): Promise<void> {
  return pollAll()
}

export function _resetStateForTesting(): void {
  lastCheckTime = null
  consecutiveEmptyPolls = 0
  paused = false
  config = null
}

function schedulePoll(delay: number): void {
  if (pollTimer) clearTimeout(pollTimer)
  clearCountdownTimer()

  if (delay > 0) {
    const endAt = Date.now() + delay
    log('INFO', `Next poll in ${formatRemaining(delay)}`)

    if (delay >= 30_000) {
      countdownTimer = setInterval(() => {
        const remaining = endAt - Date.now()
        if (remaining <= 0) {
          clearCountdownTimer()
          return
        }
        log('INFO', `Next poll in ${formatRemaining(remaining)}`)
      }, 30_000)
    }
  }

  const timer = setTimeout(async () => {
    clearCountdownTimer()
    await pollAll()
    if (pollTimer === timer && config && !paused) {
      const slowMs = Math.min(config.intervalMs * 5, 30 * 60_000)
      const shouldSlow = adaptiveSlowdownEnabled && consecutiveEmptyPolls >= emptyThreshold(config.intervalMs)
      const next = shouldSlow ? slowMs : config.intervalMs
      schedulePoll(next)
    }
  }, delay)
  pollTimer = timer
}

export function startPolling(cfg: PollConfig): void {
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null }
  paused = false
  consecutiveEmptyPolls = 0
  lastCheckTime = cfg.initialSince ?? null
  // Layer 2 of 2: enforce minimum regardless of what the caller passes.
  config = { ...cfg, intervalMs: Math.max(MIN_INTERVAL_MS, cfg.intervalMs) }
  log('INFO', `Polling started — ${config.accounts.length} accounts, interval ${config.intervalMs}ms, since=${lastCheckTime?.toISOString() ?? 'last 1h'}`)
  schedulePoll(0)
}

export function stopPolling(): void {
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null }
  clearCountdownTimer()
  log('INFO', 'Polling stopped')
}

export function pausePolling(): void {
  if (paused) return
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null }
  clearCountdownTimer()
  paused = true
  log('INFO', 'Polling paused (window minimized)')
}

export function resumePolling(): void {
  if (!paused || !config) return
  paused = false
  log('INFO', 'Polling resumed')
  schedulePoll(0)
}

export function updateAccounts(accounts: string[]): void {
  if (!config) return
  config.accounts = accounts
  log('INFO', `Accounts updated: [${accounts.join(', ')}]`)
}

export function setAdaptiveSlowdown(enabled: boolean): void {
  adaptiveSlowdownEnabled = enabled
  log('INFO', `Adaptive slowdown ${enabled ? 'enabled' : 'disabled'}`)
}

export function updateInterval(ms: number): void {
  if (!config) return
  const safe = Math.max(MIN_INTERVAL_MS, ms)
  config.intervalMs = safe
  log('INFO', `Poll interval updated to ${safe}ms`)
}
