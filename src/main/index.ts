import { app, BrowserWindow, ipcMain, safeStorage, shell, screen } from 'electron'
import { join } from 'path'
import Store from 'electron-store'
import { getRecentTweets } from './db'
import { initScraperWithCookies, startPolling, stopPolling, updateAccounts, clearScraper } from './poller'

interface StoreSchema {
  accounts: string[]
  keywords: string[]
  scrollSpeed: number
  opacity: number
  alwaysOnTop: boolean
  maxAgeMinutes: number | null   // null = show all; otherwise filter by age
  windowBounds: { x: number; y: number; width: number; height: number }
  cookieBlob: string | null   // OS-encrypted JSON array of session cookies
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
        windowBounds: { x: 100, y: 100, width: 420, height: 700 },
        cookieBlob: null
      }
    })
  }
  return store
}

function saveCookies(cookieStrings: string[]): void {
  if (!safeStorage.isEncryptionAvailable()) return
  const buf = safeStorage.encryptString(JSON.stringify(cookieStrings))
  getStore().set('cookieBlob', buf.toString('base64'))
}

function loadCookies(): string[] | null {
  if (!safeStorage.isEncryptionAvailable()) return null
  const blob = getStore().get('cookieBlob')
  if (!blob) return null
  try {
    const buf = Buffer.from(blob, 'base64')
    const json = safeStorage.decryptString(buf)
    return JSON.parse(json) as string[]
  } catch {
    return null
  }
}

function clearCookies(): void {
  getStore().set('cookieBlob', null)
}

const X_DOMAINS = ['https://x.com', 'https://twitter.com', 'https://www.x.com']
const X_HOME_RE = /^https:\/\/(www\.)?(x\.com|twitter\.com)\/?(?:home)?$/

async function openXLoginWindow(): Promise<string[] | null> {
  return new Promise((resolve) => {
    const loginWin = new BrowserWindow({
      width: 620,
      height: 740,
      title: 'Log in to X',
      webPreferences: {
        partition: 'login-temp', // non-persistent in-memory session — fresh every time, no cached cookies
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true
      }
    })

    loginWin.setMenuBarVisibility(false)
    loginWin.loadURL('https://x.com/i/flow/login')

    let resolved = false

    async function checkLogin(url: string) {
      if (resolved) return
      if (X_HOME_RE.test(url) || url.includes('/home')) {
        resolved = true
        try {
          const all: Electron.Cookie[] = []
          for (const domain of X_DOMAINS) {
            const cookies = await loginWin.webContents.session.cookies.get({ url: domain })
            all.push(...cookies)
          }
          const cookieStrings = all.map((c) => `${c.name}=${c.value}`)
          loginWin.close()
          resolve(cookieStrings.length > 0 ? cookieStrings : null)
        } catch {
          loginWin.close()
          resolve(null)
        }
      }
    }

    loginWin.webContents.on('did-navigate', (_, url) => checkLogin(url))
    loginWin.webContents.on('did-navigate-in-page', (_, url) => checkLogin(url))
    loginWin.on('closed', () => { if (!resolved) resolve(null) })
  })
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
      webSecurity: true
    }
  })

  // Use highest z-level so it stays above all windows including on secondary monitors
  if (s.get('alwaysOnTop')) win.setAlwaysOnTop(true, 'screen-saver')

  // Re-apply always-on-top on every move — covers monitor switch z-order resets
  win.on('moved', () => {
    if (win?.isAlwaysOnTop()) win.setAlwaysOnTop(true, 'screen-saver')
  })

  win.setOpacity(Math.cbrt(s.get('opacity')))

  win.on('close', () => {
    if (win) {
      s.set('windowBounds', win.getBounds())
      s.set('alwaysOnTop', win.isAlwaysOnTop())
    }
  })
  win.on('closed', () => { win = null })

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

  // Re-apply always-on-top when display config changes (monitor plug/unplug, resolution change)
  screen.on('display-metrics-changed', () => {
    if (win?.isAlwaysOnTop()) win.setAlwaysOnTop(true, 'screen-saver')
  })

  win?.webContents.once('did-finish-load', async () => {
    win?.webContents.send('init:settings', {
      accounts: s.get('accounts'),
      keywords: s.get('keywords'),
      scrollSpeed: s.get('scrollSpeed'),
      opacity: s.get('opacity'),
      alwaysOnTop: s.get('alwaysOnTop'),
      maxAgeMinutes: s.get('maxAgeMinutes'),
      hasCredentials: s.get('cookieBlob') !== null
    })

    const cached = getRecentTweets(50).reverse()
    for (const t of cached) win?.webContents.send('feed:item', t)

    const cookies = loadCookies()
    if (cookies && s.get('accounts').length > 0) {
      const ok = await initScraperWithCookies(cookies, (msg) => win?.webContents.send('feed:error', msg))
      if (ok) {
        startPolling({
          accounts: s.get('accounts'),
          intervalMs: 90_000,
          onNewTweet: (tweet) => win?.webContents.send('feed:item', tweet),
          onError: (msg) => win?.webContents.send('feed:error', msg)
        })
      } else {
        // Cookies are expired — clear them and tell the renderer so UI shows the login button
        clearCookies()
        win?.webContents.send('auth:loginStatus', 'session-expired')
      }
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopPolling()
  clearScraper()
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
    hasCredentials: s.get('cookieBlob') !== null
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

ipcMain.handle('settings:setMaxAge', (_, val: unknown) => {
  if (val === null) { getStore().set('maxAgeMinutes', null); return }
  const v = clamp(val, 10, 1440)
  if (v === null) return
  getStore().set('maxAgeMinutes', v)
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

ipcMain.handle('auth:openLoginWindow', async () => {
  win?.webContents.send('auth:loginStatus', 'opening')

  const cookies = await openXLoginWindow()

  if (!cookies) {
    win?.webContents.send('auth:loginStatus', 'cancelled')
    return { success: false }
  }

  stopPolling()
  clearScraper()

  const ok = await initScraperWithCookies(cookies, (msg) => win?.webContents.send('feed:error', msg))

  if (ok) {
    saveCookies(cookies)
    const s = getStore()
    startPolling({
      accounts: s.get('accounts'),
      intervalMs: 90_000,
      onNewTweet: (tweet) => win?.webContents.send('feed:item', tweet),
      onError: (msg) => win?.webContents.send('feed:error', msg)
    })
    win?.webContents.send('auth:loginStatus', 'connected')
    return { success: true }
  }

  win?.webContents.send('auth:loginStatus', 'failed')
  return { success: false }
})

ipcMain.handle('auth:logout', () => {
  clearCookies()
  stopPolling()
  clearScraper()
  return { success: true }
})

ipcMain.handle('window:minimize', () => win?.minimize())
ipcMain.handle('window:close', () => win?.close())
