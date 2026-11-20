import React, { useEffect, useRef, useState } from 'react';
import { BsuirLogoSvg } from '../../assets/BsuirLogoSvg';

export interface BsuirIntroSplashProps {
  onFinished: () => void;
  /** Increment or change to replay intro (e.g., from CustomizationScreen) */
  replayKey?: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export const BsuirIntroSplash: React.FC<BsuirIntroSplashProps> = ({
  onFinished,
  replayKey = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const logoRef = useRef<HTMLDivElement | null>(null);
  const finishedRef = useRef(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    finishedRef.current = false;
    setIsFadingOut(false);
  }, [replayKey]);

  const startFadeOut = () => {
    setIsFadingOut((prev) => (prev ? prev : true));
  };

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
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const waveStarts = [0.16, 0.38, 0.6];

    const renderFrame = (now: number) => {
      const elapsedSec = prefersReducedMotion ? 1.5 : (now - startTime) / 1000;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const cx = width / 2;
      const cy = height / 2;

      ctx.clearRect(0, 0, width, height);

      // 1. Radial bloom behind logo
      const bloomRadius = Math.max(1, Math.min(width, height) * 0.62);
      const bloomAlpha = clamp(elapsedSec / 0.7, 0, 1) * 0.32;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloomRadius);
      grad.addColorStop(0, `rgba(41, 151, 255, ${bloomAlpha})`);
      grad.addColorStop(0.5, `rgba(18, 50, 107, ${bloomAlpha * 0.45})`);
      grad.addColorStop(1, 'rgba(16, 17, 22, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 2. Three expanding #38A3FF sonar rings
      if (!prefersReducedMotion) {
        const originX = cx + 38;
        const originY = cy - 22;
        for (const wStart of waveStarts) {
          if (elapsedSec > wStart) {
            const wt = clamp((elapsedSec - wStart) / 1.35, 0, 1);
            if (wt < 1) {
              const easeOut = 1 - (1 - wt) ** 3;
              const rad = 24 + easeOut * 195;
              const ringAlpha = (1 - wt) ** 2 * 0.34;
              ctx.beginPath();
              ctx.arc(originX, originY, rad, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(56, 163, 255, ${ringAlpha})`;
              ctx.lineWidth = 2;
              ctx.stroke();
            }
          }
        }
      }

      // 3. Overshoot scale & opacity on center logo via ref
      if (logoRef.current) {
        const u = clamp(elapsedSec / 0.82, 0, 1);
        const s = 1.15;
        const u1 = u - 1;
        const back = u1 * u1 * ((s + 1) * u1 + s) + 1;
        const logoScale = prefersReducedMotion ? 1 : 0.84 + 0.16 * back;
        const logoAlpha = prefersReducedMotion ? 1 : clamp(elapsedSec / 0.45, 0, 1);
        logoRef.current.style.transform = `scale(${logoScale})`;
        logoRef.current.style.opacity = String(logoAlpha);
      }

      if (elapsedSec >= 4.0) {
        startFadeOut();
      } else if (!prefersReducedMotion) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    rafId = requestAnimationFrame(renderFrame);
    const autoTimer = window.setTimeout(startFadeOut, 4000);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(autoTimer);
      window.removeEventListener('resize', resize);
    };
  }, [replayKey]);

  useEffect(() => {
    if (!isFadingOut) return;
    const timer = window.setTimeout(() => {
      if (!finishedRef.current) {
        finishedRef.current = true;
        onFinished();
      }
    }, 380);
    return () => window.clearTimeout(timer);
  }, [isFadingOut, onFinished]);

  return (
    <div
      data-testid="bsuir-intro-splash"
      role="button"
      tabIndex={0}
      aria-label="Пропустить заставку"
      onClick={startFadeOut}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
          startFadeOut();
        }
      }}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && isFadingOut && !finishedRef.current) {
          finishedRef.current = true;
          onFinished();
        }
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#101116] select-none cursor-pointer overflow-hidden"
      style={{
        opacity: isFadingOut ? 0 : 1,
        transform: isFadingOut ? 'scale(1.04)' : 'scale(1)',
        transition: 'opacity 360ms cubic-bezier(0.4, 0, 0.2, 1), transform 360ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
      <div
        ref={logoRef}
        className="relative z-10 flex items-center justify-center text-[#38A3FF] pointer-events-none"
        style={{ willChange: 'transform, opacity' }}
      >
        <BsuirLogoSvg size={168} />
      </div>
    </div>
  );
};
