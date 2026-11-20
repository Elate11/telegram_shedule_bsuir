import React, { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { colorWithAlpha } from './LiquidGlassSurface';

export interface DynamicGradientBgProps {
  accentColor: string;
  isDarkTheme: boolean;
  dimOpacity?: number;
  className?: string;
}

export const DynamicGradientBg: React.FC<DynamicGradientBgProps> = ({
  accentColor,
  isDarkTheme,
  dimOpacity = 0,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    let rafId = 0;
    const startTime = performance.now();

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const drawFrame = (now: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const t = prefersReducedMotion
        ? 0.6
        : (((now - startTime) % 12000) / 12000) * Math.PI * 2;

      ctx.fillStyle = isDarkTheme ? '#0A001A' : '#FFEBEB';
      ctx.fillRect(0, 0, w, h);

      const blobs: Array<{ x: number; y: number; r: number; color: string }> = [
        {
          x: w * (0.5 + 0.3 * Math.sin(t)),
          y: h * (0.5 + 0.3 * Math.cos(0.8 * t)),
          r: Math.max(1, w * (0.8 + 0.2 * Math.sin(1.5 * t))),
          color: isDarkTheme ? 'rgba(255, 0, 127, 0.5)' : 'rgba(255, 107, 107, 0.5)',
        },
        {
          x: w * (0.5 + 0.4 * Math.cos(1.2 * t)),
          y: h * (0.5 + 0.4 * Math.sin(0.9 * t)),
          r: Math.max(1, w * (0.9 + 0.2 * Math.cos(1.3 * t))),
          color: isDarkTheme ? 'rgba(112, 0, 255, 0.5)' : 'rgba(78, 205, 196, 0.5)',
        },
        {
          x: w * (0.5 + 0.35 * Math.sin(0.7 * t)),
          y: h * (0.5 + 0.35 * Math.cos(1.1 * t)),
          r: Math.max(1, w * (0.85 + 0.15 * Math.sin(1.4 * t))),
          color: isDarkTheme ? 'rgba(0, 229, 255, 0.4)' : 'rgba(255, 217, 61, 0.5)',
        },
        {
          x: w * (0.5 + 0.2 * Math.cos(1.5 * t)),
          y: h * (0.5 + 0.2 * Math.sin(1.2 * t)),
          r: Math.max(1, w * 0.7),
          color: colorWithAlpha(accentColor, 0.4),
        },
      ];

      for (const blob of blobs) {
        const g = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
        g.addColorStop(0, blob.color);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      if (dimOpacity > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, Math.min(1, dimOpacity))})`;
        ctx.fillRect(0, 0, w, h);
      }

      if (!prefersReducedMotion) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    rafId = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [accentColor, isDarkTheme, dimOpacity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={clsx('fixed inset-0 z-0 pointer-events-none', className)}
    />
  );
};
