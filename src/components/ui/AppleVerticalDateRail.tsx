import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { triggerHaptic } from '../../services/telegram';
import { computeRelativeLuminance } from '../../context/ThemeContext';
import { colorWithAlpha } from './LiquidGlassSurface';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

export interface AppleVerticalDateRailProps {
  days: number[];
  weekDays: string[];
  selectedDayIndex: number;
  onDaySelected: (index: number) => void;
  todayIndex?: number;
  isDarkTheme?: boolean;
  selectedColor?: string;
  isVisible: boolean;
  onVisibilityChange: (visible: boolean) => void;
  className?: string;
}

export const AppleVerticalDateRail: React.FC<AppleVerticalDateRailProps> = ({
  days,
  weekDays,
  selectedDayIndex,
  onDaySelected,
  todayIndex = 7,
  isDarkTheme = true,
  selectedColor,
  isVisible,
  onVisibilityChange,
  className,
}) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const restoreSwipeRef = useRef<{ x: number; y: number } | null>(null);

  const rawAccent = selectedColor ?? (isDarkTheme ? '#2997FF' : '#0066CC');
  const accent =
    HEX_COLOR_RE.test(rawAccent.trim()) &&
    ((!isDarkTheme && computeRelativeLuminance(rawAccent) > 0.5) ||
      (isDarkTheme && computeRelativeLuminance(rawAccent) < 0.08))
      ? isDarkTheme
        ? '#FFFFFF'
        : '#1D1D1F'
      : rawAccent;

  // Auto-scroll smoothly so (selectedDayIndex - 3) sits near top
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const targetIdx = Math.max(0, selectedDayIndex - 3);
    const targetTop = targetIdx * 62;
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ top: targetTop, behavior: 'smooth' });
    } else {
      el.scrollTop = targetTop;
    }
  }, [selectedDayIndex]);

  const handleRailPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleRailPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
    if (!swipeStartRef.current || !isVisible) return;
    const dx = e.clientX - swipeStartRef.current.x;
    const dy = e.clientY - swipeStartRef.current.y;
    if (dx > 25 && Math.abs(dx) > Math.abs(dy)) {
      swipeStartRef.current = null;
      triggerHaptic('impact', 'light');
      onVisibilityChange(false);
    }
  };

  const clearRailSwipe: React.PointerEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
    swipeStartRef.current = null;
  };

  const handleRestorePointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
    restoreSwipeRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleRestorePointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
    if (!restoreSwipeRef.current || isVisible) return;
    const dx = e.clientX - restoreSwipeRef.current.x;
    const dy = e.clientY - restoreSwipeRef.current.y;
    if (dx < -25 && Math.abs(dx) > Math.abs(dy)) {
      restoreSwipeRef.current = null;
      triggerHaptic('impact', 'light');
      onVisibilityChange(true);
    }
  };

  const clearRestoreSwipe: React.PointerEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
    restoreSwipeRef.current = null;
  };

  return (
    <>
      <motion.div
        animate={{ width: isVisible ? 50 : 0, x: isVisible ? 0 : 80, opacity: isVisible ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        onPointerDown={handleRailPointerDown}
        onPointerMove={handleRailPointerMove}
        onPointerUp={clearRailSwipe}
        onPointerCancel={clearRailSwipe}
        className={clsx(
          'h-full shrink-0 relative bg-transparent select-none overflow-hidden',
          !isVisible && 'pointer-events-none',
          className,
        )}
        style={{
          maskImage:
            'linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)',
        }}
      >
        <div
          ref={listRef}
          className="w-[50px] h-full overflow-y-auto no-scrollbar py-6 flex flex-col items-center gap-[10px]"
        >
          {days.map((dayNum, index) => {
            const isSelected = index === selectedDayIndex;
            const isToday = index === todayIndex;
            const wd = (weekDays[index] ?? '').toUpperCase();

            const wdColor = isSelected
              ? colorWithAlpha(accent, 0.85)
              : isDarkTheme
                ? 'rgba(255, 255, 255, 0.25)'
                : 'rgba(0, 0, 0, 0.22)';

            const dayColor = isSelected
              ? accent
              : isDarkTheme
                ? 'rgba(255, 255, 255, 0.40)'
                : 'rgba(0, 0, 0, 0.35)';

            return (
              <motion.button
                key={`${index}-${dayNum}`}
                type="button"
                aria-label={`${wd} ${dayNum}`}
                aria-pressed={isSelected}
                animate={{ scale: isSelected ? 1.18 : 1 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                onClick={() => {
                  triggerHaptic('selection');
                  onDaySelected(index);
                }}
                className="w-[46px] h-[52px] shrink-0 flex flex-col items-center justify-center bg-transparent border-0 p-0 cursor-pointer"
              >
                <span
                  style={{
                    fontSize: isSelected
                      ? 'calc(11px * var(--text-scale, 1))'
                      : 'calc(9.5px * var(--text-scale, 1))',
                    fontWeight: isSelected ? 700 : 400,
                    letterSpacing: '0.4px',
                    lineHeight: 1.1,
                    color: wdColor,
                  }}
                >
                  {wd}
                </span>
                <span
                  style={{
                    fontSize: isSelected
                      ? 'calc(22px * var(--text-scale, 1))'
                      : 'calc(16px * var(--text-scale, 1))',
                    fontWeight: isSelected ? 700 : 400,
                    letterSpacing: '-0.4px',
                    lineHeight: 1.15,
                    color: dayColor,
                  }}
                >
                  {dayNum}
                </span>
                {isToday && (
                  <span
                    className="mt-[2px] rounded-full"
                    style={{
                      width: isSelected ? '4.5px' : '3.5px',
                      height: isSelected ? '4.5px' : '3.5px',
                      backgroundColor: isSelected ? accent : dayColor,
                    }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {!isVisible && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Показать календарь дней"
          onPointerDown={handleRestorePointerDown}
          onPointerMove={handleRestorePointerMove}
          onPointerUp={clearRestoreSwipe}
          onPointerCancel={clearRestoreSwipe}
          onClick={() => {
            triggerHaptic('impact', 'light');
            onVisibilityChange(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              triggerHaptic('impact', 'light');
              onVisibilityChange(true);
            }
          }}
          className="absolute right-0 top-0 bottom-0 w-[48px] z-20 flex items-center justify-end cursor-pointer"
        >
          <div
            className="w-[4px] h-[48px] mr-1 rounded-full"
            style={{
              backgroundColor: isDarkTheme ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.25)',
            }}
          />
        </div>
      )}
    </>
  );
};
