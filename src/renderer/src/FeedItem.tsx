import { FeedItem as FeedItemType } from './types'

interface Props {
  item: FeedItemType
  keywords: string[]
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

export default function FeedItem({ item, keywords }: Props) {
  const hasKeyword = keywords.length > 0 &&
    keywords.some((k) => item.text.toLowerCase().includes(k.toLowerCase()))

  function handleClick() {
    if (item.url) window.api.openExternal(item.url)
  }

  const hasStats = (item.likes + item.retweets + item.replies) > 0

  return (
    <div
      className={`feed-item ${hasKeyword ? 'feed-item--alert' : ''} ${item.url ? 'feed-item--clickable' : ''}`}
      onClick={handleClick}
    >
      <div className="feed-item__header">
        <div className="flex items-center gap-1.5">
          {item.isRetweet && <span className="feed-item__type-badge feed-item__type-badge--rt">RT</span>}
          {item.isReply && !item.isRetweet && <span className="feed-item__type-badge feed-item__type-badge--reply">↩</span>}
          <span className="feed-item__handle">{item.handle}</span>
        </div>
        <span className="feed-item__time">{timeAgo(item.timestamp)}</span>
      </div>

      <div className="feed-item__text">{highlightKeywords(item.text, keywords)}</div>

      {item.photos.length > 0 && (
        <img
          src={item.photos[0]}
          alt=""
          className="feed-item__photo"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}

      {hasStats && (
        <div className="feed-item__stats">
          {item.likes > 0 && <span>♥ {fmtNum(item.likes)}</span>}
          {item.retweets > 0 && <span>🔁 {fmtNum(item.retweets)}</span>}
          {item.replies > 0 && <span>💬 {fmtNum(item.replies)}</span>}
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
