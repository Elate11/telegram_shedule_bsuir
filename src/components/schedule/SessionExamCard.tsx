import React from 'react';
import { motion } from 'framer-motion';
import type { Lesson } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { triggerHaptic } from '../../services/telegram';
import { cleanAuditory } from '../../utils/formatters';
import { colorWithAlpha } from '../ui/LiquidGlassSurface';

export interface SessionExamCardProps {
  exam: Lesson;
  onClick: () => void;
  onTeacherClick?: (urlId: string, fullName: string) => void;
}

function getExamPillStyle(
  lessonType: string,
  isDarkTheme: boolean,
  accent: string,
): { bg: string; color: string } {
  const lower = lessonType.trim().toLowerCase();
  if (lower.includes('экз')) {
    return isDarkTheme
      ? { bg: 'rgba(255, 69, 58, 0.20)', color: '#FF6961' }
      : { bg: 'rgba(255, 59, 48, 0.12)', color: '#D70015' };
  }
  if (lower.includes('конс')) {
    return isDarkTheme
      ? { bg: 'rgba(10, 132, 255, 0.20)', color: '#64D2FF' }
      : { bg: 'rgba(0, 122, 255, 0.12)', color: '#0066CC' };
  }
  if (lower.includes('зач')) {
    return isDarkTheme
      ? { bg: 'rgba(255, 159, 10, 0.20)', color: '#FFB340' }
      : { bg: 'rgba(255, 149, 0, 0.12)', color: '#C97800' };
  }
  return { bg: colorWithAlpha(accent, 0.16), color: accent };
}

export const SessionExamCard: React.FC<SessionExamCardProps> = ({
  exam,
  onClick,
  onTeacherClick,
}) => {
  const { tokens, isDarkTheme } = useTheme();
  const pill = getExamPillStyle(exam.lessonType || 'Экзамен', isDarkTheme, tokens.accent);
  const auditoryLabel = cleanAuditory(exam.auditory, exam.title, exam.lessonType);
  const titleLabel =
    exam.subgroup !== 0 ? `${exam.title} (${exam.subgroup} п.)` : exam.title;
  const teacherDisplay = (exam.teacherName || exam.teacherFullName || '').trim();

  return (
    <motion.div
      role="button"
      tabIndex={0}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      onClick={() => {
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
      className="w-full rounded-[18px] p-[14px] border flex items-center gap-[12px] cursor-pointer select-none transition-colors"
      style={{
        backgroundColor: tokens.card,
        borderColor: tokens.border,
      }}
    >
      {/* 1. Time column */}
      <div className="w-[56px] shrink-0 flex flex-col items-center justify-center tabular-nums">
        <span
          className="text-s-16 font-semibold leading-[1.2]"
          style={{ color: tokens.text }}
        >
          {exam.startTime || '—'}
        </span>
        {exam.endTime && (
          <span
            className="text-s-13 leading-[1.25] mt-[2px]"
            style={{ color: tokens.textSecondary }}
          >
            {exam.endTime}
          </span>
        )}
      </div>

      {/* 2. Type pill */}
      <span
        className="shrink-0 rounded-full px-[8px] py-[4px] text-s-11 font-semibold leading-none whitespace-nowrap"
        style={{ backgroundColor: pill.bg, color: pill.color }}
      >
        {exam.lessonType || 'Экзамен'}
      </span>

      {/* 3. Subject & teacher */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span
          className="text-s-16 font-medium leading-[1.25] truncate"
          style={{ color: tokens.text }}
        >
          {titleLabel}
        </span>

        {teacherDisplay && (
          onTeacherClick && exam.teacherUrlId ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic('impact', 'light');
                onTeacherClick(exam.teacherUrlId, exam.teacherFullName || teacherDisplay);
              }}
              className="text-left text-s-13 leading-[1.25] truncate mt-[2px] bg-transparent border-0 p-0 cursor-pointer hover:underline"
              style={{ color: tokens.accent }}
            >
              {teacherDisplay}
            </button>
          ) : (
            <span
              className="text-s-13 leading-[1.25] truncate mt-[2px]"
              style={{ color: tokens.textSecondary }}
            >
              {teacherDisplay}
            </span>
          )
        )}

        {exam.note && (
          <span
            className="text-s-12 leading-[1.2] truncate mt-[3px]"
            style={{ color: tokens.accent }}
          >
            {exam.note}
          </span>
        )}
      </div>

      {/* 4. Auditory chip */}
      <span
        className="shrink-0 rounded-[8px] px-[10px] py-[6px] border font-semibold leading-none tabular-nums"
        style={{
          fontSize: 'calc(13.5px * var(--text-scale, 1))',
          backgroundColor: isDarkTheme ? '#2A2A2C' : '#FAFAFC',
          borderColor: tokens.border,
          color: tokens.text,
        }}
      >
        {auditoryLabel}
      </span>
    </motion.div>
  );
};
