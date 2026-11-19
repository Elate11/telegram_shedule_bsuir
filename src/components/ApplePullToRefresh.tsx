import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { Loader2, ArrowDown } from 'lucide-react'
import { haptic } from '../services/telegram'

interface ApplePullToRefreshProps {
  onRefresh: () => Promise<void> | void
  isRefreshing: boolean
  children: React.ReactNode
  accentColor?: string
  className?: string
}

export const ApplePullToRefresh: React.FC<ApplePullToRefreshProps> = ({
  onRefresh,
  isRefreshing,
  children,
  accentColor = '#6C63FF',
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPulling, setIsPulling] = useState(false)
  const startYRef = useRef(0)
  const isDraggingRef = useRef(false)
  const currentPullRef = useRef(0)

  const pullY = useMotionValue(0)
  const springPullY = useSpring(pullY, { stiffness: 260, damping: 25 })
  const rotation = useTransform(pullY, [0, 70], [0, 180])

  // Watchdog timer: under ANY circumstances, pull-to-refresh will dismiss after 2.5s
  useEffect(() => {
    if (isRefreshing) {
      const timer = setTimeout(() => {
        pullY.set(0)
      }, 2500)
      return () => clearTimeout(timer)
    } else {
      pullY.set(0)
      setIsPulling(false)
    }
  }, [isRefreshing, pullY])

  // Synchronize refreshing state with offset
  useEffect(() => {
    if (isRefreshing) {
      pullY.set(56)
    }
  }, [isRefreshing, pullY])

  const handleTouchStart = (e: React.TouchEvent) => {
    const el = containerRef.current
    // Only allow pull if user is strictly at the top of scroll
    if (el && el.scrollTop <= 0) {
      startYRef.current = e.touches[0].clientY
      isDraggingRef.current = true
    } else {
      isDraggingRef.current = false
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || isRefreshing) return
    const el = containerRef.current
    if (el && el.scrollTop > 0) {
      isDraggingRef.current = false
      pullY.set(0)
      return
    }

    const currentY = e.touches[0].clientY
    const diff = currentY - startYRef.current

    // Only allow downward drag
    if (diff > 0) {
      // Resistance curve
      const pull = Math.min(diff * 0.45, 110)
      currentPullRef.current = pull
      pullY.set(pull)
      setIsPulling(true)

      if (pull >= 70 && currentPullRef.current < 70) {
        haptic.click()
      }
    } else {
      pullY.set(0)
      setIsPulling(false)
    }
  }

  const handleTouchEnd = useCallback(async () => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false

    const finalPull = pullY.get()
    if (finalPull >= 70 && !isRefreshing) {
      haptic.medium()
      pullY.set(56)
      await onRefresh()
    } else {
      pullY.set(0)
      setIsPulling(false)
    }
  }, [isRefreshing, onRefresh, pullY])

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative w-full h-full overflow-y-auto overscroll-y-contain ${className}`}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Indicator */}
      <motion.div
        className="w-full flex items-center justify-center pointer-events-none absolute top-0 left-0 z-20"
        style={{
          height: springPullY,
          opacity: useTransform(springPullY, [0, 20, 56], [0, 0.4, 1])
        }}
      >
        {isRefreshing ? (
          <Loader2
            className="w-6 h-6 animate-spin"
            style={{ color: accentColor }}
          />
        ) : (
          <motion.div style={{ rotate: rotation }}>
            <ArrowDown
              className="w-6 h-6"
              style={{
                color: isPulling ? accentColor : 'rgba(255, 255, 255, 0.5)'
              }}
            />
          </motion.div>
        )}
      </motion.div>

      {/* Content */}
      <motion.div
        style={{ y: springPullY }}
        className="w-full min-h-full"
      >
        {children}
      </motion.div>
    </div>
  )
}
