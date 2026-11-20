import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { StickyNote } from 'lucide-react';
import type { Lesson } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { triggerHaptic } from '../../services/telegram';
import { cleanAuditory } from '../../utils/formatters';
import { colorWithAlpha } from '../ui/LiquidGlassSurface';

export interface LessonCardProps {
  lesson: Lesson;
  isActive?: boolean;
  notePreview?: string | null;
  onClick: () => void;
  onLongClick?: () => void;
}

function formatTeacherShortName(lesson: Lesson): string {
  const raw = (lesson.teacherName || lesson.teacherFullName || '').trim();
  if (!raw) return '';
  if (raw.includes('.')) return raw;
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} ${parts[1][0]}.`;
  return `${parts[0]} ${parts[1][0]}. ${parts[2][0]}.`;
}

function getLessonBadgeStyle(
  lessonType: string,
  isDarkTheme: boolean,
  isActive: boolean,
  accent: string,
  accentFg: string,
  cardBg: string,
  textSecondary: string,
  border: string,
): { bg: string; color: string; borderColor: string } {
  const upper = lessonType.trim().toUpperCase();
  if (upper === 'ЛК' || upper.startsWith('ЛК')) {
    return isDarkTheme
      ? { bg: 'rgba(30, 70, 32, 0.85)', color: '#4ADE80', borderColor: 'rgba(74, 222, 128, 0.35)' }
      : { bg: '#DCFCE7', color: '#15803D', borderColor: 'rgba(21, 128, 61, 0.35)' };
  }
  if (upper === 'ЛР' || upper.includes('ЛР')) {
    return isDarkTheme
      ? { bg: 'rgba(92, 43, 10, 0.85)', color: '#FB923C', borderColor: 'rgba(251, 146, 60, 0.35)' }
      : { bg: '#FFEDD5', color: '#C2410C', borderColor: 'rgba(194, 65, 12, 0.35)' };
  }
  if (upper === 'ПЗ' || upper.includes('ПЗ')) {
    return isDarkTheme
      ? { bg: 'rgba(59, 30, 84, 0.85)', color: '#C084FC', borderColor: 'rgba(192, 132, 252, 0.35)' }
      : { bg: '#F3E8FF', color: '#7E22CE', borderColor: 'rgba(126, 34, 206, 0.35)' };
  }
  if (isActive) {
    return { bg: accent, color: accentFg, borderColor: 'transparent' };
  }
  return { bg: cardBg, color: textSecondary, borderColor: border };
}

export const LessonCard: React.FC<LessonCardProps> = ({
  lesson,
  isActive = false,
  notePreview,
  onClick,
  onLongClick,
}) => {
  const { tokens, isDarkTheme } = useTheme();
  const longTimerRef = useRef<number | null>(null);
  const latchResetTimerRef = useRef<number | null>(null);
  const longTriggeredRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongTimer = () => {
    if (longTimerRef.current !== null) {
      window.clearTimeout(longTimerRef.current);
      longTimerRef.current = null;
    }
    startPosRef.current = null;
  };

  const clearLatchResetTimer = () => {
    if (latchResetTimerRef.current !== null) {
      window.clearTimeout(latchResetTimerRef.current);
      latchResetTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearLongTimer();
      clearLatchResetTimer();
    };
  }, []);

  const badgeStyle = getLessonBadgeStyle(
    lesson.lessonType || 'Инфо',
    isDarkTheme,
    isActive,
    tokens.accent,
    tokens.accentFg,
    tokens.card,
    tokens.textSecondary,
    tokens.border,
  );

  const teacherLabel = formatTeacherShortName(lesson);
  const auditoryLabel = cleanAuditory(lesson.auditory, lesson.title, lesson.lessonType);
  const titleLabel =
    lesson.subgroup !== 0 ? `${lesson.title} (${lesson.subgroup} п.)` : lesson.title;

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={`${lesson.title} ${lesson.startTime}–${lesson.endTime}`}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      onPointerDown={(e) => {
        if (!onLongClick) return;
        longTriggeredRef.current = false;
        clearLongTimer();
        clearLatchResetTimer();
        startPosRef.current = { x: e.clientX, y: e.clientY };
        longTimerRef.current = window.setTimeout(() => {
          longTimerRef.current = null;
          longTriggeredRef.current = true;
          clearLatchResetTimer();
          latchResetTimerRef.current = window.setTimeout(() => {
            longTriggeredRef.current = false;
            latchResetTimerRef.current = null;
          }, 400);
          triggerHaptic('impact', 'medium');
          onLongClick();
        }, 450);
      }}
      onPointerMove={(e) => {
        if (!startPosRef.current) return;
        const dx = Math.abs(e.clientX - startPosRef.current.x);
        const dy = Math.abs(e.clientY - startPosRef.current.y);
        if (dx > 10 || dy > 10) {
          clearLongTimer();
        }
      }}
      onPointerUp={clearLongTimer}
      onPointerCancel={clearLongTimer}
      onPointerLeave={clearLongTimer}
      onClick={() => {
        if (longTriggeredRef.current) {
          longTriggeredRef.current = false;
          clearLatchResetTimer();
          return;
        }
        triggerHaptic('impact', 'light');
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          triggerHaptic('impact', 'light');
          onClick();
        }
      }}
      className="w-full rounded-[18px] px-[14px] py-[12px] flex items-center gap-[12px] cursor-pointer select-none transition-colors"
      style={{
        backgroundColor: isActive
          ? colorWithAlpha(tokens.accent, isDarkTheme ? 0.14 : 0.08)
          : 'transparent',
        border: isActive ? `1px solid ${colorWithAlpha(tokens.accent, 0.35)}` : '1px solid transparent',
      }}
    >
      {/* 1. Time column */}
      <div className="w-[56px] shrink-0 flex flex-col items-center justify-center tabular-nums">
        <span
          className="text-s-16 font-semibold leading-[1.2]"
          style={{ color: isActive ? tokens.accent : tokens.text }}
        >
          {lesson.startTime || '—'}
        </span>
        <span
          className="text-s-13 leading-[1.25] mt-[2px]"
          style={{ color: tokens.textSecondary }}
        >
          {lesson.endTime || ''}
        </span>
      </div>

      {/* 2. Lesson Type Badge */}
      <span
        className="shrink-0 rounded-[6px] px-[8px] py-[4px] border text-s-11 font-bold leading-none"
        style={{
          backgroundColor: badgeStyle.bg,
          color: badgeStyle.color,
          borderColor: badgeStyle.borderColor,
        }}
      >
        {lesson.lessonType || 'Инфо'}
      </span>

      {/* 3. Subject, teacher & note preview */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span
          className="text-s-16 font-medium leading-[1.25] truncate"
          style={{ color: tokens.text }}
        >
          {titleLabel}
        </span>

        {teacherLabel && (
          <span
            className="text-s-13 leading-[1.25] truncate mt-[2px]"
            style={{ color: tokens.textSecondary }}
          >
            {teacherLabel}
          </span>
        )}

        {notePreview && (
          <div className="flex items-center gap-[6px] mt-[3px] min-w-0">
            <span
              className="w-[6px] h-[6px] rounded-full shrink-0"
              style={{ backgroundColor: tokens.accent }}
            />
            <span
              className="text-s-12 font-medium leading-[1.2] truncate"
              style={{ color: tokens.accent }}
            >
              {notePreview}
            </span>
          </div>
        )}
      </div>

      {/* 4. Auditory chip + optional accessible quick-note trigger */}
      <div className="flex items-center gap-[6px] shrink-0">
        {onLongClick && (
          <button
            type="button"
            aria-label={`Быстрая заметка к ${lesson.title}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic('impact', 'light');
              onLongClick();
            }}
            className="w-[28px] h-[28px] rounded-[8px] flex items-center justify-center border cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
            style={{
              backgroundColor: 'transparent',
              borderColor: tokens.border,
              color: tokens.textSecondary,
            }}
          >
            <StickyNote size={13} aria-hidden="true" />
          </button>
        )}

        <span
          className="rounded-[8px] px-[10px] py-[6px] border text-s-13 font-medium leading-none tabular-nums"
          style={{
            backgroundColor: tokens.card,
            borderColor: tokens.border,
            color: tokens.text,
          }}
        >
          {auditoryLabel}
        </span>
      </div>
    </motion.div>
  );
};
