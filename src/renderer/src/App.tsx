import { useEffect, useRef, useState, useMemo } from 'react'
import Feed from './Feed'
import Settings from './Settings'
import { FeedItem, Settings as SettingsType } from './types'

export default function App() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimitUntil, setRateLimitUntil] = useState(0)
  const [rlCountdown, setRlCountdown] = useState(0)

  const itemsRef = useRef<FeedItem[]>([])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    window.api.getSettings().then((s) => {
      setSettings(s)
      setPinned(s.alwaysOnTop)
    })

    const removeFeed = window.api.onFeedItem((item) => {
      if (itemsRef.current.some((i) => i.id === item.id)) return
      itemsRef.current = [...itemsRef.current, item].slice(-300)
      setItems([...itemsRef.current])
    })

    const removeErr = window.api.onFeedError((msg) => {
      setError(msg)
      setTimeout(() => setError(null), 6000)
    })

    const removeLoginStatus = window.api.onLoginStatus((status) => {
      if (status === 'session-expired') {
        setSettings((prev) => prev ? { ...prev, hasCredentials: false } : prev)
        setShowSettings(true)
      }
    })

    const tickInterval = setInterval(() => setTick((t) => t + 1), 30_000)

    return () => {
      removeFeed()
      removeErr()
      removeLoginStatus()
      clearInterval(tickInterval)
    }
  }, [])

  useEffect(() => {
    const removeRl = window.api.onRateLimit((until) => {
      setRateLimitUntil(until)
      setRlCountdown(Math.max(0, Math.ceil((until - Date.now()) / 1000)))
    })
    return () => removeRl()
  }, [])

  useEffect(() => {
    if (rateLimitUntil === 0) return
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((rateLimitUntil - Date.now()) / 1000))
      setRlCountdown(remaining)
      if (remaining === 0) setRateLimitUntil(0)
    }, 1000)
    return () => clearInterval(interval)
  }, [rateLimitUntil])

  const visibleItems = useMemo(() => {
    const maxAge = settings?.maxAgeMinutes ?? null
    const cutoff = maxAge ? Date.now() / 1000 - maxAge * 60 : null
    return [...itemsRef.current]
      .filter((i) => cutoff === null || i.timestamp >= cutoff)
      .sort((a, b) => b.timestamp - a.timestamp)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, settings?.maxAgeMinutes, tick])

  function handlePin() {
    const next = !pinned
    setPinned(next)
    window.api.setAlwaysOnTop(next)
  }

  function handleSettingsUpdate(updated: Partial<SettingsType>) {
    setSettings((prev) => (prev ? { ...prev, ...updated } : prev))
  }

  function handleRemoveItem(id: string) {
    itemsRef.current = itemsRef.current.filter((i) => i.id !== id)
    setItems([...itemsRef.current])
  }

  return (
    <div
      className="app-root flex flex-col h-screen select-none"
      style={{ borderRadius: 10, overflow: 'hidden', '--panel-alpha': settings ? 0.88 + ((settings.opacity - 0.1) / 0.9) * 0.12 : 1 } as React.CSSProperties}
    >
      {/* Title bar */}
      <div
        className="titlebar flex items-center justify-between px-3 py-1.5 flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="text-sm font-bold tracking-widest text-white uppercase">SentinelX</span>
        </div>
        <div
          className="flex items-center gap-2"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={handlePin}
            className={`pin-btn ${pinned ? 'pin-btn--active' : ''}`}
            title={pinned ? 'Pinned — click to unpin' : 'Pin on top'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
            </svg>
            <span>{pinned ? 'PINNED' : 'PIN'}</span>
          </button>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`icon-btn ${showSettings ? 'text-blue-400' : 'text-gray-400'}`}
            title="Settings"
          >
            ⚙
          </button>
          <button onClick={() => window.api.minimize()} className="icon-btn text-gray-400" title="Minimize">
            —
          </button>
          <button onClick={() => window.api.close()} className="icon-btn text-red-400" title="Close">
            ✕
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="error-banner text-xs px-3 py-1 text-red-300 bg-red-900/60 flex-shrink-0">
          ⚠ {error}
        </div>
      )}

      {/* Rate limit banner */}
      {rlCountdown > 0 && (
        <div className="text-xs px-3 py-1 text-yellow-300 bg-yellow-900/60 flex-shrink-0">
          ⏳ Rate limited -- resuming in {Math.floor(rlCountdown / 60)}:{String(rlCountdown % 60).padStart(2, '0')}
        </div>
      )}

      <div className="flex flex-col flex-1 min-h-0">
        {showSettings && settings ? (
          <Settings settings={settings} onUpdate={handleSettingsUpdate} />
        ) : (
          <Feed
            items={visibleItems}
            keywords={settings?.keywords ?? []}
            scrollSpeed={settings?.scrollSpeed ?? 30}
            onRemove={handleRemoveItem}
          />
        )}
      </div>
    </div>
  )
}
