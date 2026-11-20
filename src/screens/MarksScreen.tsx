import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, ChevronLeft, Lock } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/ThemeContext';
import { pushBackHandler, triggerHaptic } from '../services/telegram';
import { AppleCard } from '../components/ui/AppleCard';
import { AppleOptionChip } from '../components/ui/AppleOptionChip';
import { ApplePullToRefresh } from '../components/ui/ApplePullToRefresh';
import { AppleSearchInput } from '../components/ui/AppleSearchInput';
import { colorWithAlpha } from '../components/ui/LiquidGlassSurface';

const MARK_GROUP_ORDER = ['ЛР', 'ПЗ', 'ЛК', 'СЕМ', 'КП'] as const;

export function MarksScreen(props: { onBack?: () => void }): React.JSX.Element {
  const { onBack } = props;
  const { academicProgress, isAuthenticated, loadMarksAndRating } = useAppData();
  const { tokens, isDarkTheme } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    void loadMarksAndRating();
  }, [loadMarksAndRating]);

  useEffect(() => {
    if (!onBack) return;
    return pushBackHandler(onBack);
  }, [onBack]);

  const subjects = academicProgress.subjects;

  const stats = useMemo(() => {
    const gradedSubjects = subjects.filter(
      (s) => typeof s.averageMark === 'number' && s.averageMark > 0,
    );
    const computedGpa =
      academicProgress.rating && academicProgress.rating > 0
        ? academicProgress.rating
        : gradedSubjects.length > 0
          ? gradedSubjects.reduce((acc, s) => acc + (s.averageMark ?? 0), 0) / gradedSubjects.length
          : 0;

    const totalAssignedLabs = subjects.reduce((acc, s) => acc + Math.max(0, s.totalLabs), 0);
    const totalSubmittedLabs = subjects.reduce(
      (acc, s) => acc + Math.max(0, s.submittedLabs),
      0,
    );
    const labProgressFraction =
      totalAssignedLabs > 0 ? Math.min(1, totalSubmittedLabs / totalAssignedLabs) : 0;
    const labsCompletionPercent = Math.round(labProgressFraction * 100);

    const statusLabel =
      computedGpa >= 8.0
        ? 'Отлично'
        : computedGpa >= 6.5
          ? 'Хорошо'
          : computedGpa >= 5.0
            ? 'Удовлетвор.'
            : 'Нет оценок';

    return {
      overallGpa: computedGpa,
      gradedSubjectsCount: gradedSubjects.length,
      statusLabel,
      totalAssignedLabs,
      totalSubmittedLabs,
      labProgressFraction,
      labsCompletionPercent,
    };
  }, [subjects, academicProgress.rating]);

  const filteredSubjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return subjects.filter((subj) => {
      if (selectedFilter === 1 && !subj.hasLabs) return false;
      if (selectedFilter === 2 && subj.marks.length === 0) return false;
      if (q) {
        const hay = `${subj.name} ${subj.abbrev}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [subjects, selectedFilter, searchQuery]);

  return (
    <ApplePullToRefresh
      isRefreshing={academicProgress.loading}
      onRefresh={() => void loadMarksAndRating(true)}
      accentColor={tokens.accent}
      className="h-full overflow-y-auto"
    >
      <div className="px-[20px] pt-[28px] pb-[48px] flex flex-col gap-[14px]">
        {/* Header */}
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              aria-label="Назад"
              onClick={() => {
                triggerHaptic('impact', 'light');
                onBack();
              }}
              className="w-[36px] h-[36px] -ml-1 rounded-full flex items-center justify-center bg-transparent border-0 cursor-pointer shrink-0"
              style={{ color: tokens.accent }}
            >
              <ChevronLeft size={28} aria-hidden="true" />
            </button>
          )}
          <h1
            className="font-bold leading-[1.15]"
            style={{ fontSize: 'calc(32px * var(--text-scale, 1))', color: tokens.text }}
          >
            Успеваемость
          </h1>
        </div>

        {/* Hero KPI Row */}
        <div className="grid grid-cols-2 gap-[12px]">
          <AppleCard
            isDarkTheme={isDarkTheme}
            cardBg={tokens.card}
            cardBorder={tokens.border}
            className="p-[16px] flex flex-col justify-between gap-2"
          >
            <div className="flex items-center gap-1.5">
              <BarChart3 size={16} style={{ color: tokens.textSecondary }} aria-hidden="true" />
              <span className="text-s-13 font-semibold" style={{ color: tokens.textSecondary }}>
                Средний балл
              </span>
            </div>
            <div
              className="font-semibold leading-none tabular-nums"
              style={{ fontSize: 'calc(32px * var(--text-scale, 1))', color: tokens.text }}
            >
              {stats.overallGpa > 0 ? stats.overallGpa.toFixed(2) : '—'}
            </div>
            <div className="flex items-center">
              <span
                className="rounded-[6px] px-[8px] py-[4px] text-s-11 font-medium leading-none"
                style={{
                  backgroundColor: colorWithAlpha(tokens.accent, isDarkTheme ? 0.16 : 0.1),
                  color: tokens.accent,
                }}
              >
                {stats.statusLabel}
                {stats.gradedSubjectsCount > 0 ? ` · ${stats.gradedSubjectsCount} предм.` : ''}
              </span>
            </div>
          </AppleCard>

          <AppleCard
            isDarkTheme={isDarkTheme}
            cardBg={tokens.card}
            cardBorder={tokens.border}
            className="p-[16px] flex flex-col justify-between gap-2"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={16} style={{ color: tokens.textSecondary }} aria-hidden="true" />
              <span className="text-s-13 font-semibold" style={{ color: tokens.textSecondary }}>
                Лабораторные
              </span>
            </div>
            <div className="flex items-baseline gap-1 tabular-nums">
              <span
                className="font-semibold leading-none"
                style={{ fontSize: 'calc(32px * var(--text-scale, 1))', color: tokens.text }}
              >
                {stats.totalSubmittedLabs}
              </span>
              <span
                className="font-normal"
                style={{ fontSize: 'calc(17px * var(--text-scale, 1))', color: tokens.textSecondary }}
              >
                / {stats.totalAssignedLabs}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <div
                className="w-full h-[6px] rounded-[3px] overflow-hidden"
                style={{
                  backgroundColor: isDarkTheme ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                }}
              >
                <div
                  className="h-full rounded-[3px] transition-all"
                  style={{
                    width: `${stats.labsCompletionPercent}%`,
                    backgroundColor: tokens.accent,
                  }}
                />
              </div>
              <span
                className="font-semibold leading-none"
                style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', color: tokens.accent }}
              >
                {stats.labProgressFraction >= 1 && stats.totalAssignedLabs > 0
                  ? 'Все сданы (100%)'
                  : `${stats.labsCompletionPercent}% сдано`}
              </span>
            </div>
          </AppleCard>
        </div>

        {/* Unauthenticated / Demo Banner */}
        {!isAuthenticated && (
          <AppleCard
            isDarkTheme={isDarkTheme}
            cardBg={tokens.card}
            cardBorder={tokens.border}
            className="p-[14px] flex items-start gap-3"
          >
            <div
              className="w-[36px] h-[36px] rounded-full flex items-center justify-center shrink-0"
              style={{
                backgroundColor: colorWithAlpha(tokens.accent, 0.15),
                color: tokens.accent,
              }}
            >
              <Lock size={17} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-s-14 font-semibold" style={{ color: tokens.text }}>
                Синхронизация с ИИС БГУИР
              </span>
              <span className="text-s-12 leading-[1.35]" style={{ color: tokens.textSecondary }}>
                Войдите в профиле в свой аккаунт ИИС БГУИР, чтобы загрузить персональные отметки и точное количество сданных лабораторных.
              </span>
            </div>
          </AppleCard>
        )}

        {/* Search & Filter Chips */}
        {(subjects.length > 3 || searchQuery.length > 0) && (
          <AppleSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Поиск"
            isDarkTheme={isDarkTheme}
            inputBg={tokens.card}
            inputBorder={tokens.border}
            inputTextColor={tokens.text}
            inputIconColor={tokens.textSecondary}
          />
        )}

        <div className="flex items-center gap-[8px] overflow-x-auto no-scrollbar">
          <AppleOptionChip
            label="Все"
            isSelected={selectedFilter === 0}
            onClick={() => setSelectedFilter(0)}
            isDarkTheme={isDarkTheme}
            accentColor={tokens.accent}
            unselectedBg={tokens.card}
            unselectedTextColor={tokens.text}
            borderColorOverride={tokens.border}
          />
          <AppleOptionChip
            label="Лабораторные"
            isSelected={selectedFilter === 1}
            onClick={() => setSelectedFilter(1)}
            isDarkTheme={isDarkTheme}
            accentColor={tokens.accent}
            unselectedBg={tokens.card}
            unselectedTextColor={tokens.text}
            borderColorOverride={tokens.border}
          />
          <AppleOptionChip
            label="С оценками"
            isSelected={selectedFilter === 2}
            onClick={() => setSelectedFilter(2)}
            isDarkTheme={isDarkTheme}
            accentColor={tokens.accent}
            unselectedBg={tokens.card}
            unselectedTextColor={tokens.text}
            borderColorOverride={tokens.border}
          />
        </div>

        {/* Loading / Empty / Subject Cards */}
        {academicProgress.loading && subjects.length === 0 ? (
          <div className="py-12 flex items-center justify-center">
            <div
              className="w-[36px] h-[36px] rounded-full border-[3px] border-t-transparent animate-spin"
              style={{ borderColor: tokens.accent, borderTopColor: 'transparent' }}
              role="status"
              aria-label="Загрузка успеваемости"
            />
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="py-12 flex flex-col items-center text-center gap-1.5">
            <span
              className="text-s-18 font-semibold"
              style={{ color: tokens.text }}
            >
              {searchQuery.trim() || selectedFilter !== 0 ? 'Ничего не найдено' : 'Нет предметов'}
            </span>
            <span className="text-s-14" style={{ color: tokens.textSecondary }}>
              {searchQuery.trim() || selectedFilter !== 0
                ? 'Попробуйте изменить поисковый запрос'
                : 'Данные по предметам пока отсутствуют'}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-[12px]">
            {filteredSubjects.map((subj, idx) => {
              const labPercent =
                subj.totalLabs > 0
                  ? Math.min(100, Math.round((subj.submittedLabs / subj.totalLabs) * 100))
                  : 0;

              // Group marks by lessonType
              const grouped = new Map<string, typeof subj.marks>();
              for (const m of subj.marks) {
                const rawType = (m.lessonType ?? 'ЛР').trim().toUpperCase();
                const normalized =
                  rawType.includes('ЛР')
                    ? 'ЛР'
                    : rawType.includes('ПЗ')
                      ? 'ПЗ'
                      : rawType.includes('ЛК')
                        ? 'ЛК'
                        : rawType.includes('СЕМ')
                          ? 'СЕМ'
                          : rawType.includes('КП')
                            ? 'КП'
                            : rawType || 'ЛР';
                const arr = grouped.get(normalized) ?? [];
                arr.push(m);
                grouped.set(normalized, arr);
              }

              const orderedKeys = [
                ...MARK_GROUP_ORDER.filter((k) => grouped.has(k)),
                ...Array.from(grouped.keys()).filter(
                  (k) => !(MARK_GROUP_ORDER as readonly string[]).includes(k),
                ),
              ];

              return (
                <AppleCard
                  key={subj.id ?? `${subj.abbrev}-${subj.name}-${idx}`}
                  isDarkTheme={isDarkTheme}
                  cardBg={tokens.card}
                  cardBorder={tokens.border}
                  className="p-[16px] flex flex-col gap-[10px]"
                >
                  {/* Top Row */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="font-bold truncate flex-1 min-w-0"
                      style={{
                        fontSize: 'calc(17px * var(--text-scale, 1))',
                        color: tokens.text,
                      }}
                    >
                      {subj.abbrev || subj.name}
                    </span>
                    <span
                      className="text-s-14 font-bold tabular-nums shrink-0"
                      style={{
                        color:
                          typeof subj.averageMark === 'number' && subj.averageMark > 0
                            ? tokens.accent
                            : colorWithAlpha(tokens.textSecondary, 0.55),
                      }}
                    >
                      {typeof subj.averageMark === 'number' && subj.averageMark > 0
                        ? subj.averageMark.toFixed(1)
                        : '—'}
                    </span>
                  </div>

                  {/* Middle Row: Labs Progress */}
                  {subj.hasLabs && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="font-medium"
                          style={{
                            fontSize: 'calc(12.5px * var(--text-scale, 1))',
                            color: tokens.textSecondary,
                          }}
                        >
                          Лабораторные: {subj.submittedLabs} из {subj.totalLabs} сдано
                        </span>
                        <span
                          className="text-s-12 font-bold tabular-nums"
                          style={{ color: tokens.accent }}
                        >
                          {labPercent}%
                        </span>
                      </div>
                      <div
                        className="w-full h-[6px] rounded-[3px] overflow-hidden"
                        style={{
                          backgroundColor: isDarkTheme
                            ? 'rgba(255,255,255,0.10)'
                            : 'rgba(0,0,0,0.08)',
                        }}
                      >
                        <div
                          className="h-full rounded-[3px] transition-all"
                          style={{
                            width: `${labPercent}%`,
                            backgroundColor: tokens.accent,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Bottom Row: Marks */}
                  {orderedKeys.length > 0 ? (
                    <div className="flex flex-col gap-2 pt-1">
                      {orderedKeys.map((typeKey) => {
                        const list = grouped.get(typeKey) ?? [];
                        return (
                          <div key={typeKey} className="flex items-center gap-2">
                            <span
                              className="w-[36px] shrink-0 text-s-12 font-bold"
                              style={{ color: tokens.accent }}
                            >
                              {typeKey}
                            </span>
                            <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                              {list.map((item, mIdx) => (
                                <span
                                  key={`${typeKey}-${mIdx}`}
                                  className="w-[32px] h-[32px] rounded-[8px] shrink-0 flex items-center justify-center text-s-16 font-bold tabular-nums border"
                                  style={{
                                    backgroundColor: isDarkTheme
                                      ? 'rgba(255,255,255,0.06)'
                                      : 'rgba(0,0,0,0.04)',
                                    borderColor: tokens.border,
                                    color: tokens.text,
                                  }}
                                >
                                  {item.mark}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span
                      style={{
                        fontSize: 'calc(12.5px * var(--text-scale, 1))',
                        color: colorWithAlpha(tokens.textSecondary, 0.7),
                      }}
                    >
                      Нет текущих отметок
                    </span>
                  )}
                </AppleCard>
              );
            })}
          </div>
        )}
      </div>
    </ApplePullToRefresh>
  );
}
