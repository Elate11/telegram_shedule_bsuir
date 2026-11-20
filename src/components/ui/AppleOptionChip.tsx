import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { triggerHaptic } from '../../services/telegram';
import { getContrastForeground } from '../../context/ThemeContext';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

export interface AppleOptionChipProps {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  isDarkTheme?: boolean;
  accentColor?: string;
  unselectedBg?: string;
  unselectedTextColor?: string;
  selectedTextColor?: string;
  borderColorOverride?: string;
  className?: string;
}

export const AppleOptionChip: React.FC<AppleOptionChipProps> = ({
  label,
  isSelected,
  onClick,
  isDarkTheme,
  accentColor,
  unselectedBg,
  unselectedTextColor,
  selectedTextColor,
  borderColorOverride,
  className,
}) => {
  const bg = isSelected
    ? (accentColor ?? 'var(--accent)')
    : (unselectedBg ?? (isDarkTheme === undefined ? 'var(--card)' : isDarkTheme ? '#2A2A2C' : '#FFFFFF'));

  const defaultSelectedFg =
    accentColor && HEX_COLOR_RE.test(accentColor.trim())
      ? getContrastForeground(accentColor)
      : 'var(--accent-fg, #FFFFFF)';

  const textColor = isSelected
    ? (selectedTextColor ?? defaultSelectedFg)
    : (unselectedTextColor ?? (isDarkTheme === undefined ? 'var(--text)' : isDarkTheme ? '#FFFFFF' : '#1D1D1F'));

  const borderColor = isSelected ? 'transparent' : (borderColorOverride ?? 'transparent');

  return (
    <motion.button
      type="button"
      aria-pressed={isSelected}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      onClick={() => {
        triggerHaptic('selection');
        onClick();
      }}
      className={clsx(
        'rounded-full px-4 py-[9px] text-s-14 leading-[1.28] tracking-[-0.2px] font-semibold border whitespace-nowrap cursor-pointer select-none transition-colors',
        className,
      )}
      style={{
        backgroundColor: bg,
        color: textColor,
        borderColor,
      }}
    >
      {label}
    </motion.button>
  );
};
