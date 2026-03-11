export interface FeedItem {
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

export interface Settings {
  accounts: string[]
  keywords: string[]
  scrollSpeed: number
  opacity: number
  alwaysOnTop: boolean
  maxAgeMinutes: number | null
  hasCredentials: boolean
}

declare global {
  interface Window {
    api: {
      getSettings: () => Promise<Settings>
      setOpacity: (val: number) => Promise<void>
      setAlwaysOnTop: (val: boolean) => Promise<void>
      setScrollSpeed: (val: number) => Promise<void>
      setKeywords: (kw: string[]) => Promise<void>
      setMaxAge: (val: number | null) => Promise<void>
      addAccount: (handle: string) => Promise<{ accounts: string[] }>
      removeAccount: (handle: string) => Promise<{ accounts: string[] }>
      openLoginWindow: () => Promise<{ success: boolean }>
      logout: () => Promise<{ success: boolean }>
      minimize: () => Promise<void>
      close: () => Promise<void>
      openExternal: (url: string) => Promise<void>
      onFeedItem: (cb: (item: FeedItem) => void) => () => void
      onFeedError: (cb: (msg: string) => void) => () => void
      onInitSettings: (cb: (s: Settings) => void) => void
      onLoginStatus: (cb: (status: string) => void) => () => void
      onRateLimit: (cb: (until: number) => void) => () => void
    }
  }
}
