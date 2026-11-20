import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { LiquidGlassSurface } from './LiquidGlassSurface';
import { triggerHaptic } from '../../services/telegram';

export interface KyantLiquidButtonProps {
  onClick: () => void;
  cornerRadius?: number;
  tint?: string;
  accentColor?: string;
  isDarkTheme?: boolean;
  isSelected?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  'aria-label'?: string;
}

export const KyantLiquidButton: React.FC<KyantLiquidButtonProps> = ({
  onClick,
  cornerRadius = 18,
  tint,
  accentColor,
  isDarkTheme = true,
  isSelected = false,
  disabled = false,
  className,
  children,
  'aria-label': ariaLabel,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 });
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    setIsPressed(true);
    setDragDelta({ x: 0, y: 0 });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isPressed || !startRef.current || disabled) return;
    setDragDelta({
      x: e.clientX - startRef.current.x,
      y: e.clientY - startRef.current.y,
    });
  };

  const release = () => {
    startRef.current = null;
    setIsPressed(false);
    setDragDelta({ x: 0, y: 0 });
  };

  const tx = isPressed ? 60 * Math.tanh((0.06 * dragDelta.x) / 60) : 0;
  const ty = isPressed ? 60 * Math.tanh((0.06 * dragDelta.y) / 60) : 0;
  const tiltX = isPressed ? Math.max(-1, Math.min(1, dragDelta.x / 100)) : 0;
  const tiltY = isPressed ? Math.max(-1, Math.min(1, dragDelta.y / 100)) : 0;

  return (
    <motion.button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={isSelected || undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onClick={() => {
        if (disabled) return;
        triggerHaptic('impact', 'light');
        onClick();
      }}
      animate={{
        scale: isPressed ? 1.04 : 1,
        x: tx,
        y: ty,
      }}
      transition={{ type: 'spring', stiffness: 320, damping: 18 }}
      className={clsx(
        'relative inline-flex items-center justify-center border-0 bg-transparent p-0 select-none focus:outline-none',
        disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer',
        className,
      )}
      style={{ borderRadius: `${cornerRadius}px` }}
    >
      <LiquidGlassSurface
        cornerRadius={cornerRadius}
        tint={tint}
        accentColor={accentColor}
        isDarkTheme={isDarkTheme}
        tiltX={tiltX}
        tiltY={tiltY}
        isActive={isSelected || isPressed}
        className="w-full h-full"
      >
        <div className="inline-flex items-center justify-center gap-2 px-[14px] py-2 select-none">
          {children}
        </div>
      </LiquidGlassSurface>
    </motion.button>
  );
};
