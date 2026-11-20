import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  ChevronLeft,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Upload,
  Vibrate,
  X,
} from 'lucide-react';
import {
  AppleButtonSecondaryPill,
  AppleCard,
  AppleOptionChip,
  AppleSegmentedControl,
  ColorPickerModal,
  TransitionDemoBox,
  colorWithAlpha,
} from '../components/ui';
import { useAppData } from '../context/AppDataContext';
import { computeRelativeLuminance, useTheme } from '../context/ThemeContext';
import { triggerHaptic } from '../services/telegram';
import type {
  BgMode,
  NavMode,
  ReminderTiming,
  TransitionType,
} from '../types';

export interface CustomizationScreenProps {
  onBack: () => void;
  onReplayIntro?: () => void;
  onTestReminder?: () => void;
}

const REMINDER_OPTIONS: Array<{ id: ReminderTiming; label: string }> = [
  { id: '15_min_before', label: 'За 15 мин' },
  { id: '1_hour_before', label: 'За 1 час' },
  { id: '2_hours_before', label: 'За 2 часа' },
  { id: '1_day_before_18', label: 'За 1 день' },
  { id: 'custom_hours', label: 'Свой вариант' },
];

const TRANSITION_OPTIONS: Array<{ id: TransitionType; label: string }> = [
  { id: 'Slide', label: 'Слайд' },
  { id: 'Fade', label: 'Выцветание' },
  { id: 'Scale', label: 'Масштаб' },
  { id: 'Cube', label: 'Куб' },
  { id: 'Flip', label: 'Вращение' },
];

const NAV_MODES: Array<{ id: NavMode; label: string; desc: string }> = [
  {
    id: 'Hold',
    label: 'Зажатие',
    desc: 'Зажатием пальца: удержание для вызова меню',
  },
  {
    id: 'Swipe',
    label: 'Свайп',
    desc: 'Свайпом влево и вправо: перелистывание экранов жестом',
  },
  {
    id: 'Buttons',
    label: 'Кнопки',
    desc: 'Кнопками: 4 кнопки навигации внизу экрана',
  },
];

export const CustomizationScreen: React.FC<CustomizationScreenProps> = ({
  onBack,
  onReplayIntro,
  onTestReminder,
}) => {
  const {
    themeMode,
    isDarkTheme,
    tokens,
    customPrimary,
    customBackground,
    recommendedPalettes,
    savedPalettes,
    bgMode,
    bgBlur,
    bgDim,
    bgImageDataUrl,
    textSizeMultiplier,
    navMode,
    transitionType,
    transitionsEnabled,
    transitionSpeed,
    vibrationEnabled,
    vibrationStrength,
    introEnabled,
    reminderTiming,
    reminderCustomHours,
    setThemeMode,
    toggleTheme,
    setCustomPrimary,
    setCustomBackground,
    applyPalette,
    savePalette,
    removePalette,
    setBgMode,
    setBgBlur,
    setBgDim,
    setBgImageDataUrl,
    setTextSizeMultiplier,
    setNavMode,
    setTransitionType,
    setTransitionsEnabled,
    setTransitionSpeed,
    setVibrationEnabled,
    setVibrationStrength,
    setIntroEnabled,
    setReminderTiming,
    setReminderCustomHours,
    resetCustomization,
  } = useTheme();

  const {
    forceOffline,
    isOfflineMode,
    dataSource,
    apiBaseUrl,
    setForceOfflineMode,
    setApiBaseUrl,
  } = useAppData();

  const [colorPickerTarget, setColorPickerTarget] = useState<
    'primary' | 'background' | null
  >(null);
  const [apiInput, setApiInput] = useState(apiBaseUrl);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setApiInput(apiBaseUrl);
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 3500);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const secondaryPillAccent =
    !isDarkTheme && computeRelativeLuminance(tokens.accent) > 0.5
      ? '#1D1D1F'
      : tokens.accent;

  const strengthLabel =
    vibrationStrength < 0.35
      ? 'Слабая'
      : vibrationStrength < 0.7
        ? 'Средняя'
        : 'Сильная';

  const activeNavDesc =
    NAV_MODES.find((m) => m.id === navMode)?.desc ?? NAV_MODES[2].desc;

  const handlePhotoUpload: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBgImageDataUrl(reader.result);
        setBgMode('Gallery');
        triggerHaptic('notification', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTestNotification = () => {
    triggerHaptic('notification', 'warning');
    const detail =
      reminderTiming === 'custom_hours'
        ? `Напоминание сработает за ${reminderCustomHours} ч. до события!`
        : 'Напоминание сработает за выбранное время!';
    setToastMsg(`Событие: Тестовое событие — ${detail}`);
    onTestReminder?.();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('bsuir:test-reminder', {
          detail: { title: 'Событие: Тестовое событие', body: detail },
        }),
      );
    }
  };

  const handleReplayIntro = () => {
    triggerHaptic('selection');
    onReplayIntro?.();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bsuir:replay-intro'));
    }
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
          Кастомизация
        </h1>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-8 flex flex-col gap-3.5">
        {toastMsg && (
          <div
            role="status"
            className="rounded-[14px] px-4 py-2.5 text-s-13 font-semibold"
            style={{
              backgroundColor: colorWithAlpha(tokens.accent, 0.16),
              color: tokens.accent,
            }}
          >
            {toastMsg}
          </div>
        )}

        {/* 1. Theme & Top 3 Color Circles */}
        <AppleCard
          isDarkTheme={isDarkTheme}
          cardBg={tokens.card}
          cardBorder={tokens.border}
          className="flex flex-col gap-4"
        >
          <AppleSegmentedControl
            items={['Темная', 'Светлая']}
            selectedIndex={themeMode === 'dark' ? 0 : 1}
            onSelectIndex={(idx) => setThemeMode(idx === 0 ? 'dark' : 'light')}
            isDarkTheme={isDarkTheme}
            accentColor={tokens.accent}
          />

          <div className="grid grid-cols-3 gap-2 text-center">
            {/* Theme toggle circle */}
            <div className="flex flex-col items-center gap-1.5">
              <span
                className="text-s-12 font-medium"
                style={{ color: tokens.textSecondary }}
              >
                Тема
              </span>
              <button
                type="button"
                aria-label="Переключить тему"
                onClick={() => {
                  triggerHaptic('selection');
                  toggleTheme();
                }}
                className="w-[48px] h-[48px] rounded-full border-2 cursor-pointer"
                style={{
                  backgroundColor: isDarkTheme ? '#000000' : '#FFFFFF',
                  borderColor: tokens.border,
                }}
              />
              <span
                className="text-s-12 font-semibold"
                style={{ color: tokens.text }}
              >
                {isDarkTheme ? 'Темная' : 'Светлая'}
              </span>
            </div>

            {/* Primary color circle */}
            <div className="flex flex-col items-center gap-1.5">
              <span
                className="text-s-12 font-medium"
                style={{ color: tokens.textSecondary }}
              >
                Основной
              </span>
              <button
                type="button"
                aria-label="Выбрать основной цвет"
                onClick={() => setColorPickerTarget('primary')}
                className="w-[48px] h-[48px] rounded-full border-2 cursor-pointer"
                style={{
                  backgroundColor: customPrimary ?? tokens.accent,
                  borderColor: tokens.border,
                }}
              />
              <button
                type="button"
                onClick={() => setCustomPrimary(null)}
                className="text-s-12 font-medium cursor-pointer"
                style={{ color: tokens.accent }}
              >
                Сброс
              </button>
            </div>

            {/* Background color circle */}
            <div className="flex flex-col items-center gap-1.5">
              <span
                className="text-s-12 font-medium"
                style={{ color: tokens.textSecondary }}
              >
                Фон
              </span>
              <button
                type="button"
                aria-label="Выбрать цвет фона"
                onClick={() => setColorPickerTarget('background')}
                className="w-[48px] h-[48px] rounded-full border-2 cursor-pointer"
                style={{
                  backgroundColor: customBackground ?? tokens.actualBg,
                  borderColor: tokens.border,
                }}
              />
              <button
                type="button"
                onClick={() => setCustomBackground(null)}
                className="text-s-12 font-medium cursor-pointer"
                style={{ color: tokens.accent }}
              >
                Сброс
              </button>
            </div>
          </div>
        </AppleCard>

        {/* 2. Color Palettes */}
        <AppleCard
          isDarkTheme={isDarkTheme}
          cardBg={tokens.card}
          cardBorder={tokens.border}
          className="flex flex-col gap-3"
        >
          <div
            className="text-s-15 font-semibold"
            style={{ color: tokens.text }}
          >
            Сочетания цветов
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1">
            <button
              type="button"
              aria-label="Сохранить текущую палитру"
              onClick={() => {
                triggerHaptic('selection');
                savePalette({
                  primary: tokens.accent,
                  background: tokens.actualBg,
                });
              }}
              className="w-[60px] h-[60px] rounded-[12px] border shrink-0 flex items-center justify-center cursor-pointer"
              style={{
                borderColor: tokens.border,
                backgroundColor: tokens.cardLesson,
                color: tokens.text,
              }}
            >
              <Plus size={22} />
            </button>

            {savedPalettes.map((p) => {
              const selected =
                customPrimary === p.primary &&
                customBackground === p.background;
              return (
                <div key={p.id} className="relative shrink-0">
                  <button
                    type="button"
                    aria-label={`Применить палитру ${p.name ?? p.primary}`}
                    onClick={() => {
                      triggerHaptic('selection');
                      applyPalette(p.primary, p.background);
                    }}
                    className="w-[60px] h-[60px] rounded-[12px] border-2 flex items-center justify-center cursor-pointer"
                    style={{
                      backgroundColor: p.background,
                      borderColor: selected ? tokens.accent : tokens.border,
                    }}
                  >
                    <span
                      className="w-[24px] h-[24px] rounded-full"
                      style={{ backgroundColor: p.primary }}
                    />
                  </button>
                  <button
                    type="button"
                    aria-label={`Удалить палитру ${p.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removePalette(p.id);
                    }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/75 text-white flex items-center justify-center cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}

            {recommendedPalettes.map((p) => {
              const selected =
                customPrimary === p.primary &&
                customBackground === p.background;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-label={p.name ?? p.primary}
                  onClick={() => {
                    triggerHaptic('selection');
                    applyPalette(p.primary, p.background);
                  }}
                  className="w-[60px] h-[60px] rounded-[12px] border-2 shrink-0 flex items-center justify-center cursor-pointer"
                  style={{
                    backgroundColor: p.background,
                    borderColor: selected ? tokens.accent : tokens.border,
                  }}
                >
                  <span
                    className="w-[24px] h-[24px] rounded-full"
                    style={{ backgroundColor: p.primary }}
                  />
                </button>
              );
            })}
          </div>
        </AppleCard>

        {/* 3. Custom Background */}
        <AppleCard
          isDarkTheme={isDarkTheme}
          cardBg={tokens.card}
          cardBorder={tokens.border}
          className="flex flex-col gap-3"
        >
          <div
            className="text-s-15 font-semibold"
            style={{ color: tokens.text }}
          >
            Пользовательский фон
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {(
              [
                { id: 'Solid', label: 'Сплошной' },
                { id: 'Gallery', label: 'Фото' },
                { id: 'Gradient', label: 'Градиент' },
              ] as Array<{ id: BgMode; label: string }>
            ).map((mode) => (
              <AppleOptionChip
                key={mode.id}
                label={mode.label}
                isSelected={bgMode === mode.id}
                isDarkTheme={isDarkTheme}
                accentColor={tokens.accent}
                borderColorOverride={tokens.border}
                onClick={() => setBgMode(mode.id)}
              />
            ))}
          </div>

          {bgMode === 'Gallery' && (
            <div className="flex flex-col gap-2.5 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <AppleButtonSecondaryPill
                  isDarkTheme={isDarkTheme}
                  accentColor={secondaryPillAccent}
                  onClick={() => photoInputRef.current?.click()}
                >
                  <Upload size={15} />
                  <span>Выбрать фото</span>
                </AppleButtonSecondaryPill>
                {bgImageDataUrl && (
                  <button
                    type="button"
                    onClick={() => setBgImageDataUrl(null)}
                    className="text-s-13 font-medium cursor-pointer px-2"
                    style={{ color: tokens.accent }}
                  >
                    Сбросить фото
                  </button>
                )}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </div>

              <label className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-s-12">
                  <span style={{ color: tokens.textSecondary }}>Размытие</span>
                  <span style={{ color: tokens.text }}>
                    {Math.round(bgBlur * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={bgBlur}
                  onChange={(e) => setBgBlur(Number(e.target.value))}
                  aria-label="Размытие фона"
                  className="w-full accent-[var(--accent)]"
                />
              </label>

              <label className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-s-12">
                  <span style={{ color: tokens.textSecondary }}>Затемнение</span>
                  <span style={{ color: tokens.text }}>
                    {Math.round(bgDim * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={bgDim}
                  onChange={(e) => setBgDim(Number(e.target.value))}
                  aria-label="Затемнение фона"
                  className="w-full accent-[var(--accent)]"
                />
              </label>
            </div>
          )}

          {bgMode === 'Gradient' && (
            <label className="flex flex-col gap-1 pt-1">
              <div className="flex items-center justify-between text-s-12">
                <span style={{ color: tokens.textSecondary }}>Затемнение</span>
                <span style={{ color: tokens.text }}>
                  {Math.round(bgDim * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={bgDim}
                onChange={(e) => setBgDim(Number(e.target.value))}
                aria-label="Затемнение градиента"
                className="w-full accent-[var(--accent)]"
              />
            </label>
          )}
        </AppleCard>

        {/* 4. Event Reminders */}
        <AppleCard
          isDarkTheme={isDarkTheme}
          cardBg={tokens.card}
          cardBorder={tokens.border}
          className="flex flex-col gap-3"
        >
          <div
            className="text-s-15 font-semibold"
            style={{ color: tokens.text }}
          >
            Напоминания о событиях
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {REMINDER_OPTIONS.map((opt) => (
              <AppleOptionChip
                key={opt.id}
                label={opt.label}
                isSelected={reminderTiming === opt.id}
                isDarkTheme={isDarkTheme}
                accentColor={tokens.accent}
                borderColorOverride={tokens.border}
                onClick={() => setReminderTiming(opt.id)}
              />
            ))}
          </div>

          {reminderTiming === 'custom_hours' && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <span
                className="text-s-13 font-medium"
                style={{ color: tokens.textSecondary }}
              >
                Уведомить за (часов):
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Уменьшить часы напоминания"
                  onClick={() =>
                    setReminderCustomHours(Math.max(1, reminderCustomHours - 1))
                  }
                  className="w-8 h-8 rounded-[8px] border flex items-center justify-center cursor-pointer"
                  style={{
                    borderColor: tokens.border,
                    backgroundColor: tokens.cardLesson,
                    color: tokens.text,
                  }}
                >
                  <Minus size={14} />
                </button>
                <span
                  className="min-w-[44px] text-center text-s-14 font-semibold tabular-nums"
                  style={{ color: tokens.text }}
                >
                  {reminderCustomHours} ч.
                </span>
                <button
                  type="button"
                  aria-label="Увеличить часы напоминания"
                  onClick={() =>
                    setReminderCustomHours(Math.min(24, reminderCustomHours + 1))
                  }
                  className="w-8 h-8 rounded-[8px] border flex items-center justify-center cursor-pointer"
                  style={{
                    borderColor: tokens.border,
                    backgroundColor: tokens.cardLesson,
                    color: tokens.text,
                  }}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}

          <AppleButtonSecondaryPill
            isDarkTheme={isDarkTheme}
            accentColor={secondaryPillAccent}
            onClick={handleTestNotification}
            className="w-full"
          >
            <Bell size={15} />
            <span>Проверить уведомление</span>
          </AppleButtonSecondaryPill>
        </AppleCard>

        {/* 5. Vibration */}
        <AppleCard
          isDarkTheme={isDarkTheme}
          cardBg={tokens.card}
          cardBorder={tokens.border}
          className="flex flex-col gap-3"
        >
          <div
            className="text-s-15 font-semibold"
            style={{ color: tokens.text }}
          >
            Виброотклик
          </div>

          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-s-14" style={{ color: tokens.text }}>
              Включить вибрацию
            </span>
            <input
              type="checkbox"
              checked={vibrationEnabled}
              onChange={(e) => setVibrationEnabled(e.target.checked)}
              aria-label="Включить вибрацию"
              className="w-5 h-5 accent-[var(--accent)] cursor-pointer"
            />
          </label>

          {vibrationEnabled && (
            <>
              <label className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-s-12">
                  <span style={{ color: tokens.textSecondary }}>
                    Сила вибрации: {strengthLabel}
                  </span>
                  <span style={{ color: tokens.text }}>
                    {Math.round(vibrationStrength * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={vibrationStrength}
                  onChange={(e) => setVibrationStrength(Number(e.target.value))}
                  aria-label="Сила вибрации"
                  className="w-full accent-[var(--accent)]"
                />
              </label>

              <AppleButtonSecondaryPill
                isDarkTheme={isDarkTheme}
                accentColor={secondaryPillAccent}
                onClick={() => triggerHaptic('impact', 'medium')}
                className="w-full"
              >
                <Vibrate size={15} />
                <span>Проверить вибрацию</span>
              </AppleButtonSecondaryPill>
            </>
          )}
        </AppleCard>

        {/* 6. Display */}
        <AppleCard
          isDarkTheme={isDarkTheme}
          cardBg={tokens.card}
          cardBorder={tokens.border}
          className="flex flex-col gap-2.5"
        >
          <div
            className="text-s-15 font-semibold"
            style={{ color: tokens.text }}
          >
            Отображение
          </div>
          <label className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-s-13">
              <span style={{ color: tokens.textSecondary }}>Размер текста</span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: tokens.text }}
              >
                {textSizeMultiplier.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min={0.8}
              max={1.4}
              step={0.05}
              value={textSizeMultiplier}
              onChange={(e) => setTextSizeMultiplier(Number(e.target.value))}
              aria-label="Размер текста"
              className="w-full accent-[var(--accent)]"
            />
          </label>
        </AppleCard>

        {/* 7. Intro & Page Transitions */}
        <AppleCard
          isDarkTheme={isDarkTheme}
          cardBg={tokens.card}
          cardBorder={tokens.border}
          className="flex flex-col gap-3"
        >
          <div
            className="text-s-15 font-semibold"
            style={{ color: tokens.text }}
          >
            Заставка и переходы
          </div>

          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-s-14" style={{ color: tokens.text }}>
              Интро при входе
            </span>
            <input
              type="checkbox"
              checked={introEnabled}
              onChange={(e) => setIntroEnabled(e.target.checked)}
              aria-label="Интро при входе"
              className="w-5 h-5 accent-[var(--accent)] cursor-pointer"
            />
          </label>

          <AppleButtonSecondaryPill
            isDarkTheme={isDarkTheme}
            accentColor={secondaryPillAccent}
            onClick={handleReplayIntro}
            className="w-full"
          >
            <Play size={15} />
            <span>Посмотреть интро</span>
          </AppleButtonSecondaryPill>

          <div
            className="h-[0.5px]"
            style={{ backgroundColor: tokens.divider }}
          />

          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-s-14" style={{ color: tokens.text }}>
              Анимации переходов
            </span>
            <input
              type="checkbox"
              checked={transitionsEnabled}
              onChange={(e) => setTransitionsEnabled(e.target.checked)}
              aria-label="Анимации переходов"
              className="w-5 h-5 accent-[var(--accent)] cursor-pointer"
            />
          </label>

          {transitionsEnabled && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {TRANSITION_OPTIONS.map((tr) => {
                  const selected = transitionType === tr.id;
                  return (
                    <button
                      key={tr.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        triggerHaptic('selection');
                        setTransitionType(tr.id);
                      }}
                      className="rounded-[12px] border p-2 flex flex-col items-center gap-1.5 cursor-pointer"
                      style={{
                        borderColor: selected ? tokens.accent : tokens.border,
                        backgroundColor: selected
                          ? colorWithAlpha(tokens.accent, 0.12)
                          : tokens.cardLesson,
                      }}
                    >
                      <TransitionDemoBox
                        transitionType={tr.id}
                        speedMultiplier={transitionSpeed}
                        accentColor={tokens.accent}
                      />
                      <span
                        className="text-s-12 font-semibold"
                        style={{
                          color: selected ? tokens.accent : tokens.text,
                        }}
                      >
                        {tr.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <label className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-s-12">
                  <span style={{ color: tokens.textSecondary }}>
                    Скорость переходов
                  </span>
                  <span style={{ color: tokens.text }}>
                    {transitionSpeed.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2.5}
                  step={0.1}
                  value={transitionSpeed}
                  onChange={(e) => setTransitionSpeed(Number(e.target.value))}
                  aria-label="Скорость переходов"
                  className="w-full accent-[var(--accent)]"
                />
              </label>
            </>
          )}
        </AppleCard>

        {/* 8. Window Navigation Mode */}
        <AppleCard
          isDarkTheme={isDarkTheme}
          cardBg={tokens.card}
          cardBorder={tokens.border}
          className="flex flex-col gap-2.5"
        >
          <div
            className="text-s-15 font-semibold"
            style={{ color: tokens.text }}
          >
            Переключение между окнами
          </div>

          <AppleSegmentedControl
            items={NAV_MODES.map((m) => m.label)}
            selectedIndex={Math.max(
              0,
              NAV_MODES.findIndex((m) => m.id === navMode),
            )}
            onSelectIndex={(idx) => setNavMode(NAV_MODES[idx]?.id ?? 'Buttons')}
            isDarkTheme={isDarkTheme}
            accentColor={tokens.accent}
          />

          <p className="text-s-12" style={{ color: tokens.textSecondary }}>
            {activeNavDesc}
          </p>
        </AppleCard>

        {/* 9. Network & API */}
        <AppleCard
          isDarkTheme={isDarkTheme}
          cardBg={tokens.card}
          cardBorder={tokens.border}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-s-15 font-semibold"
              style={{ color: tokens.text }}
            >
              Сеть и API
            </span>
            <span
              className="text-s-12 font-semibold"
              style={{ color: tokens.accent }}
            >
              {isOfflineMode ? 'Оффлайн / Демо' : `Онлайн (${dataSource})`}
            </span>
          </div>

          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-s-14" style={{ color: tokens.text }}>
              Оффлайн / Демо-режим
            </span>
            <input
              type="checkbox"
              checked={forceOffline}
              onChange={(e) => {
                triggerHaptic('selection');
                void setForceOfflineMode(e.target.checked);
              }}
              aria-label="Оффлайн / Демо-режим"
              className="w-5 h-5 accent-[var(--accent)] cursor-pointer"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span
              className="text-s-12"
              style={{ color: tokens.textSecondary }}
            >
              API Base URL
            </span>
            <input
              type="text"
              value={apiInput}
              onChange={(e) => setApiInput(e.target.value)}
              placeholder="/api/v1"
              className="w-full rounded-[12px] border px-3.5 py-2 text-s-13 outline-none"
              style={{
                backgroundColor: tokens.cardLesson,
                borderColor: tokens.border,
                color: tokens.text,
              }}
            />
          </label>

          <div className="flex items-center gap-2">
            <AppleButtonSecondaryPill
              isDarkTheme={isDarkTheme}
              accentColor={secondaryPillAccent}
              onClick={() => {
                void setApiBaseUrl(apiInput.trim() || '/api/v1');
                setToastMsg('API URL сохранён');
              }}
              className="flex-1 h-[38px]"
            >
              Сохранить URL
            </AppleButtonSecondaryPill>
            <button
              type="button"
              onClick={() => {
                setApiInput('/api/v1');
                void setApiBaseUrl('/api/v1');
                setToastMsg('API URL сброшен');
              }}
              className="px-3 h-[38px] rounded-full border text-s-13 font-medium cursor-pointer"
              style={{ borderColor: tokens.border, color: tokens.textSecondary }}
            >
              Сброс URL
            </button>
          </div>
        </AppleCard>

        {/* Full Reset */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('impact', 'medium');
            resetCustomization();
            setToastMsg('Настройки оформления сброшены');
          }}
          className="mt-1 w-full h-[44px] rounded-full border flex items-center justify-center gap-2 text-s-14 font-semibold cursor-pointer"
          style={{
            borderColor: colorWithAlpha('#FF3B30', 0.45),
            color: '#FF3B30',
          }}
        >
          <RotateCcw size={15} />
          <span>Сбросить настройки оформления</span>
        </button>
      </div>

      {/* Color Picker Modal */}
      <ColorPickerModal
        isOpen={colorPickerTarget !== null}
        initialColor={
          colorPickerTarget === 'background'
            ? (customBackground ?? tokens.actualBg)
            : (customPrimary ?? tokens.accent)
        }
        onDismiss={() => setColorPickerTarget(null)}
        onColorSelected={(hex) => {
          if (colorPickerTarget === 'background') {
            setCustomBackground(hex);
          } else {
            setCustomPrimary(hex);
          }
          setColorPickerTarget(null);
        }}
      />
    </div>
  );
};
