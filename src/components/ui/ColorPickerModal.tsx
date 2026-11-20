import React, { useEffect, useState } from 'react';
import { triggerHaptic } from '../../services/telegram';

export interface ColorPickerModalProps {
  isOpen: boolean;
  initialColor: string; // '#RRGGBB'
  onColorSelected: (hex: string) => void;
  onDismiss: () => void;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function hsvToHex(h: number, s: number, v: number): string {
  const hue = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = v - c;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hue < 60) {
    r1 = c;
    g1 = x;
  } else if (hue < 120) {
    r1 = x;
    g1 = c;
  } else if (hue < 180) {
    g1 = c;
    b1 = x;
  } else if (hue < 240) {
    g1 = x;
    b1 = c;
  } else if (hue < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  const toHex = (n: number) =>
    Math.round(clamp((n + m) * 255, 0, 255))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();

  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const clean = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return { h: 210, s: 0.85, v: 1 };
  }
  const r = Number.parseInt(clean.slice(0, 2), 16) / 255;
  const g = Number.parseInt(clean.slice(2, 4), 16) / 255;
  const b = Number.parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
  isOpen,
  initialColor,
  onColorSelected,
  onDismiss,
}) => {
  const [hsv, setHsv] = useState(() => hexToHsv(initialColor));
  const [hexInput, setHexInput] = useState(initialColor.toUpperCase());

  useEffect(() => {
    if (isOpen) {
      const next = hexToHsv(initialColor);
      setHsv(next);
      setHexInput(hsvToHex(next.h, next.s, next.v));
    }
  }, [isOpen, initialColor]);

  if (!isOpen) return null;

  const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v);
  const pureHueHex = hsvToHex(hsv.h, 1, 1);

  const handleHuePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const f = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const nextHue = f * 360;
    const next = { ...hsv, h: nextHue };
    setHsv(next);
    setHexInput(hsvToHex(next.h, next.s, next.v));
  };

  const handleTonePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const f = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    let nextS = 1;
    let nextV = 1;
    if (f <= 0.5) {
      nextV = f * 2;
      nextS = 1;
    } else {
      nextV = 1;
      nextS = 1 - (f - 0.5) * 2;
    }
    const next = { ...hsv, s: nextS, v: nextV };
    setHsv(next);
    setHexInput(hsvToHex(next.h, next.s, next.v));
  };

  const toneFraction = hsv.s >= 0.99 ? hsv.v / 2 : 0.5 + (1 - hsv.s) / 2;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Выбор цвета"
      onClick={onDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[340px] rounded-[16px] bg-[#222222] p-6 text-white shadow-2xl border border-white/10"
      >
        <div className="flex flex-col items-center gap-3 mb-5">
          <div
            aria-label="Предпросмотр цвета"
            className="w-[80px] h-[80px] rounded-full border-[3px] border-white/30 shadow-inner"
            style={{ backgroundColor: currentHex }}
          />
          <input
            type="text"
            aria-label="HEX цвет"
            value={hexInput}
            onChange={(e) => {
              const raw = e.target.value.toUpperCase();
              setHexInput(raw);
              if (/^#[0-9A-F]{6}$/.test(raw)) {
                setHsv(hexToHsv(raw));
              }
            }}
            className="w-[104px] text-center text-s-13 font-mono bg-white/10 border border-white/15 rounded-[8px] px-2 py-1 text-white outline-none"
          />
        </div>

        {/* Strip 1: Hue */}
        <div
          role="slider"
          aria-label="Оттенок"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(hsv.h)}
          tabIndex={0}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            handleHuePointer(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons > 0 || e.pointerType === 'touch') {
              handleHuePointer(e);
            }
          }}
          className="h-[48px] w-full rounded-[8px] relative cursor-ew-resize touch-none mb-4 overflow-hidden"
          style={{
            background:
              'linear-gradient(to right, #FF0000, #FFFF00, #00FF00, #00FFFF, #0000FF, #FF00FF, #FF0000)',
          }}
        >
          <div
            className="absolute top-0 bottom-0 w-[4px] bg-white border border-black -translate-x-1/2 pointer-events-none"
            style={{ left: `${(hsv.h / 360) * 100}%` }}
          />
        </div>

        {/* Strip 2: Black -> PureHue -> White */}
        <div
          role="slider"
          aria-label="Насыщенность и яркость"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(toneFraction * 100)}
          tabIndex={0}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            handleTonePointer(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons > 0 || e.pointerType === 'touch') {
              handleTonePointer(e);
            }
          }}
          className="h-[48px] w-full rounded-[8px] relative cursor-ew-resize touch-none mb-6 overflow-hidden"
          style={{
            background: `linear-gradient(to right, #000000, ${pureHueHex}, #FFFFFF)`,
          }}
        >
          <div
            className="absolute top-0 bottom-0 w-[4px] bg-white border border-black -translate-x-1/2 pointer-events-none"
            style={{ left: `${clamp(toneFraction, 0, 1) * 100}%` }}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 h-[44px] rounded-[10px] font-bold text-s-13 tracking-wide bg-white/10 text-white/85 cursor-pointer border-0"
          >
            ОТМЕНА
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('impact', 'light');
              onColorSelected(currentHex);
            }}
            className="flex-1 h-[44px] rounded-[10px] font-bold text-s-13 tracking-wide bg-[#2997FF] text-white cursor-pointer border-0"
          >
            ВЫБРАТЬ
          </button>
        </div>
      </div>
    </div>
  );
};
