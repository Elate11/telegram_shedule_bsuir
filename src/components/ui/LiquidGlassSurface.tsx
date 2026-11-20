import React, { useState } from 'react';
import { clsx } from 'clsx';

export interface LiquidGlassSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  cornerRadius?: number;
  tint?: string;
  accentColor?: string;
  isDarkTheme?: boolean;
  tiltX?: number;
  tiltY?: number;
  isActive?: boolean;
  interactivePointer?: boolean;
  children: React.ReactNode;
}

function hexToRgb(color: string): [number, number, number] | null {
  const clean = color.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return [
      Number.parseInt(clean[0] + clean[0], 16),
      Number.parseInt(clean[1] + clean[1], 16),
      Number.parseInt(clean[2] + clean[2], 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return [
      Number.parseInt(clean.slice(0, 2), 16),
      Number.parseInt(clean.slice(2, 4), 16),
      Number.parseInt(clean.slice(4, 6), 16),
    ];
  }
  return null;
}

export function colorWithAlpha(color: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const rgb = hexToRgb(color);
  if (rgb) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clamped})`;
  }
  if (color.startsWith('var(')) {
    const pct = Math.round(clamped * 100);
    return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
  }
  return color;
}

export const LiquidGlassSurface: React.FC<LiquidGlassSurfaceProps> = ({
  cornerRadius = 20,
  tint,
  accentColor,
  isDarkTheme = true,
  tiltX: externalTiltX = 0,
  tiltY: externalTiltY = 0,
  isActive = true,
  interactivePointer = false,
  className,
  style,
  children,
  onPointerMove,
  onPointerLeave,
  ...rest
}) => {
  const [pointerTilt, setPointerTilt] = useState({ x: 0, y: 0 });

  const tiltX = interactivePointer && externalTiltX === 0 ? pointerTilt.x : externalTiltX;
  const tiltY = interactivePointer && externalTiltY === 0 ? pointerTilt.y : externalTiltY;

  const resolvedAccent = accentColor ?? (isDarkTheme ? '#2997FF' : '#0066CC');
  const resolvedTint = tint ?? resolvedAccent;

  const handlePointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (interactivePointer) {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const nx = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1));
        const ny = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1));
        setPointerTilt({ x: nx, y: ny });
      }
    }
    onPointerMove?.(e);
  };

  const handlePointerLeave: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (interactivePointer) {
      setPointerTilt({ x: 0, y: 0 });
    }
    onPointerLeave?.(e);
  };

  if (!isActive) {
    return (
      <div
        className={clsx('relative', className)}
        style={{ borderRadius: `${cornerRadius}px`, ...style }}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        {...rest}
      >
        {children}
      </div>
    );
  }

  const angleRad = Math.atan2(tiltY, tiltX);
  const hasTilt = Math.abs(tiltX) > 0.001 || Math.abs(tiltY) > 0.001;
  const cx = hasTilt ? 50 + Math.cos(angleRad) * 25 : 28;
  const cy = hasTilt ? 50 + Math.sin(angleRad) * 25 : 25;
  const hueShift = ((angleRad * 180) / Math.PI + 360) % 360;
  const prismLightness = isDarkTheme ? 75 : 55;
  const gradAngle = Math.round(135 + tiltX * 15 - tiltY * 15);

  const bodyBackground = isDarkTheme
    ? `linear-gradient(${gradAngle}deg, rgba(255,255,255,0.28), ${colorWithAlpha(resolvedAccent, 0.22)}, rgba(255,255,255,0.08), ${colorWithAlpha(resolvedAccent, 0.18)})`
    : `linear-gradient(${gradAngle}deg, rgba(255,255,255,0.85), ${colorWithAlpha(resolvedAccent, 0.25)}, rgba(255,255,255,0.40), ${colorWithAlpha(resolvedAccent, 0.20)})`;

  const bloomShadow = `${(tiltX * 4).toFixed(2)}px ${(tiltY * 4).toFixed(2)}px 14px -1px ${colorWithAlpha(
    resolvedTint,
    isDarkTheme ? 0.3 : 0.4,
  )}`;

  const specularBg = `radial-gradient(circle 75% at ${cx.toFixed(1)}% ${cy.toFixed(1)}%, rgba(255,255,255,${
    isDarkTheme ? 0.65 : 0.85
  }), rgba(255,255,255,${isDarkTheme ? 0.2 : 0.35}) 45%, transparent 100%)`;

  const bevelBg = `conic-gradient(from 0deg at ${(50 + tiltX * 5).toFixed(1)}% ${(50 + tiltY * 5).toFixed(
    1,
  )}%, rgba(255,255,255,0.90), hsla(${hueShift.toFixed(0)}, 70%, ${prismLightness}%, 0.60), rgba(255,255,255,0.35), hsla(${hueShift.toFixed(
    0,
  )}, 70%, ${prismLightness}%, 0.50), rgba(255,255,255,0.90))`;

  return (
    <div
      className={clsx('relative overflow-hidden', className)}
      style={{
        borderRadius: `${cornerRadius}px`,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        background: bodyBackground,
        boxShadow: bloomShadow,
        ...style,
      }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      {...rest}
    >
      {/* Layer 4: Caustic Specular Highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: `${cornerRadius}px`,
          background: specularBg,
          mixBlendMode: 'screen',
          opacity: 0.7,
        }}
      />

      {/* Layer 5: Prismatic Diamond-Cut 1.5px Bevel Rim */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: `${cornerRadius}px`,
          padding: '1.5px',
          background: bevelBg,
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
};
