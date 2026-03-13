import { app, BrowserWindow, ipcMain, safeStorage, shell, screen } from 'electron'
import { join } from 'path'
import Store from 'electron-store'
import { getRecentTweets, flushTweetCache } from './db'
import { startPolling, stopPolling, pausePolling, resumePolling, updateAccounts, updateInterval } from './poller'
import { log, getLogFilePath } from './logger'

interface StoreSchema {
  accounts: string[]
  keywords: string[]
  scrollSpeed: number
  opacity: number
  alwaysOnTop: boolean
  maxAgeMinutes: number | null
  pollingIntervalMs: number
  lastPollTime: string | null
  windowBounds: { x: number; y: number; width: number; height: number }
  apiKeyBlob: string | null
  autoScroll: boolean
}

const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function clamp(val: unknown, min: number, max: number): number | null {
  const n = Number(val)
  if (!isFinite(n)) return null
  return Math.min(max, Math.max(min, n))
}

function isStringArray(val: unknown): val is string[] {
  return Array.isArray(val) && val.every((v) => typeof v === 'string')
}

let store: Store<StoreSchema>

function getStore(): Store<StoreSchema> {
  if (!store) {
    store = new Store<StoreSchema>({
      defaults: {
        accounts: [],
        keywords: [],
        scrollSpeed: 30,
        opacity: 1,
        alwaysOnTop: false,
        maxAgeMinutes: 120,
        pollingIntervalMs: 210_000,
        lastPollTime: null,
        windowBounds: { x: 100, y: 100, width: 420, height: 700 },
        apiKeyBlob: null,
        autoScroll: true
      }
    })
  }
  return store
}

function saveApiKey(key: string): void {
  if (!safeStorage.isEncryptionAvailable()) return
  const buf = safeStorage.encryptString(key)
  getStore().set('apiKeyBlob', buf.toString('base64'))
}

function loadApiKey(): string | null {
  if (!safeStorage.isEncryptionAvailable()) return null
  const blob = getStore().get('apiKeyBlob')
  if (!blob) return null
  try {
    return safeStorage.decryptString(Buffer.from(blob, 'base64'))
  } catch {
    return null
  }
}

function clearApiKey(): void {
  getStore().set('apiKeyBlob', null)
}

let win: BrowserWindow | null = null

function createWindow(): void {
  const s = getStore()
  const bounds = s.get('windowBounds')

  win = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: s.get('alwaysOnTop'),
    skipTaskbar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      backgroundThrottling: false
    }
  })

  if (s.get('alwaysOnTop')) win.setAlwaysOnTop(true, 'screen-saver')

  win.on('moved', () => {
    if (win?.isAlwaysOnTop()) win.setAlwaysOnTop(true, 'screen-saver')
  })

  win.setOpacity(Math.cbrt(s.get('opacity')))

  win.on('minimize', () => pausePolling())
  win.on('restore', () => resumePolling())

  win.on('close', () => {
    if (win) {
      s.set('windowBounds', win.getBounds())
      s.set('alwaysOnTop', win.isAlwaysOnTop())
    }
  })
  win.on('closed', () => { win = null })

  win.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      if (win?.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools()
      } else {
        win?.webContents.openDevTools({ mode: 'detach' })
      }
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeUrl(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    const safe = url.startsWith('http://localhost:5173') || url.startsWith('file://')
    if (!safe) event.preventDefault()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  const s = getStore()
  createWindow()

  screen.on('display-metrics-changed', () => {
    if (win?.isAlwaysOnTop()) win.setAlwaysOnTop(true, 'screen-saver')
  })

  win?.webContents.once('did-finish-load', async () => {
    const cached = getRecentTweets(50).reverse()
    for (const t of cached) win?.webContents.send('feed:item', t)

    const apiKey = loadApiKey()
    if (apiKey && s.get('accounts').length > 0) {
      log('INFO', 'API key found — starting polling')
      const savedTime = s.get('lastPollTime')
      startPolling({
        accounts: s.get('accounts'),
        intervalMs: s.get('pollingIntervalMs'),
        apiKey,
        initialSince: savedTime ? new Date(savedTime) : undefined,
        onNewTweet: (tweet) => win?.webContents.send('feed:item', tweet),
        onError: (msg) => win?.webContents.send('feed:error', msg),
        onPollComplete: (t) => getStore().set('lastPollTime', t.toISOString())
      })
    } else if (!apiKey) {
      log('INFO', 'No API key saved — enter one in Settings to start polling')
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  log('INFO', 'App closing — flushing tweet cache')
  flushTweetCache()
  stopPolling()
  app.exit(0)
})

ipcMain.handle('settings:get', () => {
  const s = getStore()
  return {
    accounts: s.get('accounts'),
    keywords: s.get('keywords'),
    scrollSpeed: s.get('scrollSpeed'),
    opacity: s.get('opacity'),
    alwaysOnTop: s.get('alwaysOnTop'),
    maxAgeMinutes: s.get('maxAgeMinutes'),
    pollingIntervalMs: s.get('pollingIntervalMs'),
    hasApiKey: loadApiKey() !== null,
    autoScroll: s.get('autoScroll')
  }
})

ipcMain.handle('settings:setOpacity', (_, val: unknown) => {
  const v = clamp(val, 0.1, 1)
  if (v === null) return
  getStore().set('opacity', v)
  win?.setOpacity(Math.cbrt(v))
})

ipcMain.handle('settings:setAlwaysOnTop', (_, val: unknown) => {
  if (typeof val !== 'boolean') return
  getStore().set('alwaysOnTop', val)
  win?.setAlwaysOnTop(val, 'screen-saver')
})

ipcMain.handle('settings:setScrollSpeed', (_, val: unknown) => {
  const v = clamp(val, 5, 120)
  if (v === null) return
  getStore().set('scrollSpeed', v)
})

ipcMain.handle('settings:setAutoScroll', (_, val: unknown) => {
  if (typeof val !== 'boolean') return
  getStore().set('autoScroll', val)
})

ipcMain.handle('settings:setMaxAge', (_, val: unknown) => {
  if (val === null) { getStore().set('maxAgeMinutes', null); return }
  const v = clamp(val, 10, 1440)
  if (v === null) return
  getStore().set('maxAgeMinutes', v)
})

// Layer 1 of 2: IPC clamps to [1min, 60min] before storing or using.
// Layer 2 is inside startPolling itself — see poller.ts MIN_INTERVAL_MS.
// Note: only updates the interval, does NOT restart polling (no free immediate poll).
ipcMain.handle('settings:setPollingInterval', (_, val: unknown) => {
  const v = clamp(val, 60_000, 3_600_000)
  if (v === null) return
  getStore().set('pollingIntervalMs', v)
  updateInterval(v)
})

ipcMain.handle('settings:setKeywords', (_, keywords: unknown) => {
  if (!isStringArray(keywords)) return
  const safe = keywords.slice(0, 30).map((k) => k.slice(0, 50))
  getStore().set('keywords', safe)
})

ipcMain.handle('accounts:add', (_, handle: unknown) => {
  if (typeof handle !== 'string') return { error: 'Invalid handle' }
  const s = getStore()
  const current = s.get('accounts')
  const clean = handle.replace(/^@/, '').trim()
  if (!HANDLE_RE.test(clean)) return { error: 'Invalid X handle format' }
  if (current.includes(clean.toLowerCase())) return { accounts: current }
  if (current.length >= 100) return { error: 'Account limit reached' }
  const updated = [...current, clean.toLowerCase()]
  s.set('accounts', updated)
  updateAccounts(updated)
  return { accounts: updated }
})

ipcMain.handle('accounts:remove', (_, handle: unknown) => {
  if (typeof handle !== 'string') return { error: 'Invalid handle' }
  const s = getStore()
  const clean = handle.replace(/^@/, '').trim().toLowerCase()
  if (!HANDLE_RE.test(clean)) return { error: 'Invalid X handle format' }
  const updated = s.get('accounts').filter((a) => a !== clean)
  s.set('accounts', updated)
  updateAccounts(updated)
  return { accounts: updated }
})

ipcMain.handle('auth:saveApiKey', async (_e, key: unknown) => {
  if (typeof key !== 'string' || !key.trim()) return { success: false }
  const trimmed = key.trim()
  saveApiKey(trimmed)
  stopPolling()
  const s = getStore()
  if (s.get('accounts').length > 0) {
    startPolling({
      accounts: s.get('accounts'),
      intervalMs: s.get('pollingIntervalMs'),
      apiKey: trimmed,
      initialSince: (() => { const t = s.get('lastPollTime'); return t ? new Date(t) : undefined })(),
      onNewTweet: (tweet) => win?.webContents.send('feed:item', tweet),
      onError: (msg) => win?.webContents.send('feed:error', msg),
      onPollComplete: (t) => getStore().set('lastPollTime', t.toISOString())
    })
  }
  log('INFO', 'API key saved — polling (re)started')
  return { success: true }
})

ipcMain.handle('auth:clearApiKey', () => {
  clearApiKey()
  stopPolling()
  log('INFO', 'API key cleared — polling stopped')
  return { success: true }
})

ipcMain.handle('window:minimize', () => win?.minimize())
ipcMain.handle('window:close', () => win?.close())

ipcMain.handle('shell:openExternal', (_e, url: unknown) => {
  if (typeof url === 'string' && isSafeUrl(url)) shell.openExternal(url)
})

ipcMain.handle('shell:openLogFile', () => {
  shell.openPath(getLogFilePath())
})
