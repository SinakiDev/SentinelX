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
  hasApiKey: boolean
  autoScroll: boolean
  pollingIntervalMs: number
  adaptiveSlowdown: boolean
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
      setAutoScroll: (val: boolean) => Promise<void>
      setPollingInterval: (val: number) => Promise<void>
      addAccount: (handle: string) => Promise<{ accounts: string[] }>
      removeAccount: (handle: string) => Promise<{ accounts: string[] }>
      saveApiKey: (key: string) => Promise<{ success: boolean }>
      clearApiKey: () => Promise<{ success: boolean }>
      minimize: () => Promise<void>
      close: () => Promise<void>
      setAdaptiveSlowdown: (val: boolean) => Promise<void>
      translateText: (text: string, targetLang?: string) => Promise<string>
      openExternal: (url: string) => Promise<void>
      onFeedItem: (cb: (item: FeedItem) => void) => () => void
      onFeedError: (cb: (msg: string) => void) => () => void
      onMainLog: (cb: (line: string) => void) => () => void
    }
  }
}
