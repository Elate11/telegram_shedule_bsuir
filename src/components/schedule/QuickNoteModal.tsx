import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, CalendarCheck, Pin, X } from 'lucide-react';
import type { Lesson, Note } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { pushBackHandler, triggerHaptic } from '../../services/telegram';
import { formatDateDDMMYYYY } from '../../utils/formatters';
import { findNextLessonForSubject, inferNoteLessonType } from '../../utils/scheduleMath';
import { colorWithAlpha } from '../ui/LiquidGlassSurface';

export interface QuickNoteModalProps {
  lesson: Lesson | null;
  allLessons: Lesson[];
  selectedDate: Date;
  subgroup: 0 | 1 | 2;
  onDismiss: () => void;
  onSave: (noteInput: Omit<Note, 'id'>) => Promise<void> | void;
}

export const QuickNoteModal: React.FC<QuickNoteModalProps> = ({
  lesson,
  allLessons,
  selectedDate,
  subgroup,
  onDismiss,
  onSave,
}) => {
  const { tokens, isDarkTheme } = useTheme();
  const [text, setText] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [targetMode, setTargetMode] = useState<'next' | 'current'>('current');
  const [isSaving, setIsSaving] = useState(false);

  const nextTarget = useMemo(() => {
    if (!lesson) return null;
    return findNextLessonForSubject(allLessons, lesson.title, selectedDate, {
      subgroup,
      afterTime: lesson.startTime,
    });
  }, [lesson, allLessons, selectedDate, subgroup]);

  const nextTargetRef = useRef(nextTarget);
  nextTargetRef.current = nextTarget;

  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!lesson) return;
    setText('');
    setIsPinned(false);
    setTargetMode(nextTargetRef.current ? 'next' : 'current');
    setIsSaving(false);
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

  if (!lesson) return null;

  const currentDayStr = formatDateDDMMYYYY(selectedDate);
  const chosenDate = targetMode === 'next' && nextTarget ? nextTarget.dateFormatted : currentDayStr;
  const chosenTime =
    targetMode === 'next' && nextTarget
      ? nextTarget.timeFormatted
      : lesson.startTime || null;

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSaving) return;
    setIsSaving(true);
    try {
      const resolvedType = inferNoteLessonType({
        lessonType: lesson.lessonType,
        text: trimmed,
      });
      triggerHaptic('notification', 'success');
      await onSave({
        subject: lesson.title,
        text: trimmed,
        date: chosenDate,
        time: chosenTime,
        isEvent: false,
        isPinned,
        lessonType: resolvedType,
        attachments: [],
      });
      onDismiss();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Заметка • ${lesson.title}`}
      onClick={onDismiss}
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[390px] rounded-[24px] p-[20px] border shadow-2xl flex flex-col gap-[14px]"
        style={{
          backgroundColor: tokens.card,
          borderColor: tokens.border,
          color: tokens.text,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <h2
            className="font-semibold truncate"
            style={{ fontSize: 'calc(19px * var(--text-scale, 1))', color: tokens.text }}
          >
            Заметка • {lesson.title}
          </h2>
          <button
            type="button"
            aria-label="Закрыть"
            onClick={onDismiss}
            className="w-[30px] h-[30px] rounded-full flex items-center justify-center border shrink-0 cursor-pointer"
            style={{
              backgroundColor: isDarkTheme ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              borderColor: tokens.border,
              color: tokens.textSecondary,
            }}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        {/* Target Date & Pin Chips */}
        <div className="flex flex-wrap gap-[8px]">
          {nextTarget && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setTargetMode('next');
              }}
              className="rounded-full px-3 py-[7px] text-s-13 font-semibold border inline-flex items-center gap-1.5 cursor-pointer"
              style={{
                backgroundColor:
                  targetMode === 'next' ? colorWithAlpha(tokens.accent, 0.16) : 'transparent',
                borderColor: targetMode === 'next' ? tokens.accent : tokens.border,
                color: targetMode === 'next' ? tokens.accent : tokens.textSecondary,
              }}
            >
              <CalendarCheck size={14} aria-hidden="true" />
              <span>К след. паре ({nextTarget.dateFormatted.slice(0, 5)})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setTargetMode('current');
            }}
            className="rounded-full px-3 py-[7px] text-s-13 font-semibold border inline-flex items-center gap-1.5 cursor-pointer"
            style={{
              backgroundColor:
                targetMode === 'current' ? colorWithAlpha(tokens.accent, 0.16) : 'transparent',
              borderColor: targetMode === 'current' ? tokens.accent : tokens.border,
              color: targetMode === 'current' ? tokens.accent : tokens.textSecondary,
            }}
          >
            <Calendar size={14} aria-hidden="true" />
            <span>Этот день ({currentDayStr.slice(0, 5)})</span>
          </button>

          <button
            type="button"
            aria-pressed={isPinned}
            onClick={() => {
              triggerHaptic('selection');
              setIsPinned((prev) => !prev);
            }}
            className="rounded-full px-3 py-[7px] text-s-13 font-semibold border inline-flex items-center gap-1.5 cursor-pointer"
            style={{
              backgroundColor: isPinned ? 'rgba(255, 149, 0, 0.18)' : 'transparent',
              borderColor: isPinned ? '#FF9500' : tokens.border,
              color: isPinned ? '#FF9500' : tokens.textSecondary,
            }}
          >
            <Pin size={14} aria-hidden="true" />
            <span>Закрепить</span>
          </button>
        </div>

        {/* Textarea */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Что нужно сделать к паре..."
          rows={4}
          className="w-full min-h-[100px] rounded-[14px] p-3 border outline-none resize-none text-s-15"
          style={{
            backgroundColor: isDarkTheme ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            borderColor: tokens.border,
            color: tokens.text,
          }}
        />

        {/* Actions */}
        <div className="flex items-center gap-[10px]">
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 h-[44px] rounded-[14px] text-s-15 font-semibold border cursor-pointer"
            style={{
              backgroundColor: 'transparent',
              borderColor: tokens.border,
              color: tokens.text,
            }}
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={!text.trim() || isSaving}
            onClick={() => void handleSave()}
            className="flex-[1.2] h-[44px] rounded-[14px] text-s-15 font-semibold border-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            style={{
              backgroundColor: tokens.accent,
              color: tokens.accentFg,
            }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};
