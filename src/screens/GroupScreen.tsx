import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Users,
} from 'lucide-react';
import {
  AppleCard,
  AppleSearchInput,
  colorWithAlpha,
} from '../components/ui';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/ThemeContext';
import { triggerHaptic } from '../services/telegram';
import { formatGpa, formatPhoneBelarus } from '../utils/formatters';

export interface GroupScreenProps {
  onBack: () => void;
}

function getCuratorInitials(fio: string): string {
  const parts = fio.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'К';
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function resolveRoleColor(role: string, defaultAccent: string): string {
  const r = role.trim().toLowerCase();
  if (r.includes('старост') && !r.includes('зам')) return '#FFB800';
  if (r.includes('зам')) return '#FF9500';
  if (r.includes('спорт')) return '#34C759';
  if (r.includes('культ')) return '#AF52DE';
  if (r.includes('проф')) return '#007AFF';
  if (r.includes('брсм')) return '#FF3B30';
  return defaultAccent;
}

function resolveGpaColor(gpa: number, isDarkTheme: boolean): string {
  if (gpa >= 8.0) return isDarkTheme ? '#4CAF50' : '#2E7D32';
  if (gpa >= 6.0) return isDarkTheme ? '#FF9800' : '#E65100';
  return isDarkTheme ? '#F44336' : '#C62828';
}

export const GroupScreen: React.FC<GroupScreenProps> = ({ onBack }) => {
  const { groupInfo, loadGroupInfo, profile, selectedGroup } = useAppData();
  const { tokens, isDarkTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    void loadGroupInfo();
  }, [loadGroupInfo]);

  const displayGroup = profile.group.trim() || selectedGroup || '310101';

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groupInfo.students;
    return groupInfo.students.filter(
      (st) =>
        st.fio.toLowerCase().includes(q) ||
        (st.role ?? '').toLowerCase().includes(q),
    );
  }, [groupInfo.students, searchQuery]);

  const curator = groupInfo.curator;
  const formattedPhone = formatPhoneBelarus(curator?.phone);

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

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <h1
            className="font-semibold leading-tight truncate"
            style={{
              fontSize: 'calc(24px * var(--text-scale, 1))',
              color: tokens.text,
            }}
          >
            Список группы
          </h1>
          <span
            className="px-2.5 py-0.5 rounded-full text-s-12 font-semibold shrink-0"
            style={{
              backgroundColor: colorWithAlpha(tokens.accent, 0.15),
              color: tokens.accent,
            }}
          >
            {displayGroup}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('impact', 'light');
            void loadGroupInfo(true);
          }}
          aria-label="Обновить"
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer active:opacity-70 shrink-0"
          style={{ color: tokens.accent }}
        >
          <RefreshCw
            size={20}
            className={groupInfo.loading ? 'animate-spin' : ''}
          />
        </button>
      </header>

      {/* Search */}
      {groupInfo.students.length > 0 && (
        <div className="shrink-0 px-4 pb-3">
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
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 flex flex-col gap-3.5">
        {groupInfo.loading && groupInfo.students.length === 0 ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2
              size={28}
              className="animate-spin"
              style={{ color: tokens.accent }}
            />
          </div>
        ) : (
          <>
            {/* Curator Card */}
            {curator && (
              <AppleCard
                isDarkTheme={isDarkTheme}
                cardBg={tokens.card}
                cardBorder={tokens.border}
                className="flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-[44px] h-[44px] rounded-full flex items-center justify-center text-s-15 font-bold shrink-0"
                    style={{
                      backgroundColor: colorWithAlpha(tokens.accent, 0.16),
                      color: tokens.accent,
                    }}
                  >
                    {getCuratorInitials(curator.fio)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-s-11 font-semibold uppercase tracking-wide"
                      style={{ color: tokens.accent }}
                    >
                      Куратор группы
                    </div>
                    <div
                      className="text-s-16 font-bold leading-snug"
                      style={{ color: tokens.text }}
                    >
                      {curator.fio}
                    </div>
                    {curator.position &&
                      curator.position.trim() !== 'Куратор' && (
                        <div
                          className="text-s-12"
                          style={{ color: tokens.textSecondary }}
                        >
                          {curator.position}
                        </div>
                      )}
                  </div>
                </div>

                {formattedPhone && (
                  <a
                    href={`tel:${curator.phone.replace(/[^\d+]/g, '')}`}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-[12px] border transition-opacity active:opacity-75"
                    style={{
                      borderColor: tokens.divider,
                      backgroundColor: tokens.cardLesson,
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Phone size={17} style={{ color: '#34C759' }} className="shrink-0" />
                      <div className="min-w-0">
                        <div
                          className="text-s-11"
                          style={{ color: tokens.textSecondary }}
                        >
                          Телефон куратора
                        </div>
                        <div
                          className="text-s-14 font-medium truncate"
                          style={{ color: tokens.text }}
                        >
                          {formattedPhone}
                        </div>
                      </div>
                    </div>
                    <Phone size={15} style={{ color: '#34C759' }} className="shrink-0" />
                  </a>
                )}

                {curator.email && (
                  <a
                    href={`mailto:${curator.email}`}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-[12px] border transition-opacity active:opacity-75"
                    style={{
                      borderColor: tokens.divider,
                      backgroundColor: tokens.cardLesson,
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Mail size={17} style={{ color: '#007AFF' }} className="shrink-0" />
                      <div className="min-w-0">
                        <div
                          className="text-s-11"
                          style={{ color: tokens.textSecondary }}
                        >
                          Электронная почта
                        </div>
                        <div
                          className="text-s-14 font-medium truncate"
                          style={{ color: tokens.text }}
                        >
                          {curator.email}
                        </div>
                      </div>
                    </div>
                    <Mail size={15} style={{ color: '#007AFF' }} className="shrink-0" />
                  </a>
                )}
              </AppleCard>
            )}

            {/* Roster Counter */}
            <div
              className="text-s-13 font-medium px-1"
              style={{ color: tokens.textSecondary }}
            >
              Студентов в группе: {filteredStudents.length}
              {searchQuery.trim() ? ` (из ${groupInfo.students.length})` : ''}
            </div>

            {filteredStudents.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
                <Users
                  size={34}
                  style={{ color: tokens.textSecondary }}
                  className="opacity-60"
                />
                <p
                  className="text-s-14"
                  style={{ color: tokens.textSecondary }}
                >
                  Студенты не найдены
                </p>
              </div>
            ) : (
              <AppleCard
                isDarkTheme={isDarkTheme}
                cardBg={tokens.card}
                cardBorder={tokens.border}
                className="p-0 overflow-hidden"
              >
                {filteredStudents.map((st, idx) => {
                  const roleColor = st.role
                    ? resolveRoleColor(st.role, tokens.accent)
                    : tokens.accent;
                  const gpaColor =
                    st.averageMark != null
                      ? resolveGpaColor(st.averageMark, isDarkTheme)
                      : null;

                  return (
                    <div key={`${st.position}-${st.fio}`}>
                      <div className="px-4 py-3 flex items-center gap-2.5">
                        <span
                          className="w-[28px] text-s-13 font-semibold tabular-nums shrink-0"
                          style={{
                            color: st.isCurrentUser
                              ? tokens.accent
                              : tokens.textSecondary,
                          }}
                        >
                          {st.position}
                        </span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="text-s-15 leading-snug"
                              style={{
                                color: st.isCurrentUser ? tokens.accent : tokens.text,
                                fontWeight: st.isCurrentUser ? 600 : 500,
                              }}
                            >
                              {st.fio}
                            </span>

                            {st.isCurrentUser && (
                              <span
                                className="px-1.5 py-0.5 rounded-[6px] text-s-10_5 font-semibold shrink-0"
                                style={{
                                  backgroundColor: tokens.accent,
                                  color: tokens.accentFg,
                                }}
                              >
                                ВЫ
                              </span>
                            )}
                          </div>

                          {st.role && (
                            <span
                              className="inline-block mt-0.5 text-s-12 font-semibold"
                              style={{ color: roleColor }}
                            >
                              {st.role}
                            </span>
                          )}
                        </div>

                        {st.averageMark != null && gpaColor && (
                          <span
                            className="px-2 py-0.5 rounded-full text-s-12 font-semibold tabular-nums shrink-0"
                            style={{
                              backgroundColor: colorWithAlpha(gpaColor, 0.15),
                              color: gpaColor,
                            }}
                          >
                            {formatGpa(st.averageMark, 1)}
                          </span>
                        )}
                      </div>
                      {idx < filteredStudents.length - 1 && (
                        <div
                          className="mx-4 h-[0.5px]"
                          style={{ backgroundColor: tokens.divider }}
                        />
                      )}
                    </div>
                  );
                })}
              </AppleCard>
            )}
          </>
        )}
      </div>
    </div>
  );
};
