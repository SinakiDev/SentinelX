import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron-store', () => ({
  default: vi.fn().mockImplementation(() => ({
    get: vi.fn(() => []),
    set: vi.fn()
  }))
}))

vi.mock('../logger', () => ({ log: vi.fn() }))

vi.mock('../db', () => ({
  insertTweet: vi.fn(() => true),
  getRecentTweets: vi.fn(() => []),
  getLastTweetId: vi.fn(() => null),
  setLastTweetId: vi.fn()
}))

import {
  startPolling,
  stopPolling,
  _pollForTesting,
  _resetStateForTesting
} from '../poller'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mockFetch)
  stopPolling()
  _resetStateForTesting()
})

function makeOkResponse(tweets: object[] = []) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ tweets, has_next_page: false, next_cursor: '' })
  }
}

function makeTweet(id: string, timestampSec: number, userName = 'alice') {
  return {
    id,
    text: `tweet ${id}`,
    author: { userName, name: userName },
    retweetCount: 0, replyCount: 0, likeCount: 0, viewCount: 0,
    createdAt: new Date(timestampSec * 1000).toISOString(),
    isReply: false, retweeted_tweet: null, url: ''
  }
}

async function setup(onNewTweet = vi.fn(), onError = vi.fn()) {
  await startPolling({ accounts: ['alice', 'bob'], intervalMs: 90_000, apiKey: 'test-key', onNewTweet, onError })
  stopPolling()
  return { onNewTweet, onError }
}

// ─── Query construction ───────────────────────────────────────────────────

describe('query construction', () => {
  it('uses advanced_search endpoint', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse())
    await setup()
    await _pollForTesting()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('advanced_search'),
      expect.objectContaining({ headers: { 'X-API-Key': 'test-key' } })
    )
  })

  it('combines all accounts into a single OR query', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse())
    await setup()
    await _pollForTesting()
    const url: string = mockFetch.mock.calls[0][0]
    expect(url).toContain('from%3Aalice')
    expect(url).toContain('from%3Abob')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('uses since: on first poll, since_id: on subsequent polls', async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    mockFetch.mockResolvedValueOnce(makeOkResponse([makeTweet('100', nowSec - 30)]))
    await setup()
    await _pollForTesting()
    const firstUrl: string = mockFetch.mock.calls[0][0]
    expect(firstUrl).toContain('since%3A')
    expect(firstUrl).not.toContain('since_id%3A')

    mockFetch.mockResolvedValueOnce(makeOkResponse())
    await _pollForTesting()
    const secondUrl: string = mockFetch.mock.calls[1][0]
    expect(secondUrl).toContain('since_id%3A100')
    expect(secondUrl).not.toContain('since%3A')
  })
})

// ─── Tweet emission ───────────────────────────────────────────────────────

describe('tweet emission', () => {
  it('calls onNewTweet for each returned tweet', async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    const tweets = [makeTweet('1', nowSec - 60, 'alice'), makeTweet('2', nowSec - 30, 'bob')]
    mockFetch.mockResolvedValueOnce(makeOkResponse(tweets))
    const { onNewTweet } = await setup()
    await _pollForTesting()
    expect(onNewTweet).toHaveBeenCalledTimes(2)
  })

  it('does nothing if polling not started', async () => {
    await _pollForTesting()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

// ─── Error handling ───────────────────────────────────────────────────────

describe('error handling', () => {
  it('calls onError for HTTP 429', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, text: async () => '' })
    const { onError } = await setup()
    await _pollForTesting()
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('429'))
  })

  it('calls onError for HTTP 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => '' })
    const { onError } = await setup()
    await _pollForTesting()
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('401'))
  })

  it('calls onError for network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network failure'))
    const { onError } = await setup()
    await _pollForTesting()
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('network failure'))
  })
})

// ─── Cursor advancement ───────────────────────────────────────────────────

describe('cursor advancement', () => {
  it('uses since_id from highest tweet ID to avoid duplicates', async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    mockFetch.mockResolvedValueOnce(makeOkResponse([makeTweet('200', nowSec - 10), makeTweet('150', nowSec - 60)]))
    await setup()
    await _pollForTesting()

    mockFetch.mockResolvedValueOnce(makeOkResponse())
    await _pollForTesting()
    const secondUrl: string = mockFetch.mock.calls[1][0]

    // Should use the newest tweet ID (200) from the first poll
    expect(secondUrl).toContain('since_id%3A200')
  })
})

// ─── Pagination ───────────────────────────────────────────────────────────

describe('pagination', () => {
  it('follows has_next_page and fetches all pages', async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    mockFetch
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ tweets: [makeTweet('1', nowSec - 60)], has_next_page: true, next_cursor: 'cur1' })
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ tweets: [makeTweet('2', nowSec - 30)], has_next_page: false, next_cursor: '' })
      })

    const { onNewTweet } = await setup()
    await _pollForTesting()
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(onNewTweet).toHaveBeenCalledTimes(2)
  })
})

// ─── startPolling / stopPolling ───────────────────────────────────────────

describe('startPolling / stopPolling', () => {
  it('does not throw with valid config', () => {
    expect(() => startPolling({
      accounts: ['alice', 'bob'],
      intervalMs: 90_000,
      apiKey: 'test-key',
      onNewTweet: vi.fn(),
      onError: vi.fn()
    })).not.toThrow()
    stopPolling()
  })

  it('stopPolling does not throw', () => {
    expect(() => stopPolling()).not.toThrow()
  })
})
