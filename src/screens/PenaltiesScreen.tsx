import React, { useEffect } from 'react';
import { ChevronLeft, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { AppleCard } from '../components/ui';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/ThemeContext';
import { triggerHaptic } from '../services/telegram';
import { formatIsoToDDMMYYYY } from '../utils/formatters';

export interface PenaltiesScreenProps {
  onBack: () => void;
}

export const PenaltiesScreen: React.FC<PenaltiesScreenProps> = ({ onBack }) => {
  const { penalties, loadPenalties } = useAppData();
  const { tokens, isDarkTheme } = useTheme();

  useEffect(() => {
    void loadPenalties();
  }, [loadPenalties]);

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
            Взыскания и поощрения
          </h1>
          <p
            className="text-s-13 truncate"
            style={{ color: tokens.textSecondary }}
          >
            Приказы и распоряжения деканата
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('impact', 'light');
            void loadPenalties(true);
          }}
          aria-label="Обновить"
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer active:opacity-70 shrink-0"
          style={{ color: tokens.accent }}
        >
          <RefreshCw
            size={20}
            className={penalties.loading ? 'animate-spin' : ''}
          />
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6">
        {penalties.loading && penalties.items.length === 0 ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2
              size={28}
              className="animate-spin"
              style={{ color: tokens.accent }}
            />
          </div>
        ) : penalties.items.length === 0 ? (
          <div className="py-16 px-4 flex flex-col items-center justify-center text-center gap-2.5">
            <ShieldCheck size={40} style={{ color: greenColor }} />
            <div
              className="text-s-16 font-semibold"
              style={{ color: tokens.text }}
            >
              Дисциплинарных взысканий нет
            </div>
            <p
              className="text-s-13 max-w-xs"
              style={{ color: tokens.textSecondary }}
            >
              В базе ИИС БГУИР отсутствуют активные взыскания или замечания
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {penalties.items.map((p) => {
              const isPositive =
                /поощр/i.test(p.type) || /поощр|снят/i.test(p.status);
              const badgeColor = isPositive ? greenColor : redColor;
              const rawDir = (p.directiveNumber ?? '').trim();
              const directiveLabel = rawDir
                ? rawDir.startsWith('№')
                  ? `Приказ ${rawDir}`
                  : `Приказ №${rawDir}`
                : '';

              const metaParts = [
                p.date ? `Дата: ${formatIsoToDDMMYYYY(p.date)}` : '',
                directiveLabel,
              ].filter(Boolean);

              return (
                <AppleCard
                  key={p.id}
                  isDarkTheme={isDarkTheme}
                  cardBg={tokens.card}
                  cardBorder={tokens.border}
                  className="flex flex-col gap-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="text-s-16 font-semibold leading-snug"
                      style={{ color: tokens.text }}
                    >
                      {p.reason || p.type || 'Запись'}
                    </span>
                    <span
                      className="text-s-13 font-semibold shrink-0"
                      style={{ color: badgeColor }}
                    >
                      {p.status}
                    </span>
                  </div>

                  {p.note && p.note.trim() && (
                    <p
                      className="text-s-14 leading-[1.4]"
                      style={{ color: tokens.text }}
                    >
                      {p.note}
                    </p>
                  )}

                  {metaParts.length > 0 && (
                    <div
                      className="text-s-12"
                      style={{ color: tokens.textSecondary }}
                    >
                      {metaParts.join(' • ')}
                    </div>
                  )}
                </AppleCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
