import { Scraper } from '@the-convocation/twitter-scraper'
import { insertTweet, TweetRow } from './db'

let scraper: Scraper | null = null
let pollTimer: NodeJS.Timeout | null = null
let polling = false  // guard: skip cycle if previous one is still running

export interface PollConfig {
  accounts: string[]
  intervalMs: number
  onNewTweet: (tweet: TweetRow) => void
  onError: (msg: string) => void
}

let config: PollConfig | null = null

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

export async function startPolling(cfg: PollConfig): Promise<void> {
  config = cfg
  if (pollTimer) clearInterval(pollTimer)
  polling = false
  await pollAccounts()
  pollTimer = setInterval(pollAccounts, cfg.intervalMs)
}

export function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  polling = false
}

export function clearScraper(): void {
  scraper = null
  config = null
}

export function updateAccounts(accounts: string[]): void {
  if (config) config.accounts = accounts
}

// Drain an async generator with a hard timeout.
// If X stalls the connection, Promise.race rejects after timeoutMs
// and the poller moves on. The stalled generator keeps running in the
// background but its results are ignored.
async function fetchAccountTweets(handle: string, timeoutMs: number): Promise<TweetRow[]> {
  if (!scraper) return []

  const rows: TweetRow[] = []

  const fetchPromise = (async () => {
    const tweets = scraper!.getTweets(handle, 5)
    for await (const tweet of tweets) {
      if (!tweet.id || !tweet.text) continue
      rows.push({
        id: tweet.id,
        handle: `@${handle}`,
        name: tweet.username ?? handle,
        text: tweet.text,
        timestamp: tweet.timestamp ?? Math.floor(Date.now() / 1000),
        created_at: tweet.timeParsed?.toISOString() ?? new Date().toISOString()
      })
    }
    return rows
  })()

  const timeoutPromise = new Promise<TweetRow[]>((_, reject) =>
    setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs / 1000}s`)), timeoutMs)
  )

  return Promise.race([fetchPromise, timeoutPromise])
}

async function pollAccounts(): Promise<void> {
  if (!config || !scraper) return
  if (polling) return  // previous cycle still running, skip this tick
  polling = true

  try {
    for (const handle of config.accounts) {
      if (!scraper || !config) break  // scraper was cleared mid-cycle (logout/close)
      try {
        const rows = await fetchAccountTweets(handle, 20_000)
        for (const row of rows) {
          const isNew = insertTweet(row)
          if (isNew && config) config.onNewTweet(row)
        }
      } catch (e: unknown) {
        if (config) config.onError(`@${handle}: ${e instanceof Error ? e.message : String(e)}`)
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
  } finally {
    polling = false
  }
}
