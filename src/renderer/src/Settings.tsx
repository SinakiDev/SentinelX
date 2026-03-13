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
  const [autoScroll, setAutoScroll] = useState(settings.autoScroll)
  const [pollingIntervalMs, setPollingIntervalMs] = useState(settings.pollingIntervalMs)
  const [hasApiKey, setHasApiKey] = useState(settings.hasApiKey)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [keyStatus, setKeyStatus] = useState<string | null>(null)

  useEffect(() => { setHasApiKey(settings.hasApiKey) }, [settings.hasApiKey])

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

  async function handleAutoScroll(val: boolean) {
    setAutoScroll(val)
    await window.api.setAutoScroll(val)
    onUpdate({ autoScroll: val })
  }

  async function handlePollingInterval(val: number) {
    setPollingIntervalMs(val)
    await window.api.setPollingInterval(val)
    onUpdate({ pollingIntervalMs: val })
  }

  async function handleMaxAge(val: number | null) {
    setMaxAge(val)
    await window.api.setMaxAge(val)
    onUpdate({ maxAgeMinutes: val })
  }

  async function handleSaveKey() {
    const key = apiKeyInput.trim()
    if (!key) return
    const result = await window.api.saveApiKey(key)
    if (result.success) {
      setHasApiKey(true)
      setApiKeyInput('') // clear from memory — key is now in main process only
      setKeyStatus(null)
      onUpdate({ hasApiKey: true })
    } else {
      setKeyStatus('Failed to save key — try again.')
    }
  }

  async function handleClearKey() {
    await window.api.clearApiKey()
    setHasApiKey(false)
    onUpdate({ hasApiKey: false })
  }

  return (
    <div className="settings-panel">
      {/* Accounts */}
      <section className="settings-section">
        <h2 className="settings-heading">Monitored Accounts</h2>
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
          <label className="settings-label">Poll interval</label>
          <div className="flex gap-1 flex-wrap">
            {([60_000, 120_000, 210_000, 300_000, 600_000] as number[]).map((ms) => {
              const label = ms < 60_000 ? `${ms / 1000}s` : `${ms / 60_000}m`
              return (
                <button
                  key={ms}
                  className={`age-btn ${pollingIntervalMs === ms ? 'age-btn--active' : ''}`}
                  onClick={() => handlePollingInterval(ms)}
                >
                  {label}
                </button>
              )
            })}
          </div>
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
          <label className="settings-label">Auto-scroll</label>
          <div className="flex gap-1">
            {([true, false] as boolean[]).map((opt) => (
              <button
                key={String(opt)}
                className={`age-btn ${autoScroll === opt ? 'age-btn--active' : ''}`}
                onClick={() => handleAutoScroll(opt)}
              >
                {opt ? 'On' : 'Off'}
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

      {/* API Key */}
      <section className="settings-section">
        <h2 className="settings-heading">twitterapi.io Key</h2>
        {hasApiKey ? (
          <div>
            <p className="text-xs text-green-400 mb-2">● API key saved — polling active</p>
            <button className="settings-btn settings-btn--danger" onClick={handleClearKey}>
              Remove Key
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500">Get your key at twitterapi.io/dashboard</p>
            <input
              type="password"
              className="settings-input"
              placeholder="Paste API key…"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
            />
            <button className="settings-btn" onClick={handleSaveKey} disabled={!apiKeyInput.trim()}>
              Save Key
            </button>
            {keyStatus && (
              <p className="text-xs text-red-400">{keyStatus}</p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
