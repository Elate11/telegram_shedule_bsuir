import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import type { TransitionType } from '../../types';

export interface TransitionWrapperProps {
  activeKey: string | number;
  direction?: 1 | -1;
  transitionType: TransitionType;
  transitionsEnabled: boolean;
  transitionSpeedMultiplier: number; // 0.5 .. 2.5
  className?: string;
  children: React.ReactNode;
}

function getTransitionDuration(enabled: boolean, speedMultiplier: number): number {
  if (!enabled) return 0;
  const ms = Math.max(150, Math.min(1000, Math.round(420 / Math.max(0.5, speedMultiplier))));
  return ms / 1000;
}

export const TransitionWrapper: React.FC<TransitionWrapperProps> = ({
  activeKey,
  direction = 1,
  transitionType,
  transitionsEnabled,
  transitionSpeedMultiplier,
  className,
  children,
}) => {
  const duration = getTransitionDuration(transitionsEnabled, transitionSpeedMultiplier);
  const ease = [0.4, 0, 0.2, 1] as const;

  const getVariants = () => {
    if (!transitionsEnabled) {
      return {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 },
      };
    }

    switch (transitionType) {
      case 'Fade':
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        };
      case 'Scale':
        return {
          initial: { scale: 0.75, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          exit: { scale: 0.75, opacity: 0 },
        };
      case 'Cube':
        return {
          initial: (dir: number) => ({
            rotateY: dir > 0 ? 90 : -90,
            opacity: 0.6,
            transformOrigin: dir > 0 ? '100% 50%' : '0% 50%',
          }),
          animate: { rotateY: 0, opacity: 1, transformOrigin: '50% 50%' },
          exit: (dir: number) => ({
            rotateY: dir > 0 ? -90 : 90,
            opacity: 0.6,
            transformOrigin: dir > 0 ? '0% 50%' : '100% 50%',
          }),
        };
      case 'Flip':
        return {
          initial: (dir: number) => ({ rotateY: dir > 0 ? 180 : -180, opacity: 0 }),
          animate: { rotateY: 0, opacity: 1 },
          exit: (dir: number) => ({ rotateY: dir > 0 ? -180 : 180, opacity: 0 }),
        };
      case 'Slide':
      default:
        return {
          initial: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0.85 }),
          animate: { x: 0, opacity: 1 },
          exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0.85 }),
        };
    }
  };

  const variants = getVariants();

  return (
    <div
      className={clsx('relative overflow-hidden', className)}
      style={{ perspective: transitionType === 'Cube' || transitionType === 'Flip' ? '1200px' : undefined }}
    >
      <AnimatePresence mode="popLayout" custom={direction} initial={false}>
        <motion.div
          key={activeKey}
          custom={direction}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration, ease }}
          style={{
            backfaceVisibility: transitionType === 'Flip' ? 'hidden' : undefined,
          }}
          className="w-full h-full"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export interface TransitionDemoBoxProps {
  transitionType: TransitionType;
  speedMultiplier: number;
  accentColor?: string;
}

export const TransitionDemoBox: React.FC<TransitionDemoBoxProps> = ({
  transitionType,
  speedMultiplier,
  accentColor = 'var(--accent)',
}) => {
  const durationSec = Math.max(0.6, 1.5 / Math.max(0.5, speedMultiplier));

  const animateProps = (() => {
    switch (transitionType) {
      case 'Fade':
        return { opacity: [0.25, 1, 0.25] };
      case 'Scale':
        return { scale: [0.65, 1, 0.65], opacity: [0.4, 1, 0.4] };
      case 'Cube':
      case 'Flip':
        return { rotateY: [0, 180, 0] };
      case 'Slide':
      default:
        return { x: [-10, 10, -10] };
    }
  })();

  return (
    <div
      className="w-[40px] h-[40px] rounded-[8px] flex items-center justify-center overflow-hidden border border-[var(--border)] bg-[var(--card-lesson)]"
      style={{ perspective: '400px' }}
    >
      <motion.div
        animate={animateProps}
        transition={{ duration: durationSec, repeat: Infinity, ease: 'easeInOut' }}
        className="w-[20px] h-[20px] rounded-[5px]"
        style={{ backgroundColor: accentColor }}
      />
    </div>
  );
};
