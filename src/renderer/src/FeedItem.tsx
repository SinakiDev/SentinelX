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

  async function handleTranslate(e: React.MouseEvent) {
    e.stopPropagation()
    if (translated) { setTranslated(null); return }
    setTranslating(true)
    const result = await window.api.translateText(item.text)
    setTranslated(result || '(translation failed)')
    setTranslating(false)
  }

  function handleView(e: React.MouseEvent) {
    e.stopPropagation()
    if (item.url) window.api.openExternal(item.url)
  }

  const photos = item.photos ?? []
  const likes = item.likes ?? 0
  const retweets = item.retweets ?? 0
  const replies = item.replies ?? 0
  const isRetweet = item.isRetweet ?? false
  const isReply = item.isReply ?? false
  const hasStats = (likes + retweets + replies) > 0

  return (
    <div className={`feed-item ${hasKeyword ? 'feed-item--alert' : ''}`}>
      {/* Header: badge + author | time + remove */}
      <div className="feed-item__header">
        <div className="flex items-center gap-2">
          {isRetweet ? (
            <span className="feed-item__type-badge feed-item__type-badge--rt">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7l-4 4h3v7h4v-7h3L7 7zm10 10l4-4h-3V6h-4v7h-3l6 6z"/></svg>
              RT
            </span>
          ) : isReply ? (
            <span className="feed-item__type-badge feed-item__type-badge--reply">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
              REPLY
            </span>
          ) : (
            <span className="feed-item__type-badge feed-item__type-badge--post">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M5.41 21L6.12 17H2.12L2.47 15H6.47L7.53 9H3.53L3.88 7H7.88L8.59 3H10.59L9.88 7H15.88L16.59 3H18.59L17.88 7H21.88L21.53 9H17.53L16.47 15H20.47L20.12 17H16.12L15.41 21H13.41L14.12 17H8.12L7.41 21H5.41ZM9.53 9L8.47 15H14.47L15.53 9H9.53Z"/></svg>
              POST
            </span>
          )}
          <div className="flex flex-col">
            <span className="feed-item__name">{item.name || item.handle}</span>
            <span className="feed-item__handle">{item.handle.startsWith('@') ? item.handle : `@${item.handle}`}</span>
          </div>
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

      {/* Content */}
      <div className="feed-item__text">{highlightKeywords(item.text, keywords)}</div>

      {/* Translation */}
      {translated && (
        <div className="feed-item__translated">{translated}</div>
      )}

      {/* Photos */}
      {photos.length > 0 && (
        <img
          src={photos[0]}
          alt=""
          className="feed-item__photo"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}

      {/* Stats */}
      {hasStats && (
        <div className="feed-item__stats">
          {likes > 0 && <span>{fmtNum(likes)} likes</span>}
          {retweets > 0 && <span>{fmtNum(retweets)} RTs</span>}
          {replies > 0 && <span>{fmtNum(replies)} replies</span>}
        </div>
      )}

      {/* Keyword alert */}
      {hasKeyword && (
        <div className="feed-item__badge">
          {keywords.filter((k) => item.text.toLowerCase().includes(k.toLowerCase())).join(', ')}
        </div>
      )}

      {/* Footer: translate + view */}
      <div className="feed-item__footer">
        <button
          className="feed-item__translate-btn"
          onClick={handleTranslate}
          disabled={translating}
        >
          {translating ? '...' : translated ? 'Hide translation' : 'Translate'}
        </button>
        {item.url && (
          <button className="feed-item__view-link" onClick={handleView}>
            View
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7zm-2 16H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7H12z"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
