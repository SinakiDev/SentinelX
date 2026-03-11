import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setOpacity: (val: number) => ipcRenderer.invoke('settings:setOpacity', val),
  setAlwaysOnTop: (val: boolean) => ipcRenderer.invoke('settings:setAlwaysOnTop', val),
  setScrollSpeed: (val: number) => ipcRenderer.invoke('settings:setScrollSpeed', val),
  setKeywords: (kw: string[]) => ipcRenderer.invoke('settings:setKeywords', kw),
  setMaxAge: (val: number | null) => ipcRenderer.invoke('settings:setMaxAge', val),

  // Accounts
  addAccount: (handle: string) => ipcRenderer.invoke('accounts:add', handle),
  removeAccount: (handle: string) => ipcRenderer.invoke('accounts:remove', handle),

  // Auth
  openLoginWindow: () => ipcRenderer.invoke('auth:openLoginWindow'),
  logout: () => ipcRenderer.invoke('auth:logout'),

  // Window
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),

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
  onInitSettings: (cb: (s: InitSettings) => void) => {
    ipcRenderer.once('init:settings', (_e, s) => cb(s))
  },
  onLoginStatus: (cb: (status: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, status: string) => cb(status)
    ipcRenderer.on('auth:loginStatus', handler)
    return () => ipcRenderer.removeListener('auth:loginStatus', handler)
  }
})

export interface FeedItem {
  id: string
  handle: string
  name: string
  text: string
  timestamp: number
  created_at: string
}

export interface InitSettings {
  accounts: string[]
  keywords: string[]
  scrollSpeed: number
  opacity: number
  alwaysOnTop: boolean
  hasCredentials: boolean
}
