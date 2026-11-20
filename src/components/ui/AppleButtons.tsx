import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { triggerHaptic } from '../../services/telegram';
import { getContrastForeground } from '../../context/ThemeContext';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

export interface AppleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isDarkTheme?: boolean;
  accentColor?: string;
}

export const AppleButtonPrimary: React.FC<AppleButtonProps> = ({
  children,
  className,
  isDarkTheme,
  accentColor,
  onClick,
  disabled,
  type = 'button',
  style,
  ...rest
}) => {
  const bg = accentColor ?? (isDarkTheme === undefined ? 'var(--accent-focus)' : isDarkTheme ? '#0071E3' : '#0066CC');
  const fg = accentColor
    ? HEX_COLOR_RE.test(accentColor.trim())
      ? getContrastForeground(accentColor)
      : 'var(--accent-fg, #FFFFFF)'
    : 'var(--accent-fg, #FFFFFF)';

  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      onClick={(e) => {
        if (!disabled) {
          triggerHaptic('impact', 'light');
          onClick?.(e);
        }
      }}
      className={clsx(
        'h-[44px] rounded-full px-[22px] py-[11px] inline-flex items-center justify-center gap-2 text-s-15 font-semibold select-none cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed',
        className,
      )}
      style={{ backgroundColor: bg, color: fg, ...style }}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </motion.button>
  );
};

export const AppleButtonSecondaryPill: React.FC<AppleButtonProps> = ({
  children,
  className,
  isDarkTheme,
  accentColor,
  onClick,
  disabled,
  type = 'button',
  style,
  ...rest
}) => {
  const color = accentColor ?? (isDarkTheme === undefined ? 'var(--accent)' : isDarkTheme ? '#2997FF' : '#0066CC');

  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      onClick={(e) => {
        if (!disabled) {
          triggerHaptic('impact', 'light');
          onClick?.(e);
        }
      }}
      className={clsx(
        'h-[44px] rounded-full px-[22px] py-[11px] inline-flex items-center justify-center gap-2 text-s-15 font-semibold border bg-transparent select-none cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed',
        className,
      )}
      style={{ borderColor: color, color, ...style }}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </motion.button>
  );
};

export const AppleButtonUtility: React.FC<AppleButtonProps> = ({
  children,
  className,
  isDarkTheme,
  onClick,
  disabled,
  type = 'button',
  style,
  ...rest
}) => {
  const bg = isDarkTheme === undefined ? 'var(--card)' : isDarkTheme ? '#2A2A2C' : '#1D1D1F';

  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      onClick={(e) => {
        if (!disabled) {
          triggerHaptic('impact', 'light');
          onClick?.(e);
        }
      }}
      className={clsx(
        'h-[34px] rounded-[8px] px-3 inline-flex items-center justify-center gap-1.5 text-s-13 font-semibold text-white select-none cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed',
        className,
      )}
      style={{ backgroundColor: bg, ...style }}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </motion.button>
  );
};
