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

  // Keep a ref so callbacks always see latest items without stale closure
  const itemsRef = useRef<FeedItem[]>([])
  // Tick every 30s to re-apply age filter
  const [tick, setTick] = useState(0)

  useEffect(() => {
    window.api.getSettings().then((s) => {
      setSettings(s)
      setPinned(s.alwaysOnTop)
    })

    const removeFeed = window.api.onFeedItem((item) => {
      // Avoid duplicates
      if (itemsRef.current.some((i) => i.id === item.id)) return
      itemsRef.current = [...itemsRef.current, item].slice(-300)
      setItems([...itemsRef.current])
    })

    const removeErr = window.api.onFeedError((msg) => {
      setError(msg)
      setTimeout(() => setError(null), 6000)
    })

    const tickInterval = setInterval(() => setTick((t) => t + 1), 30_000)

    return () => {
      removeFeed()
      removeErr()
      clearInterval(tickInterval)
    }
  }, [])

  // Newest-first, filtered by maxAge
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

  return (
    <div className="app-root flex flex-col h-screen select-none" style={{ borderRadius: 10, overflow: 'hidden' }}>
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

      {/* Main content */}
      <div className="flex flex-col flex-1 min-h-0">
        {showSettings && settings ? (
          <Settings settings={settings} onUpdate={handleSettingsUpdate} />
        ) : (
          <Feed
            items={visibleItems}
            keywords={settings?.keywords ?? []}
            scrollSpeed={settings?.scrollSpeed ?? 30}
          />
        )}
      </div>
    </div>
  )
}
