import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
} from 'lucide-react';
import {
  AppleButtonPrimary,
  AppleOptionChip,
  colorWithAlpha,
} from '../components/ui';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/ThemeContext';
import { triggerHaptic } from '../services/telegram';
import type { HeadmanStudent, HeadmanSubject } from '../types';
import { formatDateDDMMYYYY } from '../utils/formatters';

export interface HeadmanJournalScreenProps {
  onBack: () => void;
}

const FALLBACK_SUBJECTS: HeadmanSubject[] = [
  { subjectAbbrev: 'ОАиП', termHoursId: 1, lessonTypeAbbrev: 'ЛК' },
  { subjectAbbrev: 'АиСД', termHoursId: 2, lessonTypeAbbrev: 'ЛР' },
  { subjectAbbrev: 'КСиС', termHoursId: 3, lessonTypeAbbrev: 'ПЗ' },
];

export const HeadmanJournalScreen: React.FC<HeadmanJournalScreenProps> = ({
  onBack,
}) => {
  const {
    headman,
    groupInfo,
    profile,
    isOfflineMode,
    loadHeadmanInit,
    loadHeadmanAttendance,
    saveHeadmanAttendance,
  } = useAppData();
  const { tokens, isDarkTheme } = useTheme();

  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [draftByLesson, setDraftByLesson] = useState<
    Record<number, Record<number, number>>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    text: string;
    isError?: boolean;
  } | null>(null);

  useEffect(() => {
    void loadHeadmanInit();
  }, [loadHeadmanInit]);

  const effectiveSubjects = useMemo<HeadmanSubject[]>(() => {
    if (headman.subjects.length > 0) return headman.subjects;
    if (!headman.hasAccess && !headman.loading) return FALLBACK_SUBJECTS;
    return [];
  }, [headman.hasAccess, headman.loading, headman.subjects]);

  const effectiveStudents = useMemo<HeadmanStudent[]>(() => {
    const raw =
      headman.students.length > 0
        ? headman.students
        : !headman.hasAccess && !headman.loading
          ? groupInfo.students.length > 0
            ? groupInfo.students.map((s, idx) => ({
                studentId: idx + 1,
                fio: s.fio,
                subgroup: 0,
              }))
            : [
                {
                  studentId: 1,
                  fio: profile.fio.trim() || 'Студент группы',
                  subgroup: 0,
                },
              ]
          : [];
    return [...raw].sort((a, b) => a.fio.localeCompare(b.fio, 'ru'));
  }, [
    groupInfo.students,
    headman.hasAccess,
    headman.loading,
    headman.students,
    profile.fio,
  ]);

  useEffect(() => {
    if (effectiveSubjects.length === 0) return;
    if (
      selectedSubjectId == null ||
      !effectiveSubjects.some((s) => s.termHoursId === selectedSubjectId)
    ) {
      setSelectedSubjectId(effectiveSubjects[0].termHoursId);
    }
  }, [effectiveSubjects, selectedSubjectId]);

  useEffect(() => {
    if (selectedSubjectId == null || !headman.hasAccess) return;
    void loadHeadmanAttendance(selectedSubjectId);
  }, [headman.hasAccess, loadHeadmanAttendance, selectedSubjectId]);

  const termData =
    selectedSubjectId != null
      ? headman.dataByTermHoursId[selectedSubjectId]
      : undefined;

  const effectiveLessons = useMemo(() => {
    if (termData?.lessons && termData.lessons.length > 0) {
      return termData.lessons.map((l) => ({
        id: l.id,
        date: l.date,
        subgroup: l.subgroup ?? 0,
        maxHours: Math.max(2, l.numberOfHours ?? 2),
      }));
    }
    if (!headman.hasAccess && !headman.loading && effectiveSubjects.length > 0) {
      return [
        {
          id: 1,
          date: formatDateDDMMYYYY(new Date()),
          subgroup: 0,
          maxHours: 2,
        },
      ];
    }
    return [];
  }, [effectiveSubjects.length, headman.hasAccess, headman.loading, termData]);

  useEffect(() => {
    if (effectiveLessons.length === 0) {
      setSelectedLessonId(null);
      return;
    }
    if (
      selectedLessonId == null ||
      !effectiveLessons.some((l) => l.id === selectedLessonId)
    ) {
      setSelectedLessonId(effectiveLessons[effectiveLessons.length - 1].id);
    }
  }, [effectiveLessons, selectedLessonId]);

  // Seed draft map whenever attendance data updates
  const initialLessonMap = useMemo(() => {
    const map: Record<number, number> = {};
    if (selectedLessonId == null) return map;
    const key = String(selectedLessonId);
    for (const rec of termData?.attendance ?? []) {
      map[rec.studentId] = rec.lessonRecords?.[key]?.missedHours ?? 0;
    }
    return map;
  }, [selectedLessonId, termData?.attendance]);

  const activeLesson =
    effectiveLessons.find((l) => l.id === selectedLessonId) ??
    effectiveLessons[0];
  const maxHours = activeLesson?.maxHours ?? 2;

  const currentMap: Record<number, number> = useMemo(() => {
    if (selectedLessonId == null) return {};
    const draft = draftByLesson[selectedLessonId];
    return draft ? { ...initialLessonMap, ...draft } : initialLessonMap;
  }, [draftByLesson, initialLessonMap, selectedLessonId]);

  const setStudentHours = (studentId: number, nextHours: number) => {
    if (selectedLessonId == null) return;
    const clamped = Math.max(0, Math.min(maxHours, nextHours));
    triggerHaptic('selection');
    setStatusMsg(null);
    setDraftByLesson((prev) => ({
      ...prev,
      [selectedLessonId]: {
        ...(prev[selectedLessonId] ?? initialLessonMap),
        [studentId]: clamped,
      },
    }));
  };

  const handleSave = async () => {
    if (selectedLessonId == null || isSaving) return;
    setIsSaving(true);
    setStatusMsg(null);
    try {
      const list = effectiveStudents
        .map((st) => ({
          student: st.studentId,
          hours: currentMap[st.studentId] ?? 0,
        }))
        .filter((entry) => {
          const orig = initialLessonMap[entry.student] ?? 0;
          return entry.hours > 0 || orig > 0;
        });

      await saveHeadmanAttendance({
        idLesson: selectedLessonId,
        studentOmissionsHoursDtoList: list,
      });
      triggerHaptic('notification', 'success');
      setStatusMsg({
        text:
          headman.hasAccess && !isOfflineMode
            ? 'Пропуски сохранены в ИИС БГУИР'
            : 'Отметки посещаемости сохранены',
      });
    } catch {
      triggerHaptic('notification', 'error');
      setStatusMsg({
        text: 'Не удалось сохранить ведомость посещаемости',
        isError: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const greenColor = isDarkTheme ? '#4CC38A' : '#16A34A';
  const redColor = isDarkTheme ? '#E5484D' : '#DC2626';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 px-4 pt-3 pb-2.5 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            onBack();
          }}
          aria-label="Назад"
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer active:opacity-70 shrink-0"
          style={{ color: tokens.text }}
        >
          <ChevronLeft size={24} />
        </button>

        <div className="flex-1 min-w-0">
          <h1
            className="font-semibold leading-tight truncate"
            style={{
              fontSize: 'calc(24px * var(--text-scale, 1))',
              color: tokens.text,
            }}
          >
            Журнал старосты
          </h1>
          <p
            className="text-s-13 truncate"
            style={{ color: tokens.textSecondary }}
          >
            {headman.hasAccess
              ? 'Выставление пропусков в ИИС БГУИР'
              : 'Локальный журнал посещаемости группы'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('impact', 'light');
            void loadHeadmanInit();
          }}
          aria-label="Обновить"
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer active:opacity-70 shrink-0"
          style={{ color: tokens.accent }}
        >
          <RefreshCw
            size={20}
            className={headman.loading ? 'animate-spin' : ''}
          />
        </button>
      </header>

      {/* Subject & Lesson Chips */}
      <div className="shrink-0 px-4 pb-3 flex flex-col gap-2">
        {effectiveSubjects.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {effectiveSubjects.map((opt) => (
              <AppleOptionChip
                key={opt.termHoursId}
                label={`${opt.subjectAbbrev} (${opt.lessonTypeAbbrev})`}
                isSelected={selectedSubjectId === opt.termHoursId}
                isDarkTheme={isDarkTheme}
                accentColor={tokens.accent}
                borderColorOverride={tokens.border}
                onClick={() => {
                  setSelectedSubjectId(opt.termHoursId);
                  setStatusMsg(null);
                }}
              />
            ))}
          </div>
        )}

        {effectiveLessons.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {effectiveLessons.map((l) => (
              <AppleOptionChip
                key={l.id}
                label={`${l.date}${l.subgroup > 0 ? ` • п/г ${l.subgroup}` : ''}`}
                isSelected={selectedLessonId === l.id}
                isDarkTheme={isDarkTheme}
                accentColor={tokens.accent}
                borderColorOverride={tokens.border}
                onClick={() => {
                  setSelectedLessonId(l.id);
                  setStatusMsg(null);
                }}
                className="py-1.5 px-3 text-s-13"
              />
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-8 flex flex-col gap-2.5">
        {statusMsg && (
          <div
            role="status"
            className="rounded-[14px] px-4 py-2.5 text-s-13 font-semibold"
            style={{
              backgroundColor: colorWithAlpha(
                statusMsg.isError ? redColor : greenColor,
                0.16,
              ),
              color: statusMsg.isError ? redColor : greenColor,
            }}
          >
            {statusMsg.text}
          </div>
        )}

        {headman.loading && effectiveStudents.length === 0 ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2
              size={28}
              className="animate-spin"
              style={{ color: tokens.accent }}
            />
          </div>
        ) : (
          <>
            {effectiveStudents.map((st) => {
              const missed = currentMap[st.studentId] ?? 0;
              return (
                <div
                  key={st.studentId}
                  className="rounded-[14px] border px-4 py-3 flex items-center justify-between gap-3 transition-colors"
                  style={{
                    backgroundColor: tokens.card,
                    borderColor: missed > 0 ? tokens.accent : tokens.border,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-s-15 font-medium truncate"
                      style={{ color: tokens.text }}
                    >
                      {st.fio}
                    </div>
                    {missed > 0 && (
                      <div
                        className="text-s-12 font-medium mt-0.5"
                        style={{ color: tokens.accent }}
                      >
                        Пропуск: {missed} ч
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      aria-label={`Уменьшить пропуск для ${st.fio}`}
                      disabled={missed <= 0}
                      onClick={() => setStudentHours(st.studentId, missed - 1)}
                      className="w-8 h-8 rounded-[8px] border flex items-center justify-center cursor-pointer disabled:opacity-40"
                      style={{
                        backgroundColor: tokens.cardLesson,
                        borderColor: tokens.border,
                        color: tokens.text,
                      }}
                    >
                      <Minus size={15} />
                    </button>

                    <span
                      className="min-w-[36px] text-center text-s-14 font-semibold tabular-nums"
                      style={{
                        color: missed > 0 ? tokens.accent : tokens.textSecondary,
                      }}
                    >
                      {missed} ч
                    </span>

                    <button
                      type="button"
                      aria-label={`Увеличить пропуск для ${st.fio}`}
                      disabled={missed >= maxHours}
                      onClick={() => setStudentHours(st.studentId, missed + 1)}
                      className="w-8 h-8 rounded-[8px] border flex items-center justify-center cursor-pointer disabled:opacity-40"
                      style={{
                        backgroundColor: tokens.cardLesson,
                        borderColor: tokens.border,
                        color: tokens.text,
                      }}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
              );
            })}

            {effectiveStudents.length > 0 && (
              <div className="pt-2">
                <AppleButtonPrimary
                  isDarkTheme={isDarkTheme}
                  accentColor={tokens.accent}
                  disabled={isSaving}
                  onClick={() => {
                    void handleSave();
                  }}
                  className="w-full rounded-[14px] h-[48px]"
                >
                  {isSaving
                    ? 'Сохранение...'
                    : 'Сохранить ведомость посещаемости'}
                </AppleButtonPrimary>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
