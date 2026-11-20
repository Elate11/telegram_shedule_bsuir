import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  BookOpen,
  Calendar,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Home,
  Info,
  LogOut,
  Pencil,
  Settings,
  Star,
  Users,
} from 'lucide-react';
import avatarImg from '../assets/avatar.png';
import {
  AppleCard,
  ApplePullToRefresh,
  colorWithAlpha,
} from '../components/ui';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/ThemeContext';
import { getTelegramWebApp, triggerHaptic } from '../services/telegram';

export type ProfileSubScreen =
  | 'notifications'
  | 'study'
  | 'gradebook'
  | 'marks'
  | 'group'
  | 'headman'
  | 'absences'
  | 'resume'
  | 'dormitory'
  | 'privileges'
  | 'penalties'
  | 'announcements'
  | 'customization';

export interface ProfileScreenProps {
  onNavigate: (screen: ProfileSubScreen) => void;
}

const GITHUB_URL = 'https://github.com/Elate11/IIS_BSUIR_Shedule_app';
const HOLD_DURATION_MS = 5000;

interface ProfileRowProps {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>;
  title: string;
  value?: string;
  badge?: string;
  accentColor: string;
  textColor: string;
  textSecondary: string;
  dividerColor: string;
  showDivider?: boolean;
  onClick: () => void;
}

const ProfileRow: React.FC<ProfileRowProps> = ({
  icon: Icon,
  title,
  value,
  badge,
  accentColor,
  textColor,
  textSecondary,
  dividerColor,
  showDivider = true,
  onClick,
}) => (
  <div>
    <button
      type="button"
      onClick={() => {
        triggerHaptic('selection');
        onClick();
      }}
      className="w-full px-4 py-3.5 flex items-center gap-3.5 text-left transition-opacity active:opacity-70 cursor-pointer"
    >
      <Icon size={20} style={{ color: accentColor }} className="shrink-0" />
      <span
        className="flex-1 min-w-0 truncate text-s-15 font-medium"
        style={{ color: textColor }}
      >
        {title}
      </span>
      {badge && (
        <span
          className="px-2 py-0.5 rounded-full text-s-12 font-semibold text-white shrink-0"
          style={{ backgroundColor: '#FF3B30' }}
        >
          {badge}
        </span>
      )}
      {!badge && value && (
        <span
          className="text-s-13 font-medium truncate max-w-[110px] shrink-0"
          style={{ color: textSecondary }}
        >
          {value}
        </span>
      )}
      <ChevronRight size={17} style={{ color: textSecondary }} className="shrink-0 opacity-70" />
    </button>
    {showDivider && (
      <div
        className="mx-4 h-[0.5px]"
        style={{ backgroundColor: dividerColor }}
        aria-hidden="true"
      />
    )}
  </div>
);

function resolveAvatarSrc(customDataUrl: string | null, profilePhoto: string): string {
  if (customDataUrl && customDataUrl.trim()) {
    return customDataUrl;
  }
  const raw = (profilePhoto ?? '').trim();
  if (!raw) return avatarImg;
  if (raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('/')) {
    return raw;
  }
  return `data:image/jpeg;base64,${raw}`;
}

async function scaleImageToDataUrl(file: File): Promise<string> {
  const readAsDataUrl = () =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Не удалось прочитать файл'));
        }
      };
      reader.onerror = () => reject(reader.error ?? new Error('Ошибка чтения файла'));
      reader.readAsDataURL(file);
    });

  const rawDataUrl = await readAsDataUrl();

  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    return rawDataUrl;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxSide = 800;
        const w = img.naturalWidth || img.width || maxSide;
        const h = img.naturalHeight || img.height || maxSide;
        const ratio = Math.min(1, maxSide / Math.max(w, h));
        const targetW = Math.max(1, Math.round(w * ratio));
        const targetH = Math.max(1, Math.round(h * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const scaled = canvas.toDataURL('image/png');
        resolve(scaled || rawDataUrl);
      } catch {
        resolve(rawDataUrl);
      }
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onNavigate }) => {
  const {
    profile,
    isAuthenticated,
    isOfflineMode,
    selectedGroup,
    logout,
    setCustomAvatar,
    refreshProfile,
  } = useAppData();
  const { tokens, isDarkTheme } = useTheme();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [showGroupSubtitle, setShowGroupSubtitle] = useState(true);
  const [holdProgress, setHoldProgress] = useState(0);
  const [maxVibrationActive, setMaxVibrationActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const holdIntervalRef = useRef<number | null>(null);
  const holdStartRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const maxVibIntervalRef = useRef<number | null>(null);

  const rawAvatarSrc = resolveAvatarSrc(profile.customAvatarDataUrl, profile.photo);
  const avatarSrc = avatarFailed ? avatarImg : rawAvatarSrc;

  useEffect(() => {
    setAvatarFailed(false);
  }, [rawAvatarSrc]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setShowGroupSubtitle((prev) => !prev);
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!maxVibrationActive) {
      if (maxVibIntervalRef.current !== null) {
        window.clearInterval(maxVibIntervalRef.current);
        maxVibIntervalRef.current = null;
      }
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(0);
      }
      return;
    }

    const pulse = () => {
      triggerHaptic('impact', 'heavy');
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([1000, 10]);
      }
    };
    pulse();
    maxVibIntervalRef.current = window.setInterval(pulse, 1020);

    return () => {
      if (maxVibIntervalRef.current !== null) {
        window.clearInterval(maxVibIntervalRef.current);
        maxVibIntervalRef.current = null;
      }
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(0);
      }
    };
  }, [maxVibrationActive]);

  useEffect(() => {
    return () => {
      if (holdIntervalRef.current !== null) {
        window.clearInterval(holdIntervalRef.current);
      }
    };
  }, []);

  const cancelHold = () => {
    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    holdStartRef.current = null;
    setHoldProgress(0);
  };

  const handleAvatarPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (maxVibrationActive) {
      setMaxVibrationActive(false);
      triggerHaptic('impact', 'light');
      return;
    }
    cancelHold();
    const startTime = Date.now();
    holdStartRef.current = { time: startTime, x: e.clientX, y: e.clientY };
    holdIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / HOLD_DURATION_MS);
      setHoldProgress(progress);
      if (progress >= 1) {
        cancelHold();
        triggerHaptic('impact', 'heavy');
        setMaxVibrationActive(true);
      }
    }, 50);
  };

  const handleAvatarPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!holdStartRef.current) return;
    const dx = e.clientX - holdStartRef.current.x;
    const dy = e.clientY - holdStartRef.current.y;
    if (Math.hypot(dx, dy) > 18) {
      cancelHold();
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAvatarFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await scaleImageToDataUrl(file);
      setCustomAvatar(dataUrl);
      triggerHaptic('notification', 'success');
    } catch {
      triggerHaptic('notification', 'error');
    }
  };

  const handleOpenGithub = () => {
    const tg = getTelegramWebApp() as
      | (ReturnType<typeof getTelegramWebApp> & { openLink?: (u: string) => void })
      | null;
    if (tg?.openLink) {
      tg.openLink(GITHUB_URL);
      return;
    }
    window.open(GITHUB_URL, '_blank', 'noopener,noreferrer');
  };

  const displayFio =
    profile.fio.trim() || (isAuthenticated ? 'Загрузка...' : 'Гость');
  const displayGroup = profile.group.trim() || selectedGroup || '310101';
  const groupSubtitle = `Группа ${displayGroup}`;
  const descSubtitle =
    profile.desc.trim() || (isAuthenticated ? 'Студент БГУИР' : 'Вход не выполнен');

  const ringRadius = 56;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - holdProgress);

  return (
    <ApplePullToRefresh
      isRefreshing={isRefreshing}
      onRefresh={() => {
        void handleRefresh();
      }}
      accentColor={tokens.accent}
      className="h-full overflow-y-auto px-4 pt-4 pb-8"
    >
      <div className="max-w-xl mx-auto flex flex-col items-center">
        {/* Avatar + 5s hold progress ring + upload pencil */}
        <div
          className="relative w-[122px] h-[122px] flex items-center justify-center select-none"
          onPointerDown={handleAvatarPointerDown}
          onPointerMove={handleAvatarPointerMove}
          onPointerUp={cancelHold}
          onPointerCancel={cancelHold}
          onPointerLeave={cancelHold}
        >
          {(holdProgress > 0 || maxVibrationActive) && (
            <svg
              width={122}
              height={122}
              viewBox="0 0 122 122"
              className="absolute inset-0 pointer-events-none -rotate-90"
              aria-hidden="true"
            >
              <circle
                cx={61}
                cy={61}
                r={ringRadius}
                fill="none"
                stroke="#FF3366"
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={maxVibrationActive ? 0 : ringOffset}
              />
            </svg>
          )}

          <div
            className="w-[108px] h-[108px] rounded-full p-[5px] border-2 flex items-center justify-center"
            style={{ borderColor: colorWithAlpha(tokens.text, 0.35) }}
          >
            <img
              src={avatarSrc}
              alt="Аватар профиля"
              onError={() => setAvatarFailed(true)}
              className="w-full h-full rounded-full object-cover"
            />
          </div>

          <button
            type="button"
            aria-label="Загрузить фото профиля"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="absolute bottom-1 right-1 w-[36px] h-[36px] rounded-full flex items-center justify-center shadow-md cursor-pointer"
            style={{ backgroundColor: '#EEEEEE', color: '#111111' }}
          >
            <Pencil size={17} />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            data-testid="avatar-file-input"
            className="hidden"
            onChange={(e) => {
              void handleAvatarFileChange(e);
            }}
          />
        </div>

        {/* FIO & 4s Crossfade subtitle */}
        <h2
          className="mt-3 text-center font-semibold leading-tight"
          style={{
            fontSize: 'calc(24px * var(--text-scale, 1))',
            color: tokens.text,
          }}
        >
          {displayFio}
        </h2>

        <div className="mt-1.5 min-h-[22px] flex items-center justify-center">
          <span
            key={showGroupSubtitle ? 'group' : 'desc'}
            className="text-s-14 text-center transition-opacity duration-500"
            style={{ color: tokens.textSecondary }}
          >
            {showGroupSubtitle ? groupSubtitle : descSubtitle}
          </span>
        </div>

        {/* Role & Status Badges */}
        {(profile.isHeadman || isOfflineMode) && (
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
            {profile.isHeadman && (
              <span
                className="px-3 py-1 rounded-full text-s-12 font-semibold"
                style={{
                  backgroundColor: colorWithAlpha('#FFB800', 0.18),
                  color: isDarkTheme ? '#FFB800' : '#B27A00',
                }}
              >
                Староста
              </span>
            )}
            {isOfflineMode && (
              <span
                className="px-3 py-1 rounded-full text-s-12 font-medium"
                style={{
                  backgroundColor: colorWithAlpha(tokens.accent, 0.14),
                  color: tokens.accent,
                }}
              >
                Демо / оффлайн
              </span>
            )}
          </div>
        )}

        {/* Section 1 */}
        <div className="w-full mt-5 flex flex-col gap-3.5">
          <AppleCard
            isDarkTheme={isDarkTheme}
            cardBg={tokens.card}
            cardBorder={tokens.border}
            className="p-0 overflow-hidden"
          >
            <ProfileRow
              icon={Bell}
              title="Уведомления"
              badge={
                profile.unreadNotifCount > 0
                  ? `${profile.unreadNotifCount} новых`
                  : undefined
              }
              accentColor={tokens.accent}
              textColor={tokens.text}
              textSecondary={tokens.textSecondary}
              dividerColor={tokens.divider}
              onClick={() => onNavigate('notifications')}
            />
            <ProfileRow
              icon={FileText}
              title="Учёба и справки"
              accentColor={tokens.accent}
              textColor={tokens.text}
              textSecondary={tokens.textSecondary}
              dividerColor={tokens.divider}
              onClick={() => onNavigate('study')}
            />
            <ProfileRow
              icon={BookOpen}
              title="Зачётка"
              accentColor={tokens.accent}
              textColor={tokens.text}
              textSecondary={tokens.textSecondary}
              dividerColor={tokens.divider}
              onClick={() => onNavigate('gradebook')}
            />
            <ProfileRow
              icon={Users}
              title="Группа"
              value={displayGroup}
              accentColor={tokens.accent}
              textColor={tokens.text}
              textSecondary={tokens.textSecondary}
              dividerColor={tokens.divider}
              onClick={() => onNavigate('group')}
            />
            {profile.isHeadman && (
              <ProfileRow
                icon={ClipboardCheck}
                title="Журнал старосты"
                accentColor={tokens.accent}
                textColor={tokens.text}
                textSecondary={tokens.textSecondary}
                dividerColor={tokens.divider}
                onClick={() => onNavigate('headman')}
              />
            )}
            <ProfileRow
              icon={Calendar}
              title="Пропуски"
              badge={
                profile.unexcusedHours > 0
                  ? `${profile.unexcusedHours} ч`
                  : undefined
              }
              accentColor={tokens.accent}
              textColor={tokens.text}
              textSecondary={tokens.textSecondary}
              dividerColor={tokens.divider}
              showDivider={false}
              onClick={() => onNavigate('absences')}
            />
          </AppleCard>

          {/* Section 2 */}
          <AppleCard
            isDarkTheme={isDarkTheme}
            cardBg={tokens.card}
            cardBorder={tokens.border}
            className="p-0 overflow-hidden"
          >
            <ProfileRow
              icon={BadgeCheck}
              title="Резюме и виджет ИИС"
              accentColor={tokens.accent}
              textColor={tokens.text}
              textSecondary={tokens.textSecondary}
              dividerColor={tokens.divider}
              onClick={() => onNavigate('resume')}
            />
            <ProfileRow
              icon={Home}
              title="Общежитие"
              accentColor={tokens.accent}
              textColor={tokens.text}
              textSecondary={tokens.textSecondary}
              dividerColor={tokens.divider}
              onClick={() => onNavigate('dormitory')}
            />
            <ProfileRow
              icon={Star}
              title="Льготы"
              accentColor={tokens.accent}
              textColor={tokens.text}
              textSecondary={tokens.textSecondary}
              dividerColor={tokens.divider}
              onClick={() => onNavigate('privileges')}
            />
            <ProfileRow
              icon={AlertTriangle}
              title="Взыскания и поощрения"
              accentColor={tokens.accent}
              textColor={tokens.text}
              textSecondary={tokens.textSecondary}
              dividerColor={tokens.divider}
              onClick={() => onNavigate('penalties')}
            />
            <ProfileRow
              icon={Info}
              title="Объявления"
              accentColor={tokens.accent}
              textColor={tokens.text}
              textSecondary={tokens.textSecondary}
              dividerColor={tokens.divider}
              showDivider={false}
              onClick={() => onNavigate('announcements')}
            />
          </AppleCard>

          {/* Section 3 */}
          <AppleCard
            isDarkTheme={isDarkTheme}
            cardBg={tokens.card}
            cardBorder={tokens.border}
            className="p-0 overflow-hidden"
          >
            <ProfileRow
              icon={Settings}
              title="Кастомизация"
              accentColor={tokens.accent}
              textColor={tokens.text}
              textSecondary={tokens.textSecondary}
              dividerColor={tokens.divider}
              showDivider={false}
              onClick={() => onNavigate('customization')}
            />
          </AppleCard>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('impact', 'medium');
              void logout();
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-s-16 font-medium cursor-pointer transition-opacity active:opacity-70"
            style={{ color: '#FF3B30' }}
          >
            <LogOut size={18} />
            <span>Выйти</span>
          </button>

          <button
            type="button"
            onClick={handleOpenGithub}
            className="inline-flex items-center gap-1.5 text-s-13 font-medium cursor-pointer opacity-80 hover:opacity-100"
            style={{ color: tokens.textSecondary }}
          >
            <span>GitHub</span>
            <ExternalLink size={13} />
          </button>
        </div>
      </div>
    </ApplePullToRefresh>
  );
};
