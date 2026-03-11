import { useState, useRef, useEffect } from 'react'

interface Props {
  onResults: (query: string, results: import('./types').FeedItem[]) => void
  onClose: () => void
}

export default function SearchBar({ onResults, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSearch() {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    try {
      const { results, error: err } = await window.api.searchTweets(q)
      if (err) { setError(err); return }
      onResults(q, results)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="search-bar">
      <input
        ref={inputRef}
        className="search-bar__input"
        placeholder="Search latest tweets..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSearch()
          if (e.key === 'Escape') onClose()
        }}
        disabled={loading}
      />
      <button
        className="search-bar__btn"
        onClick={handleSearch}
        disabled={loading || !query.trim()}
      >
        {loading ? '…' : '↵'}
      </button>
      <button className="search-bar__close" onClick={onClose} title="Close search">✕</button>
      {error && <div className="search-bar__error">{error}</div>}
    </div>
  )
}
