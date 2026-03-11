import { Scraper, Tweet } from '@the-convocation/twitter-scraper'
import { insertTweet, TweetRow } from './db'

let scraper: Scraper | null = null
const accountTimers = new Map<string, ReturnType<typeof setTimeout>>()

export interface PollConfig {
  accounts: string[]
  intervalMs: number
  onNewTweet: (tweet: TweetRow) => void
  onError: (msg: string) => void
  onRateLimit?: (until: number) => void
}

let config: PollConfig | null = null

const RATE_LIMIT_BACKOFF_MS = 15 * 60 * 1000
let rateLimitUntil = 0

function isRateLimited(): boolean {
  return Date.now() < rateLimitUntil
}

function setRateLimit(): void {
  rateLimitUntil = Date.now() + RATE_LIMIT_BACKOFF_MS
  if (config?.onRateLimit) config.onRateLimit(rateLimitUntil)
}

export function restoreRateLimit(until: number): void {
  if (until > Date.now()) rateLimitUntil = until
}

export async function initScraperWithCookies(
  cookieStrings: string[],
  onError: (msg: string) => void
): Promise<boolean> {
  try {
    scraper = new Scraper()
    await scraper.setCookies(cookieStrings)
    const loggedIn = await scraper.isLoggedIn()
    if (!loggedIn) {
      onError('Session expired — please log in again via Settings.')
      scraper = null
      return false
    }
    return true
  } catch (e: unknown) {
    onError(`Auth error: ${e instanceof Error ? e.message : String(e)}`)
    scraper = null
    return false
  }
}

function tweetToRow(tweet: Tweet, handle: string): TweetRow {
  return {
    id: tweet.id!,
    handle: `@${handle}`,
    name: tweet.username ?? handle,
    text: tweet.text!,
    timestamp: tweet.timestamp ?? Math.floor(Date.now() / 1000),
    created_at: tweet.timeParsed?.toISOString() ?? new Date().toISOString(),
    url: tweet.permanentUrl ?? '',
    likes: tweet.likes ?? 0,
    retweets: tweet.retweets ?? 0,
    replies: tweet.replies ?? 0,
    views: tweet.views ?? 0,
    isReply: tweet.isReply ?? false,
    isRetweet: tweet.isRetweet ?? false,
    photos: (tweet.photos ?? []).map((p) => p.url)
  }
}

async function fetchAccountTweets(handle: string, timeoutMs: number): Promise<TweetRow[]> {
  if (!scraper) return []
  const rows: TweetRow[] = []

  const fetchPromise = (async () => {
    const tweets = scraper!.getTweets(handle, 3)
    for await (const tweet of tweets) {
      if (!tweet.id || !tweet.text) continue
      rows.push(tweetToRow(tweet, handle))
    }
    return rows
  })()

  const timeoutPromise = new Promise<TweetRow[]>((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out`)), timeoutMs)
  )

  return Promise.race([fetchPromise, timeoutPromise])
}

async function pollOneAccount(handle: string): Promise<void> {
  if (!scraper || !config) return
  if (isRateLimited()) return  // session-wide backoff active, skip silently
  try {
    const rows = await fetchAccountTweets(handle, 20_000)
    for (const row of rows) {
      const isNew = insertTweet(row)
      if (isNew && config) config.onNewTweet(row)
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === 'Timed out') return
    if (msg.includes('429') || /too.many.requests/i.test(msg) || /rate.limit/i.test(msg)) {
      setRateLimit()  // pause all accounts for 15 minutes
      return
    }
    if (config) config.onError(`@${handle}: ${msg}`)
  }
}

function scheduleAccount(handle: string, delay: number): void {
  clearTimeout(accountTimers.get(handle))
  const timer = setTimeout(async () => {
    await pollOneAccount(handle)
    if (accountTimers.has(handle) && config) {
      scheduleAccount(handle, config.intervalMs)
    }
  }, delay)
  accountTimers.set(handle, timer)
}

export async function startPolling(cfg: PollConfig): Promise<void> {
  config = cfg
  stopPolling()
  cfg.accounts.forEach((handle, i) => {
    scheduleAccount(handle, i * 3_000)
  })
}

export function stopPolling(): void {
  for (const timer of accountTimers.values()) clearTimeout(timer)
  accountTimers.clear()
}

export function clearScraper(): void {
  scraper = null
  config = null
}

export function updateAccounts(accounts: string[]): void {
  if (!config) return
  const current = new Set(accountTimers.keys())
  const next = new Set(accounts)

  // Remove dropped accounts
  for (const h of current) {
    if (!next.has(h)) {
      clearTimeout(accountTimers.get(h))
      accountTimers.delete(h)
    }
  }

  // Schedule new accounts, staggered 3s apart starting after 1s
  let delay = 1_000
  for (const h of next) {
    if (!current.has(h)) {
      scheduleAccount(h, delay)
      delay += 3_000
    }
  }

  config.accounts = accounts
}
