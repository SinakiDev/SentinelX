import { useEffect, useRef, useState } from 'react'
import { FeedItem as FeedItemType } from './types'
import FeedItemComponent from './FeedItem'

interface Props {
  items: FeedItemType[]
  keywords: string[]
  scrollSpeed: number
}

export default function Feed({ items, keywords, scrollSpeed }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)

  const pausedRef = useRef(false)
  const speedRef = useRef(scrollSpeed)
  const posRef = useRef(0)
  const prevLengthRef = useRef(0)

  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => { speedRef.current = scrollSpeed }, [scrollSpeed])

  useEffect(() => {
    const container = containerRef.current
    const inner = innerRef.current
    if (!container || !inner) return

    let raf: number
    let last = 0

    function step(ts: number) {
      const delta = last ? (ts - last) / 1000 : 0
      last = ts

      if (!pausedRef.current) {
        const half = inner.scrollHeight / 2
        if (half > container.clientHeight) {
          posRef.current += speedRef.current * delta
          if (posRef.current >= half) posRef.current -= half
          inner.style.transform = `translateY(-${posRef.current}px)`
        }
      }

      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (items.length > prevLengthRef.current && !pausedRef.current) {
      posRef.current = 0
      if (innerRef.current) innerRef.current.style.transform = 'translateY(0)'
    }
    prevLengthRef.current = items.length
  }, [items.length])

  function handleWheel(e: React.WheelEvent) {
    const container = containerRef.current
    const inner = innerRef.current
    if (!container || !inner) return
    const half = inner.scrollHeight / 2
    if (half <= container.clientHeight) return
    posRef.current = Math.max(0, Math.min(half - 1, posRef.current + e.deltaY))
    inner.style.transform = `translateY(-${posRef.current}px)`
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
              <FeedItemComponent key={item.id} item={item} keywords={keywords} />
            ))}
            {items.map((item) => (
              <FeedItemComponent key={`dup-${item.id}`} item={item} keywords={keywords} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
