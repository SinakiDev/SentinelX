import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setOpacity: (val: number) => ipcRenderer.invoke('settings:setOpacity', val),
  setAlwaysOnTop: (val: boolean) => ipcRenderer.invoke('settings:setAlwaysOnTop', val),
  setScrollSpeed: (val: number) => ipcRenderer.invoke('settings:setScrollSpeed', val),
  setKeywords: (kw: string[]) => ipcRenderer.invoke('settings:setKeywords', kw),
  setMaxAge: (val: number | null) => ipcRenderer.invoke('settings:setMaxAge', val),
  setAutoScroll: (val: boolean) => ipcRenderer.invoke('settings:setAutoScroll', val),
  setPollingInterval: (val: number) => ipcRenderer.invoke('settings:setPollingInterval', val),

  // Accounts
  addAccount: (handle: string) => ipcRenderer.invoke('accounts:add', handle),
  removeAccount: (handle: string) => ipcRenderer.invoke('accounts:remove', handle),

  // Auth
  saveApiKey: (key: string) => ipcRenderer.invoke('auth:saveApiKey', key),
  clearApiKey: () => ipcRenderer.invoke('auth:clearApiKey'),

  // Window
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // Events
  onFeedItem: (cb: (item: FeedItem) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, item: FeedItem) => cb(item)
    ipcRenderer.on('feed:item', handler)
    return () => ipcRenderer.removeListener('feed:item', handler)
  },
  onFeedError: (cb: (msg: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, msg: string) => cb(msg)
    ipcRenderer.on('feed:error', handler)
    return () => ipcRenderer.removeListener('feed:error', handler)
  },
})

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

