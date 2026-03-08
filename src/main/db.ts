import Store from 'electron-store'

export interface TweetRow {
  id: string
  handle: string
  name: string
  text: string
  timestamp: number
  created_at: string
}

interface TweetStore {
  tweets: TweetRow[]
}

let _store: Store<TweetStore> | null = null

function getStore(): Store<TweetStore> {
  if (!_store) {
    _store = new Store<TweetStore>({
      name: 'tweet-cache',
      defaults: { tweets: [] }
    })
  }
  return _store
}

const MAX_TWEETS = 300

/** Returns true if the tweet was new (not a duplicate). */
export function insertTweet(tweet: TweetRow): boolean {
  const store = getStore()
  const tweets = store.get('tweets')
  if (tweets.some((t) => t.id === tweet.id)) return false
  const updated = [...tweets, tweet]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_TWEETS)
  store.set('tweets', updated)
  return true
}

export function getRecentTweets(limit = 50): TweetRow[] {
  return getStore().get('tweets').slice(0, limit)
}
