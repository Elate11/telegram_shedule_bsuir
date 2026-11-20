import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { triggerHaptic } from '../../services/telegram';
import { colorWithAlpha } from './LiquidGlassSurface';

export interface BottomNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

export interface BottomNavBarProps {
  items: BottomNavItem[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  accentColor?: string;
  className?: string;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  items,
  selectedIndex,
  onSelectIndex,
  accentColor = '#2997FF',
  className,
}) => {
  const count = Math.max(1, items.length);
  const pillBg = colorWithAlpha(accentColor, 0.22);

  return (
    <nav
      aria-label="Основная навигация"
      className={clsx('px-6 pb-[calc(12px+var(--tg-safe-bottom))] flex flex-col items-center select-none', className)}
    >
      <div className="relative w-full h-[72px] flex items-center">
        {/* Sliding pill behind active tab */}
        <motion.div
          aria-hidden="true"
          animate={{
            left: `calc(${(selectedIndex / count) * 100}% + ${(100 / count) * 0.5}% - 32px)`,
          }}
          transition={{ type: 'spring', stiffness: 200, damping: 14 }}
          className="absolute top-1/2 -translate-y-1/2 w-[64px] h-[48px] rounded-[24px] pointer-events-none"
          style={{ backgroundColor: pillBg }}
        />

        {items.map((item, index) => {
          const Icon = item.icon;
          const isSelected = index === selectedIndex;
          return (
            <motion.button
              key={item.id}
              type="button"
              aria-label={item.label}
              aria-current={isSelected ? 'page' : undefined}
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                if (index !== selectedIndex) {
                  triggerHaptic('selection');
                }
                onSelectIndex(index);
              }}
              className="flex-1 h-full flex items-center justify-center z-10 bg-transparent border-0 p-0 cursor-pointer"
              style={{
                color: isSelected ? 'var(--text)' : 'var(--text-secondary)',
              }}
            >
              <Icon size={28} />
            </motion.button>
          );
        })}
      </div>

      {/* 4 Indicator Dots */}
      <div className="mt-2 flex items-center gap-[6px]" aria-hidden="true">
        {items.map((item, index) => {
          const isSelected = index === selectedIndex;
          return (
            <motion.span
              key={item.id}
              animate={{
                width: isSelected ? 6 : 4,
                height: isSelected ? 6 : 4,
                opacity: isSelected ? 1 : 0.3,
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="rounded-full"
              style={{
                backgroundColor: isSelected ? 'var(--text)' : 'var(--text-secondary)',
              }}
            />
          );
        })}
      </div>
    </nav>
  );
};
