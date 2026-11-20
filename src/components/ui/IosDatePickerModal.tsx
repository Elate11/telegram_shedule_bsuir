import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { triggerHaptic } from '../../services/telegram';
import { colorWithAlpha } from './LiquidGlassSurface';

export interface IosDatePickerModalProps {
  isOpen: boolean;
  initialDay: number; // 1..31
  initialMonth: number; // 1..12
  initialYear: number;
  highlightedDates?: Set<string>; // 'DD.MM.YYYY'
  minDate?: Date;
  maxDate?: Date;
  onDismiss: () => void;
  onDateSelected: (day: number, month: number, year: number) => void;
}

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const WEEK_HEADERS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export const IosDatePickerModal: React.FC<IosDatePickerModalProps> = ({
  isOpen,
  initialDay,
  initialMonth,
  initialYear,
  highlightedDates,
  minDate,
  maxDate,
  onDismiss,
  onDateSelected,
}) => {
  const [viewMonth, setViewMonth] = useState(initialMonth);
  const [viewYear, setViewYear] = useState(initialYear);
  const [selected, setSelected] = useState({
    day: initialDay,
    month: initialMonth,
    year: initialYear,
  });

  useEffect(() => {
    if (isOpen) {
      setViewMonth(initialMonth);
      setViewYear(initialYear);
      setSelected({ day: initialDay, month: initialMonth, year: initialYear });
    }
  }, [isOpen, initialDay, initialMonth, initialYear]);

  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth - 1, 1);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const list: Array<number | null> = [];
    for (let i = 0; i < mondayOffset; i += 1) list.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) list.push(d);
    return list;
  }, [viewMonth, viewYear]);

  if (!isOpen) return null;

  const today = new Date();
  const todayD = today.getDate();
  const todayM = today.getMonth() + 1;
  const todayY = today.getFullYear();

  const minMs = minDate ? startOfDay(minDate) : null;
  const maxMs = maxDate ? startOfDay(maxDate) : null;

  const prevMonth = () => {
    triggerHaptic('selection');
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    triggerHaptic('selection');
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Выберите дату"
      onClick={onDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[360px] rounded-[24px] bg-[var(--card)] p-5 border border-[var(--border)] shadow-2xl"
      >
        <h2 className="text-s-18 font-bold text-[var(--text)] text-center mb-3">
          Выберите дату
        </h2>

        <div className="rounded-[16px] p-4 bg-[var(--card-lesson)] border border-[var(--border)]">
          {/* Month Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              aria-label="Предыдущий месяц"
              onClick={prevMonth}
              className="w-[32px] h-[32px] rounded-full flex items-center justify-center bg-[var(--card)] text-[var(--text)] cursor-pointer border border-[var(--border)]"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-s-21 font-bold text-[var(--text)]">
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </div>
            <button
              type="button"
              aria-label="Следующий месяц"
              onClick={nextMonth}
              className="w-[32px] h-[32px] rounded-full flex items-center justify-center bg-[var(--card)] text-[var(--text)] cursor-pointer border border-[var(--border)]"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2 text-center">
            {WEEK_HEADERS.map((h) => (
              <div key={h} className="text-s-14 font-bold text-[var(--text-secondary)]">
                {h}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="aspect-square" />;
              }

              const dateKey = `${String(day).padStart(2, '0')}.${String(viewMonth).padStart(2, '0')}.${viewYear}`;
              const isSelected =
                selected.day === day && selected.month === viewMonth && selected.year === viewYear;
              const isToday = day === todayD && viewMonth === todayM && viewYear === todayY;
              const isHighlighted = highlightedDates?.has(dateKey) ?? false;

              const cellMs = new Date(viewYear, viewMonth - 1, day).getTime();
              const outOfRange =
                (minMs !== null && cellMs < minMs) || (maxMs !== null && cellMs > maxMs);

              return (
                <button
                  key={dateKey}
                  type="button"
                  disabled={outOfRange}
                  onClick={() => {
                    triggerHaptic('selection');
                    setSelected({ day, month: viewMonth, year: viewYear });
                  }}
                  className={clsx(
                    'aspect-square rounded-full flex flex-col items-center justify-center text-s-14 relative cursor-pointer border-0 transition-colors',
                    isSelected && 'font-semibold text-[var(--accent-fg)]',
                    !isSelected && 'text-[var(--text)]',
                    outOfRange && 'opacity-30 pointer-events-none',
                  )}
                  style={{
                    backgroundColor: isSelected
                      ? 'var(--accent)'
                      : isHighlighted
                        ? colorWithAlpha('var(--accent)', 0.15)
                        : 'transparent',
                  }}
                >
                  <span>{day}</span>
                  {(isToday || isHighlighted) && (
                    <span
                      className="rounded-full mt-0.5"
                      style={{
                        width: isToday ? '4px' : '3px',
                        height: isToday ? '4px' : '3px',
                        backgroundColor: isSelected ? 'var(--accent-fg, #FFFFFF)' : 'var(--accent)',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 h-[48px] rounded-[14px] text-s-15 font-bold text-[var(--text)] bg-[var(--text)]/[0.08] cursor-pointer border-0"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('impact', 'light');
              onDateSelected(selected.day, selected.month, selected.year);
            }}
            className="flex-1 h-[48px] rounded-[14px] text-s-15 font-bold text-[var(--accent-fg)] bg-[var(--accent)] cursor-pointer border-0"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
