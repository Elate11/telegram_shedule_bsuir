import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { BsuirScheduleResponse, Lesson } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { pushBackHandler, triggerHaptic } from '../../services/telegram';
import { cleanAuditory, formatDateDDMMYYYY, formatExamDateHeader } from '../../utils/formatters';
import {
  computeActiveLessonStatus,
  getUpcomingLessonDates,
  resolveAllGroupsForLesson,
} from '../../utils/scheduleMath';
import { colorWithAlpha } from '../ui/LiquidGlassSurface';

export interface LessonDetailModalProps {
  lesson: Lesson | null;
  isToday: boolean;
  currentGroup: string;
  employeeSchedules: Record<string, BsuirScheduleResponse>;
  onDismiss: () => void;
  onTeacherClick: (urlId: string, fullName: string) => void;
  onGroupClick: (groupName: string) => void;
  onUpcomingDateClick: (dayIndex: number) => void;
  onAddNoteClick: (lesson: Lesson) => void;
  onOpenNotesForSubject?: (subject: string) => void;
}

export const LessonDetailModal: React.FC<LessonDetailModalProps> = ({
  lesson,
  isToday,
  currentGroup,
  employeeSchedules,
  onDismiss,
  onTeacherClick,
  onGroupClick,
  onUpcomingDateClick,
  onAddNoteClick,
  onOpenNotesForSubject,
}) => {
  const { tokens, isDarkTheme } = useTheme();
  const [now, setNow] = useState<Date>(() => new Date());

  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const safeLesson = useMemo<Lesson | null>(() => {
    if (!lesson) return null;
    return {
      ...lesson,
      title: lesson.title ?? '',
      details: lesson.details ?? '',
      subjectFullName: lesson.subjectFullName ?? '',
      lessonType: lesson.lessonType ?? '',
      teacherName: lesson.teacherName ?? '',
      teacherFullName: lesson.teacherFullName ?? '',
      teacherPhoto: lesson.teacherPhoto ?? '',
      teacherUrlId: lesson.teacherUrlId ?? '',
      auditory: lesson.auditory ?? '',
      startTime: lesson.startTime ?? '',
      endTime: lesson.endTime ?? '',
      weeks: Array.isArray(lesson.weeks) ? lesson.weeks : [],
      studentGroups: Array.isArray(lesson.studentGroups) ? lesson.studentGroups : [],
    };
  }, [lesson]);

  useEffect(() => {
    if (!lesson) return;
    setNow(new Date());
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lesson]);

  const isOpen = Boolean(lesson);
  useEffect(() => {
    if (!isOpen) return;
    const handleDismiss = () => onDismissRef.current();
    const unsub = pushBackHandler(handleDismiss);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismissRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      unsub();
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const allGroups = useMemo(() => {
    if (!safeLesson) return [];
    return resolveAllGroupsForLesson(safeLesson, employeeSchedules, currentGroup);
  }, [safeLesson, employeeSchedules, currentGroup]);

  const todayKey = now.toDateString();
  const upcomingDates = useMemo(() => {
    if (!safeLesson || safeLesson.dateLesson) return [];
    return getUpcomingLessonDates(safeLesson, new Date(todayKey), 3);
  }, [safeLesson, todayKey]);

  if (!lesson || !safeLesson) return null;

  const fullTitle = (safeLesson.subjectFullName || safeLesson.title).trim();
  const titleFontSize =
    fullTitle.length > 35
      ? 'calc(21px * var(--text-scale, 1))'
      : fullTitle.length > 20
        ? 'calc(24px * var(--text-scale, 1))'
        : 'calc(28px * var(--text-scale, 1))';

  const effectiveIsToday =
    isToday &&
    (!safeLesson.dateLesson || safeLesson.dateLesson.trim() === formatDateDDMMYYYY(now));
  const activeStatus = computeActiveLessonStatus(safeLesson, now, effectiveIsToday);
  const teacherDisplay = (safeLesson.teacherFullName || safeLesson.teacherName || '').trim();
  const cleanedAud = cleanAuditory(safeLesson.auditory, safeLesson.title, safeLesson.lessonType);
  const auditoryText = safeLesson.auditory.trim() ? `ауд. ${cleanedAud}` : cleanedAud;
  const subgroupText =
    safeLesson.subgroup === 0 ? 'Вся группа' : `${safeLesson.subgroup} подгруппа`;

  const progressColor = activeStatus.isBreak ? '#FF9500' : tokens.accent;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={fullTitle}
      onClick={onDismiss}
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] max-h-[85vh] overflow-y-auto rounded-[24px] p-[22px] border shadow-2xl relative flex flex-col items-center text-center gap-[16px]"
        style={{
          backgroundColor: tokens.card,
          borderColor: tokens.border,
          color: tokens.text,
        }}
      >
        <button
          type="button"
          aria-label="Закрыть"
          onClick={onDismiss}
          className="absolute top-4 right-4 w-[32px] h-[32px] rounded-full flex items-center justify-center border cursor-pointer"
          style={{
            backgroundColor: isDarkTheme ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
            borderColor: tokens.border,
            color: tokens.textSecondary,
          }}
        >
          <X size={16} aria-hidden="true" />
        </button>

        {/* 1. Full Subject Title */}
        <h2
          className="font-semibold leading-[1.2] px-6 line-clamp-2"
          style={{ fontSize: titleFontSize, color: tokens.text }}
        >
          {fullTitle}
        </h2>

        {/* 2. Lesson Type */}
        <div className="flex flex-col items-center gap-[4px]">
          <span className="text-s-16 font-semibold" style={{ color: tokens.textSecondary }}>
            Тип занятия
          </span>
          <span
            className="font-bold leading-[1.2]"
            style={{ fontSize: 'calc(20px * var(--text-scale, 1))', color: tokens.text }}
          >
            {lesson.lessonType || 'Занятие'}
          </span>
        </div>

        {/* 3. Teacher */}
        {teacherDisplay && (
          <div className="flex flex-col items-center gap-[4px]">
            <span className="text-s-16 font-semibold" style={{ color: tokens.textSecondary }}>
              Преподаватель
            </span>
            {lesson.teacherUrlId ? (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('impact', 'light');
                  onTeacherClick(lesson.teacherUrlId, teacherDisplay);
                  onDismiss();
                }}
                className="font-bold leading-[1.25] bg-transparent border-0 p-0 cursor-pointer hover:underline"
                style={{ fontSize: 'calc(20px * var(--text-scale, 1))', color: tokens.accent }}
              >
                {teacherDisplay}
              </button>
            ) : (
              <span
                className="font-bold leading-[1.25]"
                style={{ fontSize: 'calc(20px * var(--text-scale, 1))', color: tokens.text }}
              >
                {teacherDisplay}
              </span>
            )}
          </div>
        )}

        {/* 4. Auditory */}
        {(lesson.auditory?.trim() || cleanedAud !== '—') && (
          <div className="flex flex-col items-center gap-[4px]">
            <span className="text-s-16 font-semibold" style={{ color: tokens.textSecondary }}>
              Аудитория
            </span>
            <span
              className="font-bold leading-[1.2]"
              style={{ fontSize: 'calc(20px * var(--text-scale, 1))', color: tokens.text }}
            >
              {auditoryText}
            </span>
          </div>
        )}

        {/* 5. Time & Subgroup */}
        <div className="flex flex-col items-center gap-[4px]">
          <span className="text-s-16 font-semibold" style={{ color: tokens.textSecondary }}>
            Время и подгруппа
          </span>
          <span
            className="font-bold leading-[1.25] tabular-nums"
            style={{ fontSize: 'calc(18px * var(--text-scale, 1))', color: tokens.text }}
          >
            {lesson.startTime} — {lesson.endTime} • {subgroupText}
          </span>
        </div>

        {/* 6. Live Active Pair Progress Box */}
        {activeStatus.isActive && (
          <div
            className="w-full rounded-[12px] p-[12px] flex flex-col gap-[8px]"
            style={{
              backgroundColor: isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
            }}
          >
            <span
              className="text-s-15 font-bold text-center tabular-nums"
              style={{ color: progressColor }}
            >
              {activeStatus.statusText}
            </span>

            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(activeStatus.progress * 100)}
              className="w-full h-[6px] rounded-[3px] relative overflow-hidden"
              style={{
                backgroundColor: isDarkTheme ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.10)',
              }}
            >
              <div
                className="h-full rounded-[3px] transition-[width] duration-500"
                style={{
                  width: `${Math.min(100, Math.max(0, activeStatus.progress * 100)).toFixed(2)}%`,
                  backgroundColor: progressColor,
                }}
              />
              {/* 40m / 5m / 40m break notch at 47.06% */}
              <div
                data-testid="break-notch"
                aria-hidden="true"
                className="absolute top-0 bottom-0 w-[2px]"
                style={{
                  left: `${(activeStatus.breakProgressNotch * 100).toFixed(2)}%`,
                  backgroundColor: isDarkTheme ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.45)',
                }}
              />
            </div>
          </div>
        )}

        {/* 7. Co-attending Groups */}
        {allGroups.length > 0 && (
          <div className="w-full flex flex-col items-center gap-[8px]">
            <span className="text-s-16 font-semibold" style={{ color: tokens.textSecondary }}>
              Группы на занятии
            </span>
            <div className="flex flex-wrap items-center justify-center gap-[8px]">
              {allGroups.map((grp) => {
                const isCurrent = grp === currentGroup;
                return (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      onGroupClick(grp);
                      onDismiss();
                    }}
                    className="rounded-full px-[10px] py-[4px] text-s-13 font-semibold border-0 cursor-pointer transition-opacity hover:opacity-85"
                    style={{
                      backgroundColor: isCurrent
                        ? tokens.accent
                        : colorWithAlpha(tokens.accent, 0.16),
                      color: isCurrent ? tokens.accentFg : tokens.accent,
                    }}
                  >
                    {grp}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 8. Exam vs Regular Footer */}
        {lesson.dateLesson ? (
          <div className="w-full flex flex-col items-center gap-[10px]">
            <div className="flex flex-col items-center gap-[2px]">
              <span className="text-s-16 font-semibold" style={{ color: tokens.textSecondary }}>
                Дата
              </span>
              <span className="text-s-18 font-bold" style={{ color: tokens.text }}>
                {formatExamDateHeader(lesson.dateLesson)}
              </span>
            </div>

            {lesson.note && (
              <div className="flex flex-col items-center gap-[2px]">
                <span className="text-s-16 font-semibold" style={{ color: tokens.textSecondary }}>
                  Примечание
                </span>
                <span className="text-s-15 font-medium" style={{ color: tokens.accent }}>
                  {lesson.note}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-[12px]">
            <div className="flex flex-col items-center gap-[2px]">
              <span className="text-s-16 font-semibold" style={{ color: tokens.textSecondary }}>
                Учебные недели
              </span>
              <span className="text-s-18 font-bold" style={{ color: tokens.text }}>
                {safeLesson.weeks.length > 0 ? safeLesson.weeks.join(', ') : '1, 2, 3, 4'}
              </span>
            </div>

            {upcomingDates.length > 0 && (
              <div className="w-full flex flex-col items-center gap-[8px]">
                <span className="text-s-16 font-semibold" style={{ color: tokens.textSecondary }}>
                  Ближайшие занятия
                </span>
                <div className="flex items-center justify-center gap-[8px]">
                  {upcomingDates.map((item) => (
                    <button
                      key={item.dayIndex}
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        onUpcomingDateClick(item.dayIndex);
                        onDismiss();
                      }}
                      className="rounded-[10px] px-[12px] py-[6px] border text-s-14 font-semibold cursor-pointer tabular-nums"
                      style={{
                        backgroundColor: 'transparent',
                        borderColor: tokens.border,
                        color: tokens.accent,
                      }}
                    >
                      {item.dateFormatted}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                triggerHaptic('impact', 'light');
                onDismiss();
                onAddNoteClick(lesson);
              }}
              className="w-full rounded-[12px] py-[12px] px-4 text-s-15 font-semibold border-0 cursor-pointer mt-1"
              style={{
                backgroundColor: tokens.accent,
                color: tokens.accentFg,
              }}
            >
              + Добавить заметку к паре
            </button>

            {onOpenNotesForSubject && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('impact', 'light');
                  onDismiss();
                  onOpenNotesForSubject(lesson.title);
                }}
                className="w-full rounded-[12px] py-[10px] px-4 text-s-14 font-semibold border cursor-pointer"
                style={{
                  backgroundColor: 'transparent',
                  borderColor: tokens.border,
                  color: tokens.accent,
                }}
              >
                Все заметки предмета
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
