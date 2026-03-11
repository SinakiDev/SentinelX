import { Scraper, SearchMode, Tweet } from '@the-convocation/twitter-scraper'
import { insertTweet, TweetRow } from './db'

let scraper: Scraper | null = null
let pollTimer: NodeJS.Timeout | null = null
let polling = false

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
    const tweets = scraper!.getTweets(handle, 5)
    for await (const tweet of tweets) {
      if (!tweet.id || !tweet.text) continue
      rows.push(tweetToRow(tweet, handle))
    }
    return rows
  })()

  const timeoutPromise = new Promise<TweetRow[]>((_, reject) =>
    setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs / 1000}s`)), timeoutMs)
  )

  return Promise.race([fetchPromise, timeoutPromise])
}

export async function searchWithScraper(query: string, maxResults: number, timeoutMs: number): Promise<TweetRow[]> {
  if (!scraper) throw new Error('Not logged in')
  const rows: TweetRow[] = []

  const fetchPromise = (async () => {
    const tweets = scraper!.searchTweets(query, maxResults, SearchMode.Latest)
    for await (const tweet of tweets) {
      if (!tweet.id || !tweet.text) continue
      const handle = tweet.username ?? 'unknown'
      rows.push(tweetToRow(tweet, handle))
    }
    return rows
  })()

  const timeoutPromise = new Promise<TweetRow[]>((_, reject) =>
    setTimeout(() => reject(new Error('Search timed out')), timeoutMs)
  )

  return Promise.race([fetchPromise, timeoutPromise])
}

async function pollAccounts(): Promise<void> {
  if (!config || !scraper) return
  if (polling) return
  polling = true

  try {
    for (const handle of config.accounts) {
      if (!scraper || !config) break
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
