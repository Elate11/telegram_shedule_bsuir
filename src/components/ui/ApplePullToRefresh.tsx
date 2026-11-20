import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { triggerHaptic } from '../../services/telegram';

export interface ApplePullToRefreshProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  isRefreshing: boolean;
  onRefresh: () => void;
  accentColor?: string;
  indicatorColor?: string;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  children: React.ReactNode;
}

const TRIGGER_DISTANCE = 70;
const MAX_PULL_DISTANCE = 120;
const RUBBER_BAND = 0.45;
const SAFETY_TIMEOUT_MS = 2500;

export const ApplePullToRefresh: React.FC<ApplePullToRefreshProps> = ({
  isRefreshing,
  onRefresh,
  accentColor = 'var(--accent)',
  indicatorColor,
  scrollContainerRef,
  className,
  children,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  ...rest
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastYRef = useRef(0);
  const thresholdCrossedRef = useRef(false);

  useEffect(() => {
    if (!isRefreshing) {
      setTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setTimedOut(true);
      setPullDistance(0);
    }, SAFETY_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [isRefreshing]);

  const effectiveRefreshing = isRefreshing && !timedOut;
  const headerHeight = effectiveRefreshing ? 56 : Math.min(pullDistance, 110);
  const resolvedColor = indicatorColor ?? accentColor;

  const getScrollTop = (): number => {
    if (scrollContainerRef?.current) return scrollContainerRef.current.scrollTop;
    return containerRef.current?.scrollTop ?? 0;
  };

  const handleTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (effectiveRefreshing || e.touches.length === 0) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    lastYRef.current = t.clientY;
    thresholdCrossedRef.current = false;
  };

  const handleTouchMove: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (effectiveRefreshing || !touchStartRef.current || e.touches.length === 0) return;
    const t = e.touches[0];
    const totalDx = t.clientX - touchStartRef.current.x;
    const totalDy = t.clientY - touchStartRef.current.y;
    const deltaY = t.clientY - lastYRef.current;
    lastYRef.current = t.clientY;

    if (getScrollTop() > 0) return;
    if (totalDy <= 0 || Math.abs(totalDy) <= Math.abs(totalDx) * 1.5) return;

    setPullDistance((prev) => {
      const next = Math.max(0, Math.min(MAX_PULL_DISTANCE, prev + deltaY * RUBBER_BAND));
      if (next >= TRIGGER_DISTANCE && !thresholdCrossedRef.current) {
        thresholdCrossedRef.current = true;
        triggerHaptic('impact', 'light');
      } else if (next < TRIGGER_DISTANCE) {
        thresholdCrossedRef.current = false;
      }
      return next;
    });
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current) return;
    touchStartRef.current = null;
    if (pullDistance >= TRIGGER_DISTANCE && !effectiveRefreshing) {
      triggerHaptic('impact', 'light');
      onRefresh();
    }
    setPullDistance(0);
    thresholdCrossedRef.current = false;
  };

  const rotation = Math.max(0, Math.min(180, (pullDistance / TRIGGER_DISTANCE) * 180));
  const indicatorOpacity = effectiveRefreshing ? 1 : pullDistance >= TRIGGER_DISTANCE ? 1 : 0.5;

  return (
    <div
      ref={containerRef}
      {...rest}
      onTouchStart={(e) => {
        handleTouchStart(e);
        onTouchStart?.(e);
      }}
      onTouchMove={(e) => {
        handleTouchMove(e);
        onTouchMove?.(e);
      }}
      onTouchEnd={(e) => {
        handleTouchEnd();
        onTouchEnd?.(e);
      }}
      onTouchCancel={(e) => {
        handleTouchEnd();
        onTouchCancel?.(e);
      }}
      className={clsx('relative flex flex-col', className)}
    >
      <motion.div
        animate={{ height: headerHeight }}
        transition={{ type: 'spring', stiffness: 200, damping: 24 }}
        className="w-full overflow-hidden flex items-center justify-center shrink-0"
      >
        {(headerHeight > 8 || effectiveRefreshing) && (
          <div style={{ color: resolvedColor, opacity: indicatorOpacity }}>
            {effectiveRefreshing ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <RefreshCw
                size={24}
                style={{ transform: `rotate(${rotation.toFixed(0)}deg)` }}
              />
            )}
          </div>
        )}
      </motion.div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
};
