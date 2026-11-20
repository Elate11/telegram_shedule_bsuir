import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { triggerHaptic } from '../../services/telegram';
import { computeRelativeLuminance, getContrastForeground } from '../../context/ThemeContext';
import { colorWithAlpha } from './LiquidGlassSurface';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

export interface RadialNavMenuItem {
  title: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  index: number;
}

export interface AppleTouchChargingAuraProps {
  touchOffset: { x: number; y: number } | null;
  progress: number; // 0..1
  isDarkTheme?: boolean;
  accentColor?: string;
}

export interface AppleRadialMenuProps {
  isOpen: boolean;
  onDismiss: () => void;
  items: RadialNavMenuItem[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  isDarkTheme?: boolean;
  accentColor?: string;
  touchPosition: { x: number; y: number } | null;
}

export interface AdaptiveAnglesResult {
  cx: number;
  cy: number;
  isCorner: boolean;
  isEdge: boolean;
  anglesDeg: number[];
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function calculateAdaptiveAngles(
  touchPosition: { x: number; y: number } | null,
  count: number,
  viewportWidth?: number,
  viewportHeight?: number,
): AdaptiveAnglesResult {
  const vw = viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 390);
  const vh = viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 844);
  const rawX = touchPosition?.x ?? vw / 2;
  const rawY = touchPosition?.y ?? vh / 2;

  const isNearLeft = rawX < 140;
  const isNearRight = rawX > vw - 140;
  const isNearTop = rawY < 180;
  const isNearBottom = rawY > vh - 180;

  const isCorner = (isNearLeft || isNearRight) && (isNearTop || isNearBottom);
  const isEdge = !isCorner && (isNearLeft || isNearRight || isNearTop || isNearBottom);
  const minSafeMargin = isCorner ? 52 : isEdge ? 48 : 24;

  let cx = clamp(rawX, minSafeMargin, Math.max(minSafeMargin, vw - minSafeMargin));
  const cy = clamp(rawY, minSafeMargin, Math.max(minSafeMargin, vh - minSafeMargin));

  // In pure top/bottom edge band (140 <= x <= vw - 140), keep horizontal fan reach inside viewport
  if (!isCorner && !isNearLeft && !isNearRight && (isNearTop || isNearBottom)) {
    const edgeBandMargin = Math.min(vw / 2, 175);
    cx = clamp(cx, edgeBandMargin, Math.max(edgeBandMargin, vw - edgeBandMargin));
  }

  if (count <= 0) {
    return { cx, cy, isCorner, isEdge, anglesDeg: [] };
  }

  let startDeg = -90;
  let endDeg = 270;
  let fullCircle = true;

  if (isNearLeft && isNearTop) {
    startDeg = 3;
    endDeg = 87;
    fullCircle = false;
  } else if (isNearRight && isNearTop) {
    startDeg = 93;
    endDeg = 177;
    fullCircle = false;
  } else if (isNearLeft && isNearBottom) {
    startDeg = -87;
    endDeg = -3;
    fullCircle = false;
  } else if (isNearRight && isNearBottom) {
    startDeg = -177;
    endDeg = -93;
    fullCircle = false;
  } else if (isNearLeft) {
    startDeg = -58;
    endDeg = 58;
    fullCircle = false;
  } else if (isNearRight) {
    startDeg = 122;
    endDeg = 238;
    fullCircle = false;
  } else if (isNearTop) {
    startDeg = 40;
    endDeg = 140;
    fullCircle = false;
  } else if (isNearBottom) {
    startDeg = -140;
    endDeg = -40;
    fullCircle = false;
  }

  const anglesDeg: number[] = [];
  for (let i = 0; i < count; i += 1) {
    if (fullCircle) {
      anglesDeg.push(-90 + i * (360 / count));
    } else if (count === 1) {
      anglesDeg.push((startDeg + endDeg) / 2);
    } else {
      anglesDeg.push(startDeg + (i * (endDeg - startDeg)) / (count - 1));
    }
  }

  return { cx, cy, isCorner, isEdge, anglesDeg };
}

export const AppleTouchChargingAura: React.FC<AppleTouchChargingAuraProps> = ({
  touchOffset,
  progress,
  isDarkTheme = true,
  accentColor,
}) => {
  if (!touchOffset || progress <= 0.02) return null;

  const accent = accentColor ?? (isDarkTheme ? '#2997FF' : '#0066CC');
  const p = clamp(progress, 0, 1);
  const auraSize = 28 + 46 * p;

  return (
    <div
      aria-hidden="true"
      className="fixed pointer-events-none z-50 rounded-full"
      style={{
        width: `${auraSize}px`,
        height: `${auraSize}px`,
        left: `${touchOffset.x - auraSize / 2}px`,
        top: `${touchOffset.y - auraSize / 2}px`,
        backgroundColor: colorWithAlpha(accent, 0.15 * p),
        border: `${(1.5 + p * 1.2).toFixed(2)}px solid ${colorWithAlpha(accent, Math.min(0.95, p * 0.95))}`,
      }}
    />
  );
};

interface ClampedFloatingLabelProps {
  title: string;
  cx: number;
  cy: number;
  lx: number;
  ly: number;
  vw: number;
  vh: number;
  bgColor: string;
  textColor: string;
}

const ClampedFloatingLabel: React.FC<ClampedFloatingLabelProps> = ({
  title,
  cx,
  cy,
  lx,
  ly,
  vw,
  vh,
  bgColor,
  textColor,
}) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const estW = Math.max(56, title.length * 7.5 + 18);
  const estH = 22;
  const [size, setSize] = useState({ w: estW, h: estH });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth > 0 ? el.offsetWidth : estW;
    const h = el.offsetHeight > 0 ? el.offsetHeight : estH;
    setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
  }, [title, estW]);

  const minCenterX = 8 + size.w / 2;
  const maxCenterX = Math.max(minCenterX, vw - 8 - size.w / 2);
  const minCenterY = 8 + size.h / 2;
  const maxCenterY = Math.max(minCenterY, vh - 8 - size.h / 2);

  const clampedLx = clamp(cx + lx, minCenterX, maxCenterX) - cx;
  const clampedLy = clamp(cy + ly, minCenterY, maxCenterY) - cy;

  return (
    <motion.span
      ref={ref}
      initial={{ x: 0, y: 0, opacity: 0 }}
      animate={{
        x: clampedLx,
        y: clampedLy,
        opacity: 1,
        transition: { type: 'spring', stiffness: 280, damping: 18.1 },
      }}
      exit={{
        x: 0,
        y: 0,
        opacity: 0,
        transition: { duration: 0.14, ease: 'easeIn' },
      }}
      className="pointer-events-none absolute z-10 px-2 py-0.5 rounded-full text-s-10_5 font-semibold whitespace-nowrap"
      style={{
        backgroundColor: bgColor,
        color: textColor,
      }}
    >
      {title}
    </motion.span>
  );
};

interface ClampedCenterLabelProps {
  title: string;
  centerX: number;
  centerY: number;
  discHalf: number;
  vw: number;
  vh: number;
  bgColor: string;
  textColor: string;
}

const ClampedCenterLabel: React.FC<ClampedCenterLabelProps> = ({
  title,
  centerX,
  centerY,
  discHalf,
  vw,
  vh,
  bgColor,
  textColor,
}) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const estW = Math.max(56, title.length * 7.5 + 18);
  const estH = 22;
  const [size, setSize] = useState({ w: estW, h: estH });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth > 0 ? el.offsetWidth : estW;
    const h = el.offsetHeight > 0 ? el.offsetHeight : estH;
    setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
  }, [title, estW]);

  const minCenterX = 8 + size.w / 2;
  const maxCenterX = Math.max(minCenterX, vw - 8 - size.w / 2);
  const shiftX = clamp(centerX, minCenterX, maxCenterX) - centerX;
  const placeAbove = centerY + discHalf + 4 + size.h > vh - 8;

  return (
    <span
      ref={ref}
      className={
        placeAbove
          ? 'absolute bottom-full mb-1 px-2 py-0.5 rounded-full text-s-10_5 font-semibold whitespace-nowrap pointer-events-none'
          : 'absolute top-full mt-1 px-2 py-0.5 rounded-full text-s-10_5 font-semibold whitespace-nowrap pointer-events-none'
      }
      style={{
        backgroundColor: bgColor,
        color: textColor,
        transform: shiftX !== 0 ? `translateX(${shiftX}px)` : undefined,
      }}
    >
      {title}
    </span>
  );
};

export const AppleRadialMenu: React.FC<AppleRadialMenuProps> = ({
  isOpen,
  onDismiss,
  items,
  selectedIndex,
  onSelectIndex,
  isDarkTheme = true,
  accentColor,
  touchPosition,
}) => {
  const accent = accentColor ?? (isDarkTheme ? '#2997FF' : '#0066CC');
  const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 844;
  const { cx, cy, isCorner, isEdge, anglesDeg } = calculateAdaptiveAngles(
    touchPosition,
    items.length,
    vw,
    vh,
  );

  const isHexAccent = HEX_COLOR_RE.test(accent.trim());
  const selectedPillColor = isHexAccent
    ? !isDarkTheme && computeRelativeLuminance(accent) > 0.5
      ? '#1D1D1F'
      : isDarkTheme && computeRelativeLuminance(accent) < 0.08
        ? '#FFFFFF'
        : accent
    : accent;
  const pillBgColor = isDarkTheme ? 'rgba(28, 28, 30, 0.92)' : 'rgba(255, 255, 255, 0.92)';

  const baseRadiusIcon = isCorner ? 145 : isEdge ? 135 : 100;
  const labelRadius = baseRadiusIcon + (isCorner ? 52 : 48);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="apple-radial-menu-dialog"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: 'none' }}
          transition={{ duration: 0.14 }}
          className="fixed inset-0 z-50 select-none"
          role="dialog"
          aria-modal="true"
          aria-label="Меню навигации"
        >
          {/* Dimmed backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            transition={{ duration: 0.12 }}
            onClick={onDismiss}
            className="absolute inset-0 bg-black/62"
          />

          {/* Radial container */}
          <motion.div
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{
              scale: 1,
              opacity: 1,
              transition: { type: 'spring', stiffness: 420, damping: 24.6 },
            }}
            exit={{
              scale: 0.3,
              opacity: 0,
              transition: { duration: 0.14, ease: 'easeIn' },
            }}
            className="fixed w-[300px] h-[300px] pointer-events-none flex items-center justify-center"
            style={{
              left: `${cx - 150}px`,
              top: `${cy - 150}px`,
            }}
          >
            {/* Shockwave ring */}
            <div
              aria-hidden="true"
              className="absolute rounded-full pointer-events-none animate-radial-shockwave"
              style={{ border: `2px solid ${accent}` }}
            />

            {/* Subtle 216px guide ring */}
            <div
              aria-hidden="true"
              className="absolute w-[216px] h-[216px] rounded-full pointer-events-none"
              style={{
                border: `1px solid ${isDarkTheme ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}`,
              }}
            />

            {/* Center close disc */}
            <motion.button
              type="button"
              aria-label="Закрыть меню"
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                triggerHaptic('impact', 'light');
                onDismiss();
              }}
              className="pointer-events-auto relative z-20 w-[56px] h-[56px] rounded-full flex items-center justify-center cursor-pointer"
              style={{
                backgroundColor: isDarkTheme ? 'rgba(44, 44, 46, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                border: `1px solid ${isDarkTheme ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.1)'}`,
                color: isDarkTheme ? '#FFFFFF' : '#1D1D1F',
              }}
            >
              <X size={24} />
            </motion.button>

            {/* Satellites */}
            {items.map((item, i) => {
              const Icon = item.icon;
              const isSelected = item.index === selectedIndex;
              const angleRad = ((anglesDeg[i] ?? 0) * Math.PI) / 180;
              const ix = Math.cos(angleRad) * baseRadiusIcon;
              const iy = Math.sin(angleRad) * baseRadiusIcon;
              const lx = Math.cos(angleRad) * labelRadius;
              const ly = Math.sin(angleRad) * labelRadius;
              const spinInit = i % 2 === 0 ? 35 : -35;
              const discSize = isCorner || isEdge ? 52 : 54;
              const effectiveDiscHalf = (discSize * (isSelected ? 1.08 : 1)) / 2;
              const clampedIx =
                clamp(
                  cx + ix,
                  8 + effectiveDiscHalf,
                  Math.max(8 + effectiveDiscHalf, vw - 8 - effectiveDiscHalf),
                ) - cx;
              const clampedIy =
                clamp(
                  cy + iy,
                  8 + effectiveDiscHalf,
                  Math.max(8 + effectiveDiscHalf, vh - 8 - effectiveDiscHalf),
                ) - cy;
              const pillTextColor = isSelected
                ? selectedPillColor
                : isDarkTheme
                  ? '#FFFFFF'
                  : '#1D1D1F';

              return (
                <React.Fragment key={item.title}>
                  <motion.button
                    type="button"
                    aria-label={item.title}
                    initial={{ x: 0, y: 0, scale: 0.3, rotate: spinInit, opacity: 0 }}
                    animate={{
                      x: clampedIx,
                      y: clampedIy,
                      scale: isSelected ? 1.08 : 1,
                      rotate: 0,
                      opacity: 1,
                      transition: { type: 'spring', stiffness: 280, damping: 18.1 },
                    }}
                    exit={{
                      x: 0,
                      y: 0,
                      scale: 0.3,
                      opacity: 0,
                      transition: { duration: 0.14, ease: 'easeIn' },
                    }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      triggerHaptic('selection');
                      onSelectIndex(item.index);
                      onDismiss();
                    }}
                    className="pointer-events-auto absolute z-20 rounded-full flex flex-col items-center justify-center cursor-pointer shadow-lg"
                    style={{
                      width: `${discSize}px`,
                      height: `${discSize}px`,
                      backgroundColor: isSelected
                        ? accent
                        : isDarkTheme
                          ? 'rgba(42, 42, 44, 0.94)'
                          : 'rgba(255, 255, 255, 0.94)',
                      color: isSelected
                        ? isHexAccent
                          ? getContrastForeground(accent)
                          : 'var(--accent-fg, #FFFFFF)'
                        : isDarkTheme
                          ? '#FFFFFF'
                          : '#1D1D1F',
                      border: `1px solid ${
                        isSelected
                          ? 'transparent'
                          : isDarkTheme
                            ? 'rgba(255,255,255,0.16)'
                            : 'rgba(0,0,0,0.08)'
                      }`,
                    }}
                  >
                    <Icon size={22} />
                    {!(isCorner || isEdge) && (
                      <ClampedCenterLabel
                        title={item.title}
                        centerX={cx + clampedIx}
                        centerY={cy + clampedIy}
                        discHalf={effectiveDiscHalf}
                        vw={vw}
                        vh={vh}
                        bgColor={pillBgColor}
                        textColor={pillTextColor}
                      />
                    )}
                  </motion.button>

                  {(isCorner || isEdge) && (
                    <ClampedFloatingLabel
                      title={item.title}
                      cx={cx}
                      cy={cy}
                      lx={lx}
                      ly={ly}
                      vw={vw}
                      vh={vh}
                      bgColor={pillBgColor}
                      textColor={pillTextColor}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export interface UseLongPressRadialTriggerOptions {
  enabled: boolean;
  onOpen: (pos: { x: number; y: number }) => void;
}

export function useLongPressRadialTrigger({ enabled, onOpen }: UseLongPressRadialTriggerOptions) {
  const [touchOffset, setTouchOffset] = useState<{ x: number; y: number } | null>(null);
  const [chargeProgress, setChargeProgress] = useState(0);

  const startRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);

  const cancel = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
    setTouchOffset(null);
    setChargeProgress(0);
  }, []);

  useEffect(() => {
    if (!enabled) cancel();
    return cancel;
  }, [enabled, cancel]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      const start = { x: e.clientX, y: e.clientY };
      startRef.current = start;
      startTimeRef.current = performance.now();
      setTouchOffset(start);
      setChargeProgress(0);

      const tick = (now: number) => {
        if (!startRef.current) return;
        const elapsed = now - startTimeRef.current;
        const p = clamp(elapsed / 480, 0, 1);
        setChargeProgress(p);
        if (elapsed >= 480) {
          const openPos = startRef.current;
          cancel();
          triggerHaptic('impact', 'medium');
          onOpen(openPos);
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [enabled, cancel, onOpen],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startRef.current) return;
      const dist = Math.hypot(e.clientX - startRef.current.x, e.clientY - startRef.current.y);
      if (dist > 55) {
        cancel();
      }
    },
    [cancel],
  );

  return {
    touchOffset,
    chargeProgress,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: cancel,
      onPointerCancel: cancel,
    },
  };
}
