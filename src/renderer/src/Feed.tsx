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
  const [canLoop, setCanLoop] = useState(false)

  const pausedRef = useRef(false)
  const speedRef = useRef(scrollSpeed)
  const autoScrollRef = useRef(autoScroll)
  const posRef = useRef(0)
  const prevHalfRef = useRef(0)
  const canLoopRef = useRef(false)

  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => { speedRef.current = scrollSpeed }, [scrollSpeed])

  // Measure whether a single copy of the content is tall enough for infinite looping.
  // When it isn't, we fall back to native scrolling instead of blocking all interaction.
  useEffect(() => {
    const container = containerRef.current
    const inner = innerRef.current
    if (!container || !inner) return

    const ro = new ResizeObserver(() => {
      const singleCopyHeight = canLoopRef.current
        ? inner.scrollHeight / 2
        : inner.scrollHeight
      const shouldLoop = singleCopyHeight > container.clientHeight
      if (shouldLoop !== canLoopRef.current) {
        canLoopRef.current = shouldLoop
        if (!shouldLoop) {
          posRef.current = 0
          prevHalfRef.current = 0
          inner.style.transform = ''
        }
        setCanLoop(shouldLoop)
      }
    })

    ro.observe(container)
    ro.observe(inner)
    return () => ro.disconnect()
  }, [])

  // When autoScroll is re-enabled, reset scroll position to avoid jumps
  useEffect(() => {
    autoScrollRef.current = autoScroll
    if (autoScroll) {
      posRef.current = 0
      prevHalfRef.current = 0
      if (innerRef.current) innerRef.current.style.transform = 'translateY(0)'
    }
  }, [autoScroll])

  // When new items arrive, compensate posRef so the visible content doesn't jump
  useEffect(() => {
    const inner = innerRef.current
    if (!inner || !autoScrollRef.current || !canLoopRef.current) return
    const newHalf = inner.scrollHeight / 2
    if (prevHalfRef.current > 0 && newHalf > prevHalfRef.current) {
      posRef.current += newHalf - prevHalfRef.current
    }
    prevHalfRef.current = newHalf
  }, [items])

  // Single RAF loop for the lifetime of the component — reads refs dynamically each frame
  useEffect(() => {
    let raf: number
    let last = 0

    function step(ts: number) {
      const container = containerRef.current
      const inner = innerRef.current
      const rawDelta = last ? (ts - last) / 1000 : 0
      const delta = Math.min(rawDelta, 0.05) // cap at 50ms — survives minimize/restore
      last = ts

      if (container && inner && autoScrollRef.current && !pausedRef.current && canLoopRef.current) {
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

  const isEmpty = items.length === 0
  // When content is too short for infinite loop, fall back to native scrolling
  const looping = autoScroll && canLoop

  return (
    <div
      ref={containerRef}
      className={`feed-scroll${!looping ? ' feed-scroll--static' : ''}`}
      onMouseEnter={looping ? () => setPaused(true) : undefined}
      onMouseLeave={looping ? () => setPaused(false) : undefined}
      onWheel={looping ? handleWheel : undefined}
    >
      {paused && looping && <div className="feed-paused-badge">PAUSED</div>}
      <div ref={innerRef} className="py-1">
        {isEmpty ? (
          <div className="feed-empty">
            <p className="text-base mb-1">No tweets yet</p>
            <p className="text-xs text-gray-500">Add accounts and configure your API key in Settings.</p>
          </div>
        ) : (
          <>
            {items.map((item) => (
              <FeedItemComponent key={item.id} item={item} keywords={keywords} onRemove={onRemove ? () => onRemove(item.id) : undefined} />
            ))}
            {looping && items.map((item) => (
              <FeedItemComponent key={`dup-${item.id}`} item={item} keywords={keywords} onRemove={onRemove ? () => onRemove(item.id) : undefined} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
