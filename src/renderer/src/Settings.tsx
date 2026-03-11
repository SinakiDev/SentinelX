import { useState, useEffect } from 'react'
import { Settings as SettingsType } from './types'

interface Props {
  settings: SettingsType
  onUpdate: (updated: Partial<SettingsType>) => void
}

export default function Settings({ settings, onUpdate }: Props) {
  const [accounts, setAccounts] = useState<string[]>(settings.accounts)
  const [newHandle, setNewHandle] = useState('')
  const [keywords, setKeywords] = useState(settings.keywords.join(', '))
  const [scrollSpeed, setScrollSpeed] = useState(settings.scrollSpeed)
  const [opacity, setOpacity] = useState(settings.opacity)
  const [maxAge, setMaxAge] = useState<number | null>(settings.maxAgeMinutes)
  const [loginStatus, setLoginStatus] = useState<string | null>(null)
  const [loginBusy, setLoginBusy] = useState(false)
  const [hasCredentials, setHasCredentials] = useState(settings.hasCredentials)

  // Keep in sync if parent detects session expiry while Settings is already open
  useEffect(() => { setHasCredentials(settings.hasCredentials) }, [settings.hasCredentials])

  async function addAccount() {
    const handle = newHandle.trim()
    if (!handle) return
    const { accounts: updated } = await window.api.addAccount(handle)
    setAccounts(updated)
    onUpdate({ accounts: updated })
    setNewHandle('')
  }

  async function removeAccount(handle: string) {
    const { accounts: updated } = await window.api.removeAccount(handle)
    setAccounts(updated)
    onUpdate({ accounts: updated })
  }

  async function saveKeywords() {
    const kw = keywords.split(',').map((k) => k.trim()).filter(Boolean)
    await window.api.setKeywords(kw)
    onUpdate({ keywords: kw })
  }

  async function handleOpacity(val: number) {
    setOpacity(val)
    await window.api.setOpacity(val)
    onUpdate({ opacity: val })
  }

  async function handleScrollSpeed(val: number) {
    setScrollSpeed(val)
    await window.api.setScrollSpeed(val)
    onUpdate({ scrollSpeed: val })
  }

  async function handleMaxAge(val: number | null) {
    setMaxAge(val)
    await window.api.setMaxAge(val)
    onUpdate({ maxAgeMinutes: val })
  }

  async function handleLogin() {
    setLoginBusy(true)
    setLoginStatus('Opening X login window…')
    const unsub = window.api.onLoginStatus((status) => {
      if (status === 'opening') setLoginStatus('Login window open — sign in to X…')
      else if (status === 'connected') { setLoginStatus('Connected!'); setHasCredentials(true); onUpdate({ hasCredentials: true }) }
      else if (status === 'cancelled') setLoginStatus('Login cancelled.')
      else if (status === 'failed') setLoginStatus('Login failed — try again.')
    })
    const result = await window.api.openLoginWindow()
    unsub()
    setLoginBusy(false)
    if (result.success) {
      setHasCredentials(true)
      onUpdate({ hasCredentials: true })
    }
  }

  async function handleLogout() {
    await window.api.logout()
    setHasCredentials(false)
    setLoginStatus('Logged out.')
    onUpdate({ hasCredentials: false })
  }

  return (
    <div className="settings-panel">
      {/* Accounts */}
      <section className="settings-section">
        <h2 className="settings-heading">Monitored Accounts</h2>
        <p className="text-xs text-yellow-600 mb-2">⚠ Keep under 20 accounts. Too many increases the risk of X rate-limiting or suspending your session. Poll interval is 90s per cycle.</p>
        <div className="flex gap-2 mb-2">
          <input
            className="settings-input flex-1"
            placeholder="@handle"
            value={newHandle}
            onChange={(e) => setNewHandle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addAccount()}
          />
          <button className="settings-btn" onClick={addAccount}>
            Add
          </button>
        </div>
        <div className="account-list">
          {accounts.length === 0 && (
            <p className="text-xs text-gray-500">No accounts yet.</p>
          )}
          {accounts.map((a) => (
            <div key={a} className="account-row">
              <span className="text-sm text-blue-300">@{a}</span>
              <button
                className="account-remove"
                onClick={() => removeAccount(a)}
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Keywords */}
      <section className="settings-section">
        <h2 className="settings-heading">Alert Keywords</h2>
        <p className="text-xs text-gray-500 mb-1">Comma-separated. Matching tweets highlight amber.</p>
        <div className="flex gap-2">
          <input
            className="settings-input flex-1"
            placeholder="strike, missile, attack"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            onBlur={saveKeywords}
            onKeyDown={(e) => e.key === 'Enter' && saveKeywords()}
          />
        </div>
      </section>

      {/* Display controls */}
      <section className="settings-section">
        <h2 className="settings-heading">Display</h2>
        <div className="settings-row">
          <label className="settings-label">Scroll speed</label>
          <input
            type="range"
            min={5}
            max={120}
            value={scrollSpeed}
            onChange={(e) => handleScrollSpeed(Number(e.target.value))}
            className="flex-1"
          />
          <span className="settings-val">{scrollSpeed}px/s</span>
        </div>
        <div className="settings-row">
          <label className="settings-label">Max tweet age</label>
          <div className="flex gap-1 flex-wrap">
            {([30, 45, 60, 120, 240, null] as (number | null)[]).map((opt) => (
              <button
                key={opt ?? 'all'}
                className={`age-btn ${maxAge === opt ? 'age-btn--active' : ''}`}
                onClick={() => handleMaxAge(opt)}
              >
                {opt === null ? 'All' : opt < 60 ? `${opt}m` : `${opt / 60}h`}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <label className="settings-label">Transparency</label>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.01}
            value={opacity}
            onChange={(e) => handleOpacity(Number(e.target.value))}
            className="flex-1"
          />
          <span className="settings-val">{Math.round(opacity * 100)}%</span>
        </div>
      </section>

      {/* X Login */}
      <section className="settings-section">
        <h2 className="settings-heading">X Account Login</h2>
        {hasCredentials ? (
          <div>
            <p className="text-xs text-green-400 mb-2">● Connected — polling active</p>
            <button className="settings-btn settings-btn--danger" onClick={handleLogout}>
              Logout
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500">A browser window will open — log in to X, then return here.</p>
            <button className="settings-btn" onClick={handleLogin} disabled={loginBusy}>
              {loginBusy ? 'Waiting…' : 'Login with X →'}
            </button>
            {loginStatus && (
              <p className="text-xs text-yellow-300">{loginStatus}</p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
