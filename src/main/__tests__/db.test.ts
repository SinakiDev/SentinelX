import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock electron-store before importing db — each new Store() gets a fresh in-memory map
vi.mock('electron-store', () => ({
  default: vi.fn().mockImplementation(() => {
    const data: Record<string, unknown> = { tweets: [] }
    return {
      get: (key: string) => data[key],
      set: (key: string, val: unknown) => { data[key] = val }
    }
  })
}))

import { insertTweet, getRecentTweets, _resetForTesting, TweetRow } from '../db'

function makeTweet(id: string, timestamp = 1000): TweetRow {
  return {
    id, handle: '@test', name: 'Test', text: 'hello', timestamp,
    created_at: new Date(timestamp * 1000).toISOString(),
    url: '', likes: 0, retweets: 0, replies: 0, views: 0,
    isReply: false, isRetweet: false, photos: []
  }
}

beforeEach(() => {
  _resetForTesting()
  vi.clearAllMocks()
})

describe('insertTweet', () => {
  it('returns true for a new tweet', () => {
    expect(insertTweet(makeTweet('1'))).toBe(true)
  })

  it('returns false for a duplicate id', () => {
    insertTweet(makeTweet('2'))
    expect(insertTweet(makeTweet('2'))).toBe(false)
  })

  it('stores tweets sorted newest-first by timestamp', () => {
    insertTweet(makeTweet('a', 100))
    insertTweet(makeTweet('b', 300))
    insertTweet(makeTweet('c', 200))
    const ids = getRecentTweets(10).map((t) => t.id)
    expect(ids).toEqual(['b', 'c', 'a'])
  })

  it('trims to MAX_TWEETS (300) and evicts oldest', () => {
    for (let i = 0; i < 305; i++) {
      insertTweet(makeTweet(String(i), i))
    }
    const tweets = getRecentTweets(400)
    expect(tweets.length).toBe(300)
    // Oldest (lowest timestamp) should be gone
    const ids = new Set(tweets.map((t) => t.id))
    expect(ids.has('0')).toBe(false)
    expect(ids.has('1')).toBe(false)
    expect(ids.has('2')).toBe(false)
    expect(ids.has('3')).toBe(false)
    expect(ids.has('4')).toBe(false)
  })

  it('does not count duplicate as new after trim', () => {
    for (let i = 0; i < 305; i++) insertTweet(makeTweet(String(i), i))
    // id '304' is the newest and still in cache
    expect(insertTweet(makeTweet('304', 304))).toBe(false)
  })
})

describe('getRecentTweets', () => {
  it('returns at most the requested limit', () => {
    for (let i = 0; i < 10; i++) insertTweet(makeTweet(String(i), i))
    expect(getRecentTweets(3).length).toBe(3)
  })

  it('returns all tweets when limit exceeds count', () => {
    insertTweet(makeTweet('x', 1))
    insertTweet(makeTweet('y', 2))
    expect(getRecentTweets(100).length).toBe(2)
  })
})
