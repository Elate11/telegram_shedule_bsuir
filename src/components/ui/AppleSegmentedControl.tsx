import React, { useId } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { triggerHaptic } from '../../services/telegram';
import { computeRelativeLuminance } from '../../context/ThemeContext';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

export interface AppleSegmentedControlProps {
  items: string[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  isDarkTheme?: boolean;
  accentColor?: string;
  trackColor?: string;
  className?: string;
}

export const AppleSegmentedControl: React.FC<AppleSegmentedControlProps> = ({
  items,
  selectedIndex,
  onSelectIndex,
  isDarkTheme,
  accentColor,
  trackColor,
  className,
}) => {
  const layoutId = useId();
  const resolvedDark =
    isDarkTheme ??
    (typeof document !== 'undefined' ? document.documentElement.dataset.theme !== 'light' : true);

  const trackBg =
    trackColor ?? (isDarkTheme === undefined ? 'var(--track)' : isDarkTheme ? '#1C1C1E' : '#E5E5EA');
  const thumbBg = isDarkTheme === undefined ? 'var(--thumb)' : isDarkTheme ? '#2C2C2E' : '#FFFFFF';

  const resolvedAccentColor = (() => {
    if (!accentColor) return undefined;
    const trimmed = accentColor.trim();
    if (!HEX_COLOR_RE.test(trimmed)) return accentColor;
    const lum = computeRelativeLuminance(trimmed);
    if (!resolvedDark && lum > 0.5) return '#1D1D1F';
    if (resolvedDark && lum < 0.08) return '#FFFFFF';
    return accentColor;
  })();

  const activeColor =
    resolvedAccentColor ?? (isDarkTheme === undefined ? 'var(--text)' : isDarkTheme ? '#FFFFFF' : '#1D1D1F');
  const inactiveColor =
    isDarkTheme === undefined
      ? 'var(--text-muted)'
      : isDarkTheme
        ? 'rgba(255, 255, 255, 0.55)'
        : '#7A7A7A';

  return (
    <div
      role="tablist"
      className={clsx('h-[38px] w-full rounded-[10px] p-[2px] flex items-center relative select-none', className)}
      style={{ backgroundColor: trackBg }}
    >
      {items.map((label, idx) => {
        const isSelected = idx === selectedIndex;
        return (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => {
              if (idx !== selectedIndex) {
                triggerHaptic('selection');
                onSelectIndex(idx);
              }
            }}
            className="flex-1 h-full relative flex items-center justify-center z-10 text-s-13 whitespace-nowrap cursor-pointer px-2"
            style={{
              color: isSelected ? activeColor : inactiveColor,
              fontWeight: isSelected ? 600 : 400,
            }}
          >
            {isSelected && (
              <motion.div
                layoutId={`apple-seg-thumb-${layoutId}`}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="absolute inset-0 rounded-[8px] shadow-[0_2px_6px_rgba(0,0,0,0.12)] -z-10"
                style={{ backgroundColor: thumbBg }}
              />
            )}
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
};
