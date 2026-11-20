import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  BgMode,
  ColorPalette,
  NavMode,
  ReminderTiming,
  ThemeMode,
  ThemeTokens,
  TransitionType,
} from '../types';
import {
  getCloudItem,
  setCloudItem,
  setHapticConfig,
  syncTelegramChromeColors,
} from '../services/telegram';

const THEME_STORAGE_KEY = 'app_theme_settings_v1';

/**
 * Strictly the 6 Minimalist palettes from MainActivity.kt:11011-11017 (Dark & Light only).
 */
export const RECOMMENDED_PALETTES: ColorPalette[] = [
  { id: 'red-blush', name: 'Алый', primary: '#E53935', background: '#FFEBEE' },
  { id: 'green-mint', name: 'Мята', primary: '#43A047', background: '#E8F5E9' },
  { id: 'blue-sky', name: 'Лазурь', primary: '#1E88E5', background: '#E3F2FD' },
  { id: 'amber-charcoal', name: 'Янтарь', primary: '#FFB300', background: '#333333' },
  { id: 'cyan-obsidian', name: 'Циан', primary: '#00E5FF', background: '#111111' },
  { id: 'silver-pitch', name: 'Монохром', primary: '#E0E0E0', background: '#000000' },
];

const DARK_BASE_TOKENS: ThemeTokens = {
  bg: '#272729',
  actualBg: '#272729',
  card: '#2A2A2C',
  cardLesson: '#252527',
  text: '#FFFFFF',
  textSecondary: '#CCCCCC',
  accent: '#2997FF',
  accentFg: '#FFFFFF',
  accentFocus: '#2997FF',
  border: 'rgba(255, 255, 255, 0.12)',
  divider: 'rgba(255, 255, 255, 0.08)',
  glassBg: 'rgba(42, 42, 44, 0.72)',
  glassBorder: 'rgba(255, 255, 255, 0.18)',
};

const LIGHT_BASE_TOKENS: ThemeTokens = {
  bg: '#F5F5F7',
  actualBg: '#F5F5F7',
  card: '#FFFFFF',
  cardLesson: '#FAFAFC',
  text: '#1D1D1F',
  textSecondary: '#86868B',
  accent: '#0066CC',
  accentFg: '#FFFFFF',
  accentFocus: '#0071E3',
  border: 'rgba(0, 0, 0, 0.12)',
  divider: '#F0F0F0',
  glassBg: 'rgba(255, 255, 255, 0.72)',
  glassBorder: 'rgba(0, 0, 0, 0.10)',
};

export function clampNumber(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}

function parseHexChannels(color: string): [number, number, number] | null {
  const clean = color.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    const r = Number.parseInt(clean[0] + clean[0], 16);
    const g = Number.parseInt(clean[1] + clean[1], 16);
    const b = Number.parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    const r = Number.parseInt(clean.slice(0, 2), 16);
    const g = Number.parseInt(clean.slice(2, 4), 16);
    const b = Number.parseInt(clean.slice(4, 6), 16);
    return [r, g, b];
  }
  return null;
}

export function computeRelativeLuminance(hex: string): number {
  const channels = parseHexChannels(hex);
  if (!channels) return 0;
  const toLinear = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = channels;
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function getContrastForeground(hex: string): '#1D1D1F' | '#FFFFFF' {
  return computeRelativeLuminance(hex) > 0.5 ? '#1D1D1F' : '#FFFFFF';
}

function shiftHexColor(hex: string, amount: number): string {
  const channels = parseHexChannels(hex);
  if (!channels) return hex;
  const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const [r, g, b] = channels.map((c) => clampByte(c + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export interface PersistedThemeSettings {
  themeMode: ThemeMode;
  customPrimary: string | null;
  customBackground: string | null;
  savedPalettes: ColorPalette[];
  bgMode: BgMode;
  bgBlur: number;
  bgDim: number;
  bgImageDataUrl: string | null;
  textSizeMultiplier: number;
  navMode: NavMode;
  transitionType: TransitionType;
  transitionsEnabled: boolean;
  transitionSpeed: number;
  vibrationEnabled: boolean;
  vibrationStrength: number;
  introEnabled: boolean;
  reminderTiming: ReminderTiming;
  reminderCustomHours: number;
}

const DEFAULT_SETTINGS: PersistedThemeSettings = {
  themeMode: 'dark',
  customPrimary: null,
  customBackground: null,
  savedPalettes: [],
  bgMode: 'Solid',
  bgBlur: 0,
  bgDim: 0.35,
  bgImageDataUrl: null,
  textSizeMultiplier: 1.25,
  navMode: 'Buttons',
  transitionType: 'Slide',
  transitionsEnabled: true,
  transitionSpeed: 1.0,
  vibrationEnabled: true,
  vibrationStrength: 0.6,
  introEnabled: true,
  reminderTiming: '15_min_before',
  reminderCustomHours: 3,
};

const VALID_REMINDER_TIMINGS: ReadonlySet<string> = new Set<ReminderTiming>([
  '15_min_before',
  '1_hour_before',
  '2_hours_before',
  '1_day_before_18',
  'custom_hours',
]);

function sanitizeSettings(raw: Partial<PersistedThemeSettings> | null | undefined): PersistedThemeSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  const themeMode: ThemeMode = raw.themeMode === 'light' ? 'light' : 'dark';
  const navMode: NavMode =
    raw.navMode === 'Hold' || raw.navMode === 'Swipe' || raw.navMode === 'Buttons'
      ? raw.navMode
      : DEFAULT_SETTINGS.navMode;
  const transitionType: TransitionType =
    raw.transitionType === 'Slide' ||
    raw.transitionType === 'Fade' ||
    raw.transitionType === 'Scale' ||
    raw.transitionType === 'Cube' ||
    raw.transitionType === 'Flip'
      ? raw.transitionType
      : DEFAULT_SETTINGS.transitionType;
  const bgMode: BgMode =
    raw.bgMode === 'Solid' || raw.bgMode === 'Gradient' || raw.bgMode === 'Gallery'
      ? raw.bgMode
      : DEFAULT_SETTINGS.bgMode;
  const reminderTiming: ReminderTiming =
    typeof raw.reminderTiming === 'string' && VALID_REMINDER_TIMINGS.has(raw.reminderTiming)
      ? (raw.reminderTiming as ReminderTiming)
      : DEFAULT_SETTINGS.reminderTiming;

  return {
    themeMode,
    customPrimary: typeof raw.customPrimary === 'string' ? raw.customPrimary : null,
    customBackground: typeof raw.customBackground === 'string' ? raw.customBackground : null,
    savedPalettes: Array.isArray(raw.savedPalettes)
      ? raw.savedPalettes.filter(
          (p): p is ColorPalette =>
            Boolean(
              p &&
                typeof p === 'object' &&
                typeof p.id === 'string' &&
                typeof p.primary === 'string' &&
                typeof p.background === 'string',
            ),
        )
      : [],
    bgMode,
    bgBlur: clampNumber(typeof raw.bgBlur === 'number' ? raw.bgBlur : DEFAULT_SETTINGS.bgBlur, 0, 1),
    bgDim: clampNumber(typeof raw.bgDim === 'number' ? raw.bgDim : DEFAULT_SETTINGS.bgDim, 0, 1),
    bgImageDataUrl: typeof raw.bgImageDataUrl === 'string' ? raw.bgImageDataUrl : null,
    textSizeMultiplier: clampNumber(
      typeof raw.textSizeMultiplier === 'number' ? raw.textSizeMultiplier : DEFAULT_SETTINGS.textSizeMultiplier,
      0.8,
      1.4,
    ),
    navMode,
    transitionType,
    transitionsEnabled:
      typeof raw.transitionsEnabled === 'boolean' ? raw.transitionsEnabled : DEFAULT_SETTINGS.transitionsEnabled,
    transitionSpeed: clampNumber(
      typeof raw.transitionSpeed === 'number' ? raw.transitionSpeed : DEFAULT_SETTINGS.transitionSpeed,
      0.5,
      2.5,
    ),
    vibrationEnabled:
      typeof raw.vibrationEnabled === 'boolean' ? raw.vibrationEnabled : DEFAULT_SETTINGS.vibrationEnabled,
    vibrationStrength: clampNumber(
      typeof raw.vibrationStrength === 'number' ? raw.vibrationStrength : DEFAULT_SETTINGS.vibrationStrength,
      0.1,
      1.0,
    ),
    introEnabled: typeof raw.introEnabled === 'boolean' ? raw.introEnabled : DEFAULT_SETTINGS.introEnabled,
    reminderTiming,
    reminderCustomHours: clampNumber(
      typeof raw.reminderCustomHours === 'number' ? raw.reminderCustomHours : DEFAULT_SETTINGS.reminderCustomHours,
      1,
      24,
    ),
  };
}

function loadSyncSettings(): PersistedThemeSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return sanitizeSettings(JSON.parse(raw) as Partial<PersistedThemeSettings>);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function deriveThemeTokens(settings: Pick<PersistedThemeSettings, 'themeMode' | 'customPrimary' | 'customBackground' | 'bgMode'>): ThemeTokens {
  const base = settings.themeMode === 'light' ? LIGHT_BASE_TOKENS : DARK_BASE_TOKENS;
  const actualBg = settings.customBackground ?? base.actualBg;
  const bg = settings.bgMode === 'Solid' ? actualBg : 'transparent';

  let card = base.card;
  let cardLesson = base.cardLesson;
  if (settings.customBackground) {
    card = settings.themeMode === 'dark' ? shiftHexColor(settings.customBackground, 14) : '#FFFFFF';
    cardLesson = settings.themeMode === 'dark' ? shiftHexColor(settings.customBackground, 8) : '#FAFAFC';
  }

  const accent = settings.customPrimary ?? base.accent;
  const accentFg = getContrastForeground(accent);

  return {
    ...base,
    bg,
    actualBg,
    card,
    cardLesson,
    text: settings.customPrimary ?? base.text,
    accent,
    accentFg,
    accentFocus: settings.customPrimary ?? base.accentFocus,
  };
}

export function applyThemeToDom(
  themeMode: ThemeMode,
  tokens: ThemeTokens,
  textSizeMultiplier: number,
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const clampedScale = clampNumber(textSizeMultiplier, 0.8, 1.4);

  root.dataset.theme = themeMode;
  root.style.colorScheme = themeMode;

  const s = root.style;
  s.setProperty('--bg', tokens.bg);
  s.setProperty('--actual-bg', tokens.actualBg);
  s.setProperty('--card', tokens.card);
  s.setProperty('--card-lesson', tokens.cardLesson);
  s.setProperty('--text', tokens.text);
  s.setProperty('--text-secondary', tokens.textSecondary);
  s.setProperty('--accent', tokens.accent);
  s.setProperty('--accent-fg', tokens.accentFg);
  s.setProperty('--accent-focus', tokens.accentFocus);
  s.setProperty('--border', tokens.border);
  s.setProperty('--divider', tokens.divider);
  s.setProperty('--glass-bg', tokens.glassBg);
  s.setProperty('--glass-border', tokens.glassBorder);
  s.setProperty('--font-scale', String(clampedScale));
  s.setProperty('--text-scale', String(Number((clampedScale / 1.25).toFixed(4))));
  s.setProperty('--font-family', "'GoogleSans', -apple-system, BlinkMacSystemFont, sans-serif");

  syncTelegramChromeColors(tokens.actualBg);
}

export interface ThemeContextValue extends PersistedThemeSettings {
  isDarkTheme: boolean;
  tokens: ThemeTokens;
  recommendedPalettes: ColorPalette[];
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  setCustomPrimary: (hex: string | null) => void;
  setCustomBackground: (hex: string | null) => void;
  applyPalette: (primary: string, background: string) => void;
  savePalette: (palette?: Omit<ColorPalette, 'id'>) => void;
  removePalette: (id: string) => void;
  setBgMode: (mode: BgMode) => void;
  setBgBlur: (blur: number) => void;
  setBgDim: (dim: number) => void;
  setBgImageDataUrl: (url: string | null) => void;
  setTextSizeMultiplier: (scale: number) => void;
  setNavMode: (mode: NavMode) => void;
  setTransitionType: (type: TransitionType) => void;
  setTransitionsEnabled: (enabled: boolean) => void;
  setTransitionSpeed: (speed: number) => void;
  setVibrationEnabled: (enabled: boolean) => void;
  setVibrationStrength: (strength: number) => void;
  setIntroEnabled: (enabled: boolean) => void;
  setReminderTiming: (timing: ReminderTiming) => void;
  setReminderCustomHours: (hours: number) => void;
  resetCustomization: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<PersistedThemeSettings>(() => loadSyncSettings());
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const hasUserMutatedRef = useRef(false);

  const updateSettings = useCallback(
    (updater: PersistedThemeSettings | ((prev: PersistedThemeSettings) => PersistedThemeSettings)) => {
      hasUserMutatedRef.current = true;
      setSettings(updater);
    },
    [],
  );

  // Async reconciliation with Telegram CloudStorage
  useEffect(() => {
    let active = true;
    void getCloudItem(THEME_STORAGE_KEY).then((raw) => {
      if (!active) return;
      if (raw && !hasUserMutatedRef.current) {
        try {
          const parsed = sanitizeSettings(JSON.parse(raw) as Partial<PersistedThemeSettings>);
          setSettings(parsed);
        } catch {
          // ignore malformed stored JSON
        }
      }
      setCloudHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const tokens = useMemo(() => deriveThemeTokens(settings), [settings]);

  // Apply CSS variables & haptic config whenever theme state updates
  useEffect(() => {
    applyThemeToDom(settings.themeMode, tokens, settings.textSizeMultiplier);
    setHapticConfig(settings.vibrationEnabled, settings.vibrationStrength);
  }, [settings.themeMode, settings.textSizeMultiplier, settings.vibrationEnabled, settings.vibrationStrength, tokens]);

  // Persist user-driven changes to CloudStorage + localStorage (skip redundant write on initial cloud hydration)
  useEffect(() => {
    if (!hasUserMutatedRef.current) return;
    if (!cloudHydrated) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(settings));
        }
      } catch {
        // ignore
      }
      return;
    }
    const timer = window.setTimeout(() => {
      void setCloudItem(THEME_STORAGE_KEY, JSON.stringify(settings));
    }, 120);
    return () => window.clearTimeout(timer);
  }, [settings, cloudHydrated]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    updateSettings((prev) => ({
      ...prev,
      themeMode: mode,
      customPrimary: null,
      customBackground: null,
    }));
  }, [updateSettings]);

  const toggleTheme = useCallback(() => {
    updateSettings((prev) => ({
      ...prev,
      themeMode: prev.themeMode === 'dark' ? 'light' : 'dark',
      customPrimary: null,
      customBackground: null,
    }));
  }, [updateSettings]);

  const setCustomPrimary = useCallback((hex: string | null) => {
    updateSettings((prev) => ({ ...prev, customPrimary: hex }));
  }, [updateSettings]);

  const setCustomBackground = useCallback((hex: string | null) => {
    updateSettings((prev) => ({
      ...prev,
      customBackground: hex,
      themeMode: hex ? (computeRelativeLuminance(hex) < 0.5 ? 'dark' : 'light') : prev.themeMode,
    }));
  }, [updateSettings]);

  const applyPalette = useCallback((primary: string, background: string) => {
    updateSettings((prev) => ({
      ...prev,
      customPrimary: primary,
      customBackground: background,
      themeMode: computeRelativeLuminance(background) < 0.5 ? 'dark' : 'light',
    }));
  }, [updateSettings]);

  const savePalette = useCallback((palette?: Omit<ColorPalette, 'id'>) => {
    updateSettings((prev) => {
      const primary = palette?.primary ?? prev.customPrimary ?? (prev.themeMode === 'dark' ? '#2997FF' : '#0066CC');
      const background =
        palette?.background ?? prev.customBackground ?? (prev.themeMode === 'dark' ? '#272729' : '#F5F5F7');
      const id = `${primary}-${background}-${Date.now()}`;
      const nextPalette: ColorPalette = {
        id,
        name: palette?.name ?? `${primary}`,
        primary,
        background,
      };
      return {
        ...prev,
        savedPalettes: [nextPalette, ...prev.savedPalettes.filter((p) => p.primary !== primary || p.background !== background)],
      };
    });
  }, [updateSettings]);

  const removePalette = useCallback((id: string) => {
    updateSettings((prev) => ({
      ...prev,
      savedPalettes: prev.savedPalettes.filter((p) => p.id !== id),
    }));
  }, [updateSettings]);

  const setBgMode = useCallback((bgMode: BgMode) => {
    updateSettings((prev) => ({ ...prev, bgMode }));
  }, [updateSettings]);

  const setBgBlur = useCallback((bgBlur: number) => {
    updateSettings((prev) => ({ ...prev, bgBlur: clampNumber(bgBlur, 0, 1) }));
  }, [updateSettings]);

  const setBgDim = useCallback((bgDim: number) => {
    updateSettings((prev) => ({ ...prev, bgDim: clampNumber(bgDim, 0, 1) }));
  }, [updateSettings]);

  const setBgImageDataUrl = useCallback((bgImageDataUrl: string | null) => {
    updateSettings((prev) => ({ ...prev, bgImageDataUrl }));
  }, [updateSettings]);

  const setTextSizeMultiplier = useCallback((scale: number) => {
    updateSettings((prev) => ({ ...prev, textSizeMultiplier: clampNumber(scale, 0.8, 1.4) }));
  }, [updateSettings]);

  const setNavMode = useCallback((navMode: NavMode) => {
    updateSettings((prev) => ({ ...prev, navMode }));
  }, [updateSettings]);

  const setTransitionType = useCallback((transitionType: TransitionType) => {
    updateSettings((prev) => ({ ...prev, transitionType }));
  }, [updateSettings]);

  const setTransitionsEnabled = useCallback((transitionsEnabled: boolean) => {
    updateSettings((prev) => ({ ...prev, transitionsEnabled }));
  }, [updateSettings]);

  const setTransitionSpeed = useCallback((speed: number) => {
    updateSettings((prev) => ({ ...prev, transitionSpeed: clampNumber(speed, 0.5, 2.5) }));
  }, [updateSettings]);

  const setVibrationEnabled = useCallback((vibrationEnabled: boolean) => {
    updateSettings((prev) => ({ ...prev, vibrationEnabled }));
  }, [updateSettings]);

  const setVibrationStrength = useCallback((strength: number) => {
    updateSettings((prev) => ({ ...prev, vibrationStrength: clampNumber(strength, 0.1, 1.0) }));
  }, [updateSettings]);

  const setIntroEnabled = useCallback((introEnabled: boolean) => {
    updateSettings((prev) => ({ ...prev, introEnabled }));
  }, [updateSettings]);

  const setReminderTiming = useCallback((reminderTiming: ReminderTiming) => {
    updateSettings((prev) => ({ ...prev, reminderTiming }));
  }, [updateSettings]);

  const setReminderCustomHours = useCallback((hours: number) => {
    updateSettings((prev) => ({ ...prev, reminderCustomHours: clampNumber(hours, 1, 24) }));
  }, [updateSettings]);

  const resetCustomization = useCallback(() => {
    updateSettings(DEFAULT_SETTINGS);
  }, [updateSettings]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...settings,
      isDarkTheme: settings.themeMode === 'dark',
      tokens,
      recommendedPalettes: RECOMMENDED_PALETTES,
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
    }),
    [
      settings,
      tokens,
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
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
