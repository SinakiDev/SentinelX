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

function highlightKeywords(text: string, keywords: string[]): React.ReactNode {
  if (!keywords.length) return text
  const pattern = new RegExp(`(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts = text.split(pattern)
  return parts.map((part, i) =>
    pattern.test(part) ? (
      <mark key={i} className="keyword-match">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

export default function FeedItem({ item, keywords }: Props) {
  const hasKeyword = keywords.length > 0 &&
    keywords.some((k) => item.text.toLowerCase().includes(k.toLowerCase()))

  return (
    <div className={`feed-item ${hasKeyword ? 'feed-item--alert' : ''}`}>
      <div className="feed-item__header">
        <span className="feed-item__handle">{item.handle}</span>
        <span className="feed-item__time">{timeAgo(item.timestamp)}</span>
      </div>
      <div className="feed-item__text">{highlightKeywords(item.text, keywords)}</div>
      {hasKeyword && (
        <div className="feed-item__badge">
          ⚠ {keywords.filter((k) => item.text.toLowerCase().includes(k.toLowerCase())).join(', ')}
        </div>
      )}
    </div>
  )
}
