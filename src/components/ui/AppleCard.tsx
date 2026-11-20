import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { triggerHaptic } from '../../services/telegram';

export interface AppleCardProps {
  children: React.ReactNode;
  className?: string;
  isDarkTheme?: boolean;
  cardBg?: string;
  cardBorder?: string;
  hasProductShadow?: boolean;
  onClick?: () => void;
  onLongClick?: () => void;
}

export const AppleCard: React.FC<AppleCardProps> = ({
  children,
  className,
  isDarkTheme,
  cardBg,
  cardBorder,
  hasProductShadow = false,
  onClick,
  onLongClick,
}) => {
  const longTimerRef = useRef<number | null>(null);
  const longTriggeredRef = useRef(false);

  const clearLongTimer = () => {
    if (longTimerRef.current !== null) {
      window.clearTimeout(longTimerRef.current);
      longTimerRef.current = null;
    }
  };

  const bg = cardBg ?? (isDarkTheme === undefined ? 'var(--card)' : isDarkTheme ? '#272729' : '#FFFFFF');
  const border =
    cardBorder ??
    (isDarkTheme === undefined
      ? 'var(--border)'
      : isDarkTheme
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(0, 0, 0, 0.12)');

  const sharedClass = clsx(
    'rounded-[18px] p-[18px] border transition-colors',
    hasProductShadow && 'shadow-[0_4px_12px_rgba(0,0,0,0.18)]',
    onClick && 'cursor-pointer select-none',
    className,
  );

  const sharedStyle: React.CSSProperties = {
    backgroundColor: bg,
    borderColor: border,
  };

  if (!onClick && !onLongClick) {
    return (
      <div className={sharedClass} style={sharedStyle}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      onPointerDown={() => {
        if (!onLongClick) return;
        longTriggeredRef.current = false;
        clearLongTimer();
        longTimerRef.current = window.setTimeout(() => {
          longTriggeredRef.current = true;
          triggerHaptic('impact', 'medium');
          onLongClick();
        }, 480);
      }}
      onPointerUp={clearLongTimer}
      onPointerCancel={clearLongTimer}
      onPointerLeave={clearLongTimer}
      onClick={() => {
        if (longTriggeredRef.current) {
          longTriggeredRef.current = false;
          return;
        }
        if (onClick) {
          triggerHaptic('impact', 'light');
          onClick();
        }
      }}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          triggerHaptic('impact', 'light');
          onClick();
        }
      }}
      className={sharedClass}
      style={sharedStyle}
    >
      {children}
    </motion.div>
  );
};
