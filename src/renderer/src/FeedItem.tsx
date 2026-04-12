import { useState } from 'react'
import { FeedItem as FeedItemType } from './types'

interface Props {
  item: FeedItemType
  keywords: string[]
  onRemove?: () => void
}

function timeAgo(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp * 1000) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function highlightKeywords(text: string, keywords: string[]): React.ReactNode {
  if (!keywords.length) return text
  const pattern = new RegExp(`(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts = text.split(pattern)
  return parts.map((part, i) =>
    pattern.test(part) ? (
      <mark key={i} className="keyword-match">{part}</mark>
    ) : (
      part
    )
  )
}

export default function FeedItem({ item, keywords, onRemove }: Props) {
  const [translated, setTranslated] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)

  const hasKeyword = keywords.length > 0 &&
    keywords.some((k) => item.text.toLowerCase().includes(k.toLowerCase()))

  function handleClick() {
    if (item.url) window.api.openExternal(item.url)
  }

  async function handleTranslate(e: React.MouseEvent) {
    e.stopPropagation()
    if (translated) { setTranslated(null); return }
    setTranslating(true)
    const result = await window.api.translateText(item.text)
    setTranslated(result || '(translation failed)')
    setTranslating(false)
  }

  const photos = item.photos ?? []
  const likes = item.likes ?? 0
  const retweets = item.retweets ?? 0
  const replies = item.replies ?? 0
  const isRetweet = item.isRetweet ?? false
  const isReply = item.isReply ?? false
  const hasStats = (likes + retweets + replies) > 0

  return (
    <div
      className={`feed-item ${hasKeyword ? 'feed-item--alert' : ''} ${item.url ? 'feed-item--clickable' : ''}`}
      onClick={handleClick}
    >
      <div className="feed-item__header">
        <div className="flex items-center gap-1.5">
          {isRetweet && <span className="feed-item__type-badge feed-item__type-badge--rt">RT</span>}
          {isReply && !isRetweet && <span className="feed-item__type-badge feed-item__type-badge--reply">↩</span>}
          <span className="feed-item__handle">{item.handle}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="feed-item__time">{timeAgo(item.timestamp)}</span>
          {onRemove && (
            <button
              className="feed-item__remove"
              title="Dismiss"
              onClick={(e) => { e.stopPropagation(); onRemove() }}
            >✕</button>
          )}
        </div>
      </div>

      <div className="feed-item__text">{highlightKeywords(item.text, keywords)}</div>

      {translated && (
        <div className="feed-item__translated">{translated}</div>
      )}

      <button
        className="feed-item__translate-btn"
        onClick={handleTranslate}
        disabled={translating}
      >
        {translating ? '...' : translated ? 'Hide translation' : 'Translate'}
      </button>

      {photos.length > 0 && (
        <img
          src={photos[0]}
          alt=""
          className="feed-item__photo"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}

      {hasStats && (
        <div className="feed-item__stats">
          {likes > 0 && <span>♥ {fmtNum(likes)}</span>}
          {retweets > 0 && <span>🔁 {fmtNum(retweets)}</span>}
          {replies > 0 && <span>💬 {fmtNum(replies)}</span>}
        </div>
      )}

      {hasKeyword && (
        <div className="feed-item__badge">
          ⚠ {keywords.filter((k) => item.text.toLowerCase().includes(k.toLowerCase())).join(', ')}
        </div>
      )}
    </div>
  )
}
