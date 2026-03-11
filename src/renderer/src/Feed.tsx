import { useEffect, useRef, useState } from 'react'
import { FeedItem as FeedItemType } from './types'
import FeedItemComponent from './FeedItem'

interface Props {
  items: FeedItemType[]
  keywords: string[]
  scrollSpeed: number
  autoScroll?: boolean
  onRemove?: (id: string) => void
}

export default function Feed({ items, keywords, scrollSpeed, autoScroll = true, onRemove }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)

  const pausedRef = useRef(false)
  const speedRef = useRef(scrollSpeed)
  const posRef = useRef(0)
  const prevHalfRef = useRef(0)

  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => { speedRef.current = scrollSpeed }, [scrollSpeed])

  // When new items are prepended (newest-first sort), compensate posRef so the
  // visible content doesn't jump — add the extra height the new items introduced.
  useEffect(() => {
    const inner = innerRef.current
    if (!inner) return
    const newHalf = inner.scrollHeight / 2
    if (prevHalfRef.current > 0 && newHalf > prevHalfRef.current) {
      posRef.current += newHalf - prevHalfRef.current
    }
    prevHalfRef.current = newHalf
  }, [items])

  useEffect(() => {
    const container = containerRef.current
    const inner = innerRef.current
    if (!container || !inner) return

    let raf: number
    let last = 0

    function step(ts: number) {
      const rawDelta = last ? (ts - last) / 1000 : 0
      const delta = Math.min(rawDelta, 0.05) // cap at 50ms — survives minimize/restore
      last = ts

      if (!pausedRef.current) {
        const half = inner.scrollHeight / 2
        if (half > container.clientHeight) {
          posRef.current += speedRef.current * delta
          if (posRef.current >= half) posRef.current = posRef.current % half
          inner.style.transform = `translateY(-${posRef.current}px)`
        }
      }

      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  function handleWheel(e: React.WheelEvent) {
    const container = containerRef.current
    const inner = innerRef.current
    if (!container || !inner) return
    const half = inner.scrollHeight / 2
    if (half <= container.clientHeight) return
    posRef.current = Math.max(0, Math.min(half - 1, posRef.current + e.deltaY))
    inner.style.transform = `translateY(-${posRef.current}px)`
  }

  if (!autoScroll) {
    return (
      <div className="feed-scroll feed-scroll--static">
        {items.length === 0 ? (
          <div className="feed-empty">
            <p>No tweets yet.</p>
            <p className="text-xs mt-1 text-gray-500">Add accounts &amp; log in via ⚙ Settings.</p>
          </div>
        ) : (
          items.map((item) => (
            <FeedItemComponent key={item.id} item={item} keywords={keywords} onRemove={onRemove ? () => onRemove(item.id) : undefined} />
          ))
        )}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="feed-scroll"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onWheel={handleWheel}
    >
      {paused && <div className="feed-paused-badge">PAUSED</div>}
      <div ref={innerRef}>
        {items.length === 0 ? (
          <div className="feed-empty">
            <p>No tweets yet.</p>
            <p className="text-xs mt-1 text-gray-500">Add accounts &amp; log in via ⚙ Settings.</p>
          </div>
        ) : (
          <>
            {items.map((item) => (
              <FeedItemComponent key={item.id} item={item} keywords={keywords} onRemove={onRemove ? () => onRemove(item.id) : undefined} />
            ))}
            {items.map((item) => (
              <FeedItemComponent key={`dup-${item.id}`} item={item} keywords={keywords} onRemove={onRemove ? () => onRemove(item.id) : undefined} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
