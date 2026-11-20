import React, { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { triggerHaptic } from '../../services/telegram';

export interface IosTimePickerModalProps {
  isOpen: boolean;
  initialHour: number; // 0..23
  initialMinute: number; // 0..59
  onDismiss: () => void;
  onTimeSelected: (hour: number, minute: number) => void;
}

const ITEM_HEIGHT = 30;

interface WheelColumnProps {
  values: number[];
  selectedValue: number;
  onChange: (val: number) => void;
  ariaLabel: string;
}

const WheelColumn: React.FC<WheelColumnProps> = ({
  values,
  selectedValue,
  onChange,
  ariaLabel,
}) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const lastValRef = useRef(selectedValue);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const idx = values.indexOf(selectedValue);
    if (idx >= 0) {
      el.scrollTop = idx * ITEM_HEIGHT;
    }
  }, [selectedValue, values]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const idx = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollTop / ITEM_HEIGHT)));
    const nextVal = values[idx];
    if (nextVal !== lastValRef.current) {
      lastValRef.current = nextVal;
      triggerHaptic('selection');
      onChange(nextVal);
    }
  };

  return (
    <div
      ref={listRef}
      aria-label={ariaLabel}
      onScroll={handleScroll}
      className="h-[150px] w-[60px] overflow-y-auto snap-y snap-mandatory no-scrollbar relative"
    >
      <div className="h-[30px]" />
      <div className="h-[30px]" />
      {values.map((v) => {
        const isSelected = v === selectedValue;
        return (
          <button
            key={v}
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              onChange(v);
              if (listRef.current) {
                listRef.current.scrollTo({
                  top: Math.max(0, values.indexOf(v)) * ITEM_HEIGHT,
                  behavior: 'smooth',
                });
              }
            }}
            className={clsx(
              'w-full h-[30px] snap-center flex items-center justify-center bg-transparent border-0 cursor-pointer tabular-nums transition-all',
              isSelected ? 'text-s-22 font-bold text-[var(--text)]' : 'text-s-18 text-[var(--text-secondary)] opacity-50',
            )}
          >
            {String(v).padStart(2, '0')}
          </button>
        );
      })}
      <div className="h-[30px]" />
      <div className="h-[30px]" />
    </div>
  );
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

export const IosTimePickerModal: React.FC<IosTimePickerModalProps> = ({
  isOpen,
  initialHour,
  initialMinute,
  onDismiss,
  onTimeSelected,
}) => {
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(initialMinute);

  useEffect(() => {
    if (isOpen) {
      setHour(Math.max(0, Math.min(23, initialHour)));
      setMinute(Math.max(0, Math.min(59, initialMinute)));
    }
  }, [isOpen, initialHour, initialMinute]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Выберите время"
      onClick={onDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[320px] rounded-[24px] bg-[var(--card)] p-5 border border-[var(--border)] shadow-2xl"
      >
        <h2 className="text-s-18 font-bold text-[var(--text)] text-center mb-4">
          Выберите время
        </h2>

        <div className="relative flex items-center justify-center gap-2 py-2">
          {/* Center selection highlight band */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-4 right-4 top-1/2 -translate-y-1/2 h-[34px] rounded-[10px] border border-[var(--border)] bg-[var(--text)]/[0.05]"
          />
          <WheelColumn values={HOURS} selectedValue={hour} onChange={setHour} ariaLabel="Часы" />
          <span className="text-s-22 font-bold text-[var(--text)] pb-0.5">:</span>
          <WheelColumn values={MINUTES} selectedValue={minute} onChange={setMinute} ariaLabel="Минуты" />
        </div>

        <div className="flex gap-3 mt-5">
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
              onTimeSelected(hour, minute);
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
