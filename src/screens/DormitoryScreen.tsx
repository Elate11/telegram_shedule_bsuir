import React, { useEffect, useState } from 'react';
import { ChevronLeft, Home, Loader2, RefreshCw, Star } from 'lucide-react';
import { AppleCard, AppleOptionChip } from '../components/ui';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/ThemeContext';
import { triggerHaptic } from '../services/telegram';
import { formatIsoToDDMMYYYY } from '../utils/formatters';

export interface DormitoryScreenProps {
  onBack: () => void;
  initialTab?: 0 | 1;
}

export const DormitoryScreen: React.FC<DormitoryScreenProps> = ({
  onBack,
  initialTab = 0,
}) => {
  const { dormitory, loadDormitoryData } = useAppData();
  const { tokens, isDarkTheme } = useTheme();
  const [selectedTab, setSelectedTab] = useState<0 | 1>(initialTab);

  useEffect(() => {
    setSelectedTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    void loadDormitoryData();
  }, [loadDormitoryData]);

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
            {selectedTab === 0 ? 'Общежитие' : 'Льготы'}
          </h1>
          <p
            className="text-s-13 truncate"
            style={{ color: tokens.textSecondary }}
          >
            Очередь на заселение и льготные категории
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('impact', 'light');
            void loadDormitoryData(true);
          }}
          aria-label="Обновить"
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer active:opacity-70 shrink-0"
          style={{ color: tokens.accent }}
        >
          <RefreshCw
            size={20}
            className={dormitory.loading ? 'animate-spin' : ''}
          />
        </button>
      </header>

      {/* Tabs */}
      <div className="shrink-0 px-4 pb-3 flex items-center gap-2">
        <AppleOptionChip
          label={`Заявки (${dormitory.applications.length})`}
          isSelected={selectedTab === 0}
          isDarkTheme={isDarkTheme}
          accentColor={tokens.accent}
          borderColorOverride={tokens.border}
          onClick={() => setSelectedTab(0)}
        />
        <AppleOptionChip
          label={`Льготы (${dormitory.privileges.length})`}
          isSelected={selectedTab === 1}
          isDarkTheme={isDarkTheme}
          accentColor={tokens.accent}
          borderColorOverride={tokens.border}
          onClick={() => setSelectedTab(1)}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6">
        {dormitory.loading &&
        dormitory.applications.length === 0 &&
        dormitory.privileges.length === 0 ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2
              size={28}
              className="animate-spin"
              style={{ color: tokens.accent }}
            />
          </div>
        ) : selectedTab === 0 ? (
          dormitory.applications.length === 0 ? (
            <div className="py-16 px-4 flex flex-col items-center justify-center text-center gap-2.5">
              <Home
                size={36}
                style={{ color: tokens.textSecondary }}
                className="opacity-60"
              />
              <div
                className="text-s-16 font-semibold"
                style={{ color: tokens.text }}
              >
                Заявок на общежитие нет
              </div>
              <p
                className="text-s-13 max-w-xs"
                style={{ color: tokens.textSecondary }}
              >
                Данные подтягиваются из очереди заселения ИИС БГУИР
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {dormitory.applications.map((d) => {
                const dateParts = [
                  d.applicationDate
                    ? `Подано: ${formatIsoToDDMMYYYY(d.applicationDate)}`
                    : '',
                  d.acceptedDate
                    ? `Принято: ${formatIsoToDDMMYYYY(d.acceptedDate)}`
                    : '',
                  d.settledDate
                    ? `Заселение: ${formatIsoToDDMMYYYY(d.settledDate)}`
                    : '',
                ].filter(Boolean);

                return (
                  <AppleCard
                    key={d.id}
                    isDarkTheme={isDarkTheme}
                    cardBg={tokens.card}
                    cardBorder={tokens.border}
                    className="flex flex-col gap-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="text-s-16 font-semibold"
                        style={{ color: tokens.text }}
                      >
                        {d.number != null
                          ? `Заявление №${d.number}`
                          : 'Заявление на заселение'}
                      </span>
                      <span
                        className="text-s-13 font-semibold shrink-0"
                        style={{ color: greenColor }}
                      >
                        {d.status}
                      </span>
                    </div>

                    {d.roomInfo && (
                      <div
                        className="text-s-15 font-medium"
                        style={{ color: tokens.accent }}
                      >
                        Место: {d.roomInfo}
                      </div>
                    )}

                    {d.numberInQueue && (
                      <div
                        className="text-s-14"
                        style={{ color: tokens.text }}
                      >
                        Номер в очереди: {d.numberInQueue}
                      </div>
                    )}

                    {dateParts.length > 0 && (
                      <div
                        className="text-s-12"
                        style={{ color: tokens.textSecondary }}
                      >
                        {dateParts.join(' • ')}
                      </div>
                    )}

                    {d.rejectionReason && d.rejectionReason.trim() && (
                      <div
                        className="text-s-13"
                        style={{ color: redColor }}
                      >
                        Причина: {d.rejectionReason}
                      </div>
                    )}
                  </AppleCard>
                );
              })}
            </div>
          )
        ) : dormitory.privileges.length === 0 ? (
          <div className="py-16 px-4 flex flex-col items-center justify-center text-center gap-2.5">
            <Star
              size={36}
              style={{ color: tokens.textSecondary }}
              className="opacity-60"
            />
            <div
              className="text-s-16 font-semibold"
              style={{ color: tokens.text }}
            >
              Зарегистрированных льгот нет
            </div>
            <p
              className="text-s-13 max-w-xs"
              style={{ color: tokens.textSecondary }}
            >
              Здесь отображаются категории первоочередного и внеочередного права
              на общежитие
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {dormitory.privileges.map((p) => (
              <AppleCard
                key={p.id}
                isDarkTheme={isDarkTheme}
                cardBg={tokens.card}
                cardBorder={tokens.border}
                className="flex flex-col gap-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="text-s-16 font-semibold"
                    style={{ color: tokens.text }}
                  >
                    {p.categoryName || 'Право на общежитие'}
                  </span>
                  {p.year != null && (
                    <span
                      className="text-s-13 font-semibold shrink-0"
                      style={{ color: tokens.accent }}
                    >
                      {p.year} г.
                    </span>
                  )}
                </div>

                {p.privilegeName && (
                  <p
                    className="text-s-14 leading-[1.4]"
                    style={{ color: tokens.text }}
                  >
                    {p.privilegeName}
                  </p>
                )}

                {p.note && p.note.trim() && (
                  <div
                    className="text-s-13"
                    style={{ color: tokens.textSecondary }}
                  >
                    Примечание: {p.note}
                  </div>
                )}
              </AppleCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
