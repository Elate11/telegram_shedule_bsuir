import React, { useEffect, useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/ThemeContext';
import { parseMarkbookSemesters } from '../services/apiClient';
import { pushBackHandler, triggerHaptic } from '../services/telegram';
import { AppleCard } from '../components/ui/AppleCard';

function getMarkColor(markValue: string, isDarkTheme: boolean, secondaryColor: string): string {
  const trimmed = markValue.trim();
  if (!trimmed || trimmed.startsWith('—')) {
    return secondaryColor;
  }
  const lower = trimmed.toLowerCase();
  if (trimmed === '9' || trimmed === '10' || (lower.includes('зач') && !/не\s*зач/.test(lower))) {
    return isDarkTheme ? '#4CC38A' : '#2E7D32';
  }
  if (trimmed === '7' || trimmed === '8') {
    return isDarkTheme ? '#2196F3' : '#1565C0';
  }
  if (trimmed === '4' || trimmed === '5' || trimmed === '6') {
    return isDarkTheme ? '#FF9800' : '#E65100';
  }
  return isDarkTheme ? '#F44336' : '#B71C1C';
}

function getSemesterGpaColor(avg: number, isDarkTheme: boolean): string {
  if (avg >= 8) return isDarkTheme ? '#4CC38A' : '#2E7D32';
  if (avg >= 6) return isDarkTheme ? '#FF9800' : '#E65100';
  return isDarkTheme ? '#F44336' : '#B71C1C';
}

export function GradebookScreen(props: { onBack?: () => void }): React.JSX.Element {
  const { onBack } = props;
  const { markbook, isAuthenticated, loadMarkbook } = useAppData();
  const { tokens, isDarkTheme } = useTheme();

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadMarkbook().catch(() => {});
  }, [isAuthenticated, loadMarkbook]);

  useEffect(() => {
    if (!onBack) return;
    return pushBackHandler(onBack);
  }, [onBack]);

  const semesters = useMemo(() => parseMarkbookSemesters(markbook.data), [markbook.data]);

  return (
    <div
      className="h-full w-full overflow-y-auto px-[20px] pt-[28px] pb-[48px] flex flex-col gap-[16px]"
      style={{ color: tokens.text }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 pt-2">
        {onBack && (
          <button
            type="button"
            aria-label="Назад"
            onClick={() => {
              triggerHaptic('impact', 'light');
              onBack();
            }}
            className="w-[38px] h-[38px] -ml-1 rounded-full flex items-center justify-center bg-transparent border-0 cursor-pointer shrink-0"
            style={{ color: tokens.accent }}
          >
            <ChevronLeft size={30} aria-hidden="true" />
          </button>
        )}
        <h1
          className="font-semibold leading-[1.1]"
          style={{ fontSize: 'calc(33px * var(--text-scale, 1))', color: tokens.text }}
        >
          Зачетка
        </h1>
      </div>

      {/* States */}
      {!isAuthenticated ? (
        <div className="py-12 flex flex-col items-center text-center">
          <span className="text-s-18 font-semibold" style={{ color: '#F44336' }}>
            Необходима авторизация
          </span>
        </div>
      ) : markbook.loading && !markbook.data ? (
        <div className="py-12 flex items-center justify-center">
          <div
            className="w-[36px] h-[36px] rounded-full border-[3px] border-t-transparent animate-spin"
            style={{ borderColor: tokens.accent, borderTopColor: 'transparent' }}
            role="status"
            aria-label="Загрузка зачетки"
          />
        </div>
      ) : semesters.length === 0 ? (
        <div className="py-12 flex flex-col items-center text-center">
          <span className="text-s-18" style={{ color: tokens.textSecondary }}>
            Нет данных о сессиях
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-[14px]">
          {semesters.map((sem) => {
            const numericMarks: number[] = [];
            for (const m of sem.marks) {
              const num = Number.parseFloat(String(m.mark ?? '').replace(',', '.'));
              if (Number.isFinite(num) && /^\d+([.,]\d+)?$/.test(String(m.mark ?? '').trim())) {
                numericMarks.push(num);
              }
            }
            const computedAvg =
              numericMarks.length > 0
                ? numericMarks.reduce((a, b) => a + b, 0) / numericMarks.length
                : typeof sem.averageMark === 'number' && sem.averageMark > 0
                  ? sem.averageMark
                  : null;

            const semTitle =
              sem.semesterNumber > 0 ? `Семестр ${sem.semesterNumber}` : sem.title;

            return (
              <AppleCard
                key={sem.title}
                isDarkTheme={isDarkTheme}
                cardBg={tokens.card}
                cardBorder={tokens.border}
                className="p-[18px] flex flex-col gap-[6px]"
              >
                <h2
                  className="font-bold mb-1"
                  style={{ fontSize: 'calc(24px * var(--text-scale, 1))', color: tokens.text }}
                >
                  {semTitle}
                </h2>

                <div className="flex flex-col">
                  {sem.marks.map((item, idx) => {
                    const markText = String(item.mark ?? '—');
                    const markColor = getMarkColor(markText, isDarkTheme, tokens.textSecondary);
                    const isLast = idx === sem.marks.length - 1;
                    return (
                      <div
                        key={`${item.subject}-${idx}`}
                        className="py-[8px] flex items-center justify-between gap-3"
                        style={{
                          borderBottom: isLast ? 'none' : `1px solid ${tokens.divider}`,
                        }}
                      >
                        <span
                          className="flex-1 min-w-0 font-medium leading-[1.25]"
                          style={{
                            fontSize: 'calc(18px * var(--text-scale, 1))',
                            color: tokens.text,
                          }}
                        >
                          {item.subject}
                        </span>
                        <span
                          className="font-bold tabular-nums shrink-0 text-right"
                          style={{
                            fontSize: 'calc(22px * var(--text-scale, 1))',
                            color: markColor,
                          }}
                        >
                          {markText}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {computedAvg !== null && (
                  <div
                    className="pt-3 mt-1 flex items-center justify-between"
                    style={{ borderTop: `1px solid ${tokens.border}` }}
                  >
                    <span className="text-s-18 font-bold" style={{ color: tokens.text }}>
                      Средний балл
                    </span>
                    <span
                      className="text-s-22 font-semibold tabular-nums"
                      style={{ color: getSemesterGpaColor(computedAvg, isDarkTheme) }}
                    >
                      {computedAvg.toFixed(2)}
                    </span>
                  </div>
                )}
              </AppleCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
