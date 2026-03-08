import { Scraper } from '@the-convocation/twitter-scraper'
import { insertTweet, TweetRow } from './db'

let scraper: Scraper | null = null
let pollTimer: NodeJS.Timeout | null = null

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
  await pollAccounts()
  pollTimer = setInterval(pollAccounts, cfg.intervalMs)
}

export function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export function clearScraper(): void {
  scraper = null
  config = null
}

export function updateAccounts(accounts: string[]): void {
  if (config) config.accounts = accounts
}

async function pollAccounts(): Promise<void> {
  if (!config || !scraper) return
  for (const handle of config.accounts) {
    try {
      const tweets = scraper.getTweets(handle, 10)
      for await (const tweet of tweets) {
        if (!tweet.id || !tweet.text) continue
        const row: TweetRow = {
          id: tweet.id,
          handle: `@${handle}`,
          name: tweet.username ?? handle,
          text: tweet.text,
          timestamp: tweet.timestamp ?? Math.floor(Date.now() / 1000),
          created_at: tweet.timeParsed?.toISOString() ?? new Date().toISOString()
        }
        const isNew = insertTweet(row)
        if (isNew) config.onNewTweet(row)
      }
    } catch (e: unknown) {
      config.onError(`Error fetching @${handle}: ${e instanceof Error ? e.message : String(e)}`)
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
}
