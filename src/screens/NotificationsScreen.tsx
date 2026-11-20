import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ChevronLeft, Loader2, RefreshCw } from 'lucide-react';
import {
  AppleOptionChip,
  AppleSearchInput,
  colorWithAlpha,
} from '../components/ui';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/ThemeContext';
import { triggerHaptic } from '../services/telegram';
import type { DeanNotification } from '../types';

export interface NotificationsScreenProps {
  onBack: () => void;
}

type NotificationFilter = 'all' | 'info' | 'success' | 'important';

function resolveTypeMeta(
  type: string,
  isDarkTheme: boolean,
  accent: string,
): { label: string; color: string } {
  const upper = (type ?? '').trim().toUpperCase();
  if (upper === 'SUCCESS') {
    return { label: 'Успешно', color: isDarkTheme ? '#4CC38A' : '#16A34A' };
  }
  if (upper === 'FAILURE') {
    return { label: 'Важное', color: isDarkTheme ? '#E5484D' : '#DC2626' };
  }
  if (upper === 'WARNING') {
    return { label: 'Внимание', color: '#FF9500' };
  }
  return { label: 'Инфо', color: accent };
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  onBack,
}) => {
  const { notifications, loadNotifications, markNotificationsRead } = useAppData();
  const { tokens, isDarkTheme } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<NotificationFilter>('all');
  const markedKeyRef = useRef('');

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const unreadIds = notifications.items
      .filter((n) => !n.isViewed)
      .map((n) => n.id);
    if (unreadIds.length === 0) return;
    const key = unreadIds.join(',');
    if (markedKeyRef.current === key) return;
    markedKeyRef.current = key;
    void markNotificationsRead(unreadIds);
  }, [markNotificationsRead, notifications.items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notifications.items.filter((item: DeanNotification) => {
      const upper = (item.type ?? '').trim().toUpperCase();
      if (selectedFilter === 'info' && upper !== 'INFO') return false;
      if (selectedFilter === 'success' && upper !== 'SUCCESS') return false;
      if (
        selectedFilter === 'important' &&
        upper !== 'FAILURE' &&
        upper !== 'WARNING'
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.message.toLowerCase().includes(q) ||
        item.date.toLowerCase().includes(q)
      );
    });
  }, [notifications.items, searchQuery, selectedFilter]);

  const filters: Array<{ id: NotificationFilter; label: string }> = [
    { id: 'all', label: 'Все' },
    { id: 'info', label: 'Инфо' },
    { id: 'success', label: 'Успешно' },
    { id: 'important', label: 'Важное' },
  ];

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
            Уведомления
          </h1>
          <p
            className="text-s-13 truncate"
            style={{ color: tokens.textSecondary }}
          >
            Деканат и ректорат • {notifications.items.length}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('impact', 'light');
            void loadNotifications(true);
          }}
          aria-label="Обновить"
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer active:opacity-70 shrink-0"
          style={{ color: tokens.accent }}
        >
          <RefreshCw
            size={20}
            className={notifications.loading ? 'animate-spin' : ''}
          />
        </button>
      </header>

      {/* Search & Filter Chips */}
      {notifications.items.length > 0 && (
        <div className="shrink-0 px-4 pb-3 flex flex-col gap-2.5">
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
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {filters.map((f) => (
              <AppleOptionChip
                key={f.id}
                label={f.label}
                isSelected={selectedFilter === f.id}
                isDarkTheme={isDarkTheme}
                accentColor={tokens.accent}
                borderColorOverride={tokens.border}
                onClick={() => setSelectedFilter(f.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6">
        {notifications.loading && notifications.items.length === 0 ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2
              size={28}
              className="animate-spin"
              style={{ color: tokens.accent }}
            />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center gap-2">
            <Bell
              size={36}
              style={{ color: tokens.textSecondary }}
              className="opacity-60"
            />
            <p
              className="text-s-15 font-medium"
              style={{ color: tokens.textSecondary }}
            >
              {searchQuery.trim() ? 'Ничего не найдено' : 'Уведомлений нет'}
            </p>
          </div>
        ) : (
          <div
            className="rounded-[18px] border overflow-hidden"
            style={{
              backgroundColor: tokens.card,
              borderColor: tokens.border,
            }}
          >
            {filteredItems.map((notif, idx) => {
              const meta = resolveTypeMeta(notif.type, isDarkTheme, tokens.accent);
              return (
                <div key={notif.id}>
                  <div className="px-4 py-3.5 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-s-12 font-semibold"
                        style={{ color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      <span
                        className="text-s-12 font-medium"
                        style={{ color: tokens.textSecondary }}
                      >
                        {notif.date}
                      </span>
                    </div>
                    <p
                      className="text-s-14 leading-[1.45]"
                      style={{ color: tokens.text }}
                    >
                      {notif.message}
                    </p>
                  </div>
                  {idx < filteredItems.length - 1 && (
                    <div
                      className="mx-4 h-[0.5px]"
                      style={{ backgroundColor: colorWithAlpha(tokens.border, 0.4) }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
