import React, { useEffect } from 'react';
import { ChevronLeft, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { AppleCard } from '../components/ui';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/ThemeContext';
import { getTelegramWebApp, triggerHaptic } from '../services/telegram';
import { formatIsoToDDMMYYYY } from '../utils/formatters';

export interface AnnouncementsScreenProps {
  onBack: () => void;
}

const EXCLUDED_EXTRA_KEYS = new Set([
  'id',
  'name',
  'title',
  'type',
  'date',
  'issued',
  'createdAt',
  'content',
  'reason',
  'url',
]);

const KEY_TRANSLATIONS: Record<string, string> = {
  'employee.fio': 'Преподаватель',
  status: 'Статус',
  number: 'Номер',
  amount: 'Сумма',
  'department.name': 'Отдел',
};

function extractExtraRows(
  item: Record<string, unknown>,
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];

  for (const [key, rawVal] of Object.entries(item)) {
    if (EXCLUDED_EXTRA_KEYS.has(key) || rawVal == null) continue;

    if (typeof rawVal === 'object' && !Array.isArray(rawVal)) {
      const nested = rawVal as Record<string, unknown>;
      for (const [subKey, subVal] of Object.entries(nested)) {
        if (subVal == null || typeof subVal === 'object') continue;
        const compoundKey = `${key}.${subKey}`;
        const strVal = String(subVal).trim();
        if (!strVal) continue;
        rows.push({
          label: KEY_TRANSLATIONS[compoundKey] ?? compoundKey,
          value: strVal,
        });
      }
      continue;
    }

    const strVal = String(rawVal).trim();
    if (!strVal) continue;
    rows.push({
      label: KEY_TRANSLATIONS[key] ?? key,
      value: strVal,
    });
  }

  return rows;
}

export const AnnouncementsScreen: React.FC<AnnouncementsScreenProps> = ({
  onBack,
}) => {
  const { announcements, loadAnnouncements } = useAppData();
  const { tokens, isDarkTheme } = useTheme();

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  const openExternal = (url: string) => {
    const tg = getTelegramWebApp() as
      | (ReturnType<typeof getTelegramWebApp> & { openLink?: (u: string) => void })
      | null;
    if (tg?.openLink) {
      tg.openLink(url);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

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

        <h1
          className="flex-1 min-w-0 font-semibold leading-tight truncate"
          style={{
            fontSize: 'calc(28px * var(--text-scale, 1))',
            color: tokens.text,
          }}
        >
          Объявления
        </h1>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('impact', 'light');
            void loadAnnouncements(true);
          }}
          aria-label="Обновить"
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer active:opacity-70 shrink-0"
          style={{ color: tokens.accent }}
        >
          <RefreshCw
            size={20}
            className={announcements.loading ? 'animate-spin' : ''}
          />
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6">
        {announcements.loading && announcements.items.length === 0 ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2
              size={28}
              className="animate-spin"
              style={{ color: tokens.accent }}
            />
          </div>
        ) : announcements.items.length === 0 ? (
          <div className="py-16 px-4 flex flex-col items-center justify-center text-center gap-3">
            <div
              className="font-bold leading-none opacity-50 select-none"
              style={{
                fontSize: 'calc(80px * var(--text-scale, 1))',
                color: tokens.textSecondary,
              }}
            >
              :(
            </div>
            <p
              className="font-medium text-center"
              style={{
                fontSize: 'calc(20px * var(--text-scale, 1))',
                color: tokens.textSecondary,
              }}
            >
              пока нет объявлений
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {announcements.items.map((item, idx) => {
              const record = item as Record<string, unknown>;
              const title =
                (typeof item.name === 'string' && item.name.trim()) ||
                (typeof item.title === 'string' && item.title.trim()) ||
                (typeof item.type === 'string' && item.type.trim()) ||
                'Запись';
              const rawDate =
                (typeof item.date === 'string' && item.date) ||
                (typeof record.issued === 'string' && record.issued) ||
                (typeof item.createdAt === 'string' && item.createdAt) ||
                '';
              const formattedDate = rawDate ? formatIsoToDDMMYYYY(rawDate) : '';
              const body =
                (typeof item.content === 'string' && item.content.trim()) ||
                (typeof record.reason === 'string' && record.reason.trim()) ||
                '';
              const extraRows = extractExtraRows(record);

              return (
                <AppleCard
                  key={item.id != null ? String(item.id) : `ann-${idx}`}
                  isDarkTheme={isDarkTheme}
                  cardBg={tokens.card}
                  cardBorder={tokens.border}
                  className="flex flex-col gap-1.5"
                >
                  <div
                    className="text-s-18 font-bold leading-snug"
                    style={{ color: tokens.text }}
                  >
                    {title}
                  </div>

                  {formattedDate && (
                    <div
                      className="text-s-12 font-semibold"
                      style={{ color: tokens.accent }}
                    >
                      {formattedDate}
                    </div>
                  )}

                  {body && (
                    <p
                      className="text-s-14 leading-[1.45]"
                      style={{ color: tokens.text }}
                    >
                      {body}
                    </p>
                  )}

                  {extraRows.map((row) => (
                    <div
                      key={`${row.label}-${row.value}`}
                      className="text-s-14"
                      style={{ color: tokens.textSecondary }}
                    >
                      {row.label}: {row.value}
                    </div>
                  ))}

                  {typeof item.url === 'string' && item.url.trim() && (
                    <button
                      type="button"
                      onClick={() => openExternal(item.url!)}
                      className="mt-1 self-start inline-flex items-center gap-1 text-s-13 font-semibold cursor-pointer"
                      style={{ color: tokens.accent }}
                    >
                      <span>Подробнее</span>
                      <ExternalLink size={13} />
                    </button>
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
