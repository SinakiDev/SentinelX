import Store from 'electron-store'

export interface TweetRow {
  id: string
  handle: string
  name: string
  text: string
  timestamp: number
  created_at: string
  url: string
  likes: number
  retweets: number
  replies: number
  views: number
  isReply: boolean
  isRetweet: boolean
  photos: string[]
}

interface TweetStore {
  tweets: TweetRow[]
  lastTweetId: string | null
}

let _store: Store<TweetStore> | null = null

function getStore(): Store<TweetStore> {
  if (!_store) {
    _store = new Store<TweetStore>({
      name: 'tweet-cache',
      defaults: { tweets: [], lastTweetId: null }
    })
  }
  return _store
}

const MAX_TWEETS = 300

// In-memory cache — avoids a full read-sort-write to disk on every insert.
// On a burst of 24 tweets (8 accounts × 3) the old code did 24 disk writes;
// now we do one write 2 seconds after the last insert.
let _cache: TweetRow[] | null = null
let _ids: Set<string> | null = null
let _flushTimer: ReturnType<typeof setTimeout> | null = null

function loadCache(): void {
  if (_cache) return
  const stored = getStore().get('tweets')
  _cache = [...stored]
  _ids = new Set(stored.map((t) => t.id))
}

function scheduleFlush(): void {
  if (_flushTimer) return
  _flushTimer = setTimeout(() => {
    _flushTimer = null
    if (_cache) getStore().set('tweets', _cache)
  }, 2_000)
}

export function insertTweet(tweet: TweetRow): boolean {
  loadCache()
  if (_ids!.has(tweet.id)) return false
  _ids!.add(tweet.id)
  _cache!.push(tweet)
  _cache!.sort((a, b) => b.timestamp - a.timestamp)
  if (_cache!.length > MAX_TWEETS) {
    const removed = _cache!.splice(MAX_TWEETS)
    for (const t of removed) _ids!.delete(t.id)
  }
  scheduleFlush()
  return true
}

export function getRecentTweets(limit = 50): TweetRow[] {
  loadCache()
  return _cache!.slice(0, limit)
}

// Write cache to disk immediately — call on app close so no tweets are lost
export function flushTweetCache(): void {
  if (_flushTimer) {
    clearTimeout(_flushTimer)
    _flushTimer = null
  }
  if (_cache) getStore().set('tweets', _cache)
}

export function getLastTweetId(): string | null {
  return getStore().get('lastTweetId') ?? null
}

export function setLastTweetId(id: string): void {
  getStore().set('lastTweetId', id)
}

// Reset in-memory state — only used in unit tests
export function _resetForTesting(): void {
  _cache = null
  _ids = null
  _store = null
  if (_flushTimer) {
    clearTimeout(_flushTimer)
    _flushTimer = null
  }
}
