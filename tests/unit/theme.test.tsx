import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Calendar, CheckCircle2, Pencil, User } from 'lucide-react';
import {
  RECOMMENDED_PALETTES,
  ThemeProvider,
  useTheme,
} from '../../src/context/ThemeContext';
import {
  AppleRadialMenu,
  AppleSegmentedControl,
  AppleVerticalDateRail,
  calculateAdaptiveAngles,
} from '../../src/components/ui';
import { _resetTelegramAdaptersForTest } from '../../src/services/telegram';
import type { TelegramCloudStorage } from '../../src/types';

const ThemeHarness: React.FC = () => {
  const ctx = useTheme();
  return (
    <div>
      <span data-testid="mode">{ctx.themeMode}</span>
      <span data-testid="bg">{ctx.tokens.bg}</span>
      <span data-testid="actual-bg">{ctx.tokens.actualBg}</span>
      <span data-testid="card">{ctx.tokens.card}</span>
      <span data-testid="accent">{ctx.tokens.accent}</span>
      <span data-testid="accent-fg">{ctx.tokens.accentFg}</span>
      <span data-testid="reminder-timing">{ctx.reminderTiming}</span>
      <span data-testid="scale">{ctx.textSizeMultiplier}</span>
      <span data-testid="custom-primary">{ctx.customPrimary ?? 'none'}</span>
      <span data-testid="custom-bg">{ctx.customBackground ?? 'none'}</span>
      <span data-testid="saved-count">{ctx.savedPalettes.length}</span>

      <button type="button" onClick={() => ctx.setThemeMode('light')}>
        to-light
      </button>
      <button type="button" onClick={() => ctx.toggleTheme()}>
        toggle
      </button>
      <button type="button" onClick={() => ctx.setCustomBackground('#FFEBEB')}>
        set-light-bg
      </button>
      <button
        type="button"
        onClick={() => ctx.applyPalette('#FFB300', '#333333')}
      >
        apply-dark-palette
      </button>
      <button
        type="button"
        onClick={() => ctx.applyPalette('#43A047', '#E8F5E9')}
      >
        apply-light-palette
      </button>
      <button
        type="button"
        onClick={() => ctx.applyPalette('#E0E0E0', '#000000')}
      >
        apply-monochrome-palette
      </button>
      <button
        type="button"
        onClick={() => ctx.applyPalette('#00E5FF', '#111111')}
      >
        apply-cyan-palette
      </button>
      <button
        type="button"
        onClick={() => ctx.savePalette({ name: 'Custom', primary: '#1E88E5', background: '#E3F2FD' })}
      >
        save-palette
      </button>
      <button
        type="button"
        onClick={() => {
          const first = ctx.savedPalettes[0];
          if (first) ctx.removePalette(first.id);
        }}
      >
        remove-palette
      </button>
      <button type="button" onClick={() => ctx.setBgMode('Gradient')}>
        to-gradient
      </button>
      <button type="button" onClick={() => ctx.setTextSizeMultiplier(2.0)}>
        scale-high
      </button>
      <button type="button" onClick={() => ctx.setTextSizeMultiplier(0.3)}>
        scale-low
      </button>
    </div>
  );
};

describe('ThemeContext (Dark & Light parity, no Techno)', () => {
  beforeEach(() => {
    _resetTelegramAdaptersForTest();
    localStorage.clear();
    delete window.Telegram;
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.cssText = '';
  });

  it('defaults to Dark theme tokens and applies CSS variables to documentElement', async () => {
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    expect(screen.getByTestId('bg')).toHaveTextContent('#272729');
    expect(screen.getByTestId('card')).toHaveTextContent('#2A2A2C');
    expect(screen.getByTestId('accent')).toHaveTextContent('#2997FF');
    expect(screen.getByTestId('scale')).toHaveTextContent('1.25');

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#272729');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#2997FF');
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.25');
    expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('1');
  });

  it('switches cleanly between Dark and Light tokens', async () => {
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      screen.getByText('to-light').click();
    });

    expect(screen.getByTestId('mode')).toHaveTextContent('light');
    expect(screen.getByTestId('bg')).toHaveTextContent('#F5F5F7');
    expect(screen.getByTestId('card')).toHaveTextContent('#FFFFFF');
    expect(screen.getByTestId('accent')).toHaveTextContent('#0066CC');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--text')).toBe('#1D1D1F');
  });

  it('contains strictly the 6 Minimalist recommended palettes without any Techno colors', async () => {
    expect(RECOMMENDED_PALETTES).toHaveLength(6);
    expect(RECOMMENDED_PALETTES.some((p) => p.primary === '#43A047' && p.background === '#E8F5E9')).toBe(true);
    expect(RECOMMENDED_PALETTES.some((p) => p.primary.toUpperCase() === '#00FF41')).toBe(false);

    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      screen.getByText('apply-light-palette').click();
    });
    expect(screen.getByTestId('mode')).toHaveTextContent('light');
    expect(screen.getByTestId('accent')).toHaveTextContent('#43A047');
    expect(screen.getByTestId('bg')).toHaveTextContent('#E8F5E9');

    act(() => {
      screen.getByText('apply-dark-palette').click();
    });
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    expect(screen.getByTestId('accent')).toHaveTextContent('#FFB300');
    expect(screen.getByTestId('bg')).toHaveTextContent('#333333');
  });

  it('auto-detects luminance on custom background and resets overrides on toggleTheme', async () => {
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      screen.getByText('set-light-bg').click();
    });
    expect(screen.getByTestId('mode')).toHaveTextContent('light');
    expect(screen.getByTestId('custom-bg')).toHaveTextContent('#FFEBEB');

    act(() => {
      screen.getByText('toggle').click();
    });
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    expect(screen.getByTestId('custom-primary')).toHaveTextContent('none');
    expect(screen.getByTestId('custom-bg')).toHaveTextContent('none');
  });

  it('supports saving/removing custom palettes, Gradient transparent --bg, and clamping textSizeMultiplier', async () => {
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      screen.getByText('save-palette').click();
    });
    expect(screen.getByTestId('saved-count')).toHaveTextContent('1');

    act(() => {
      screen.getByText('remove-palette').click();
    });
    expect(screen.getByTestId('saved-count')).toHaveTextContent('0');

    act(() => {
      screen.getByText('to-gradient').click();
    });
    expect(screen.getByTestId('bg')).toHaveTextContent('transparent');
    expect(screen.getByTestId('actual-bg')).toHaveTextContent('#272729');
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('transparent');

    act(() => {
      screen.getByText('scale-high').click();
    });
    expect(screen.getByTestId('scale')).toHaveTextContent('1.4');
    expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('1.12');

    act(() => {
      screen.getByText('scale-low').click();
    });
    expect(screen.getByTestId('scale')).toHaveTextContent('0.8');
    expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('0.64');
  });

  it('computes contrast-aware --accent-fg (#1D1D1F on #E0E0E0/#00E5FF and #FFFFFF on #0066CC)', async () => {
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    // Dark default (#2997FF) -> #FFFFFF
    expect(screen.getByTestId('accent-fg')).toHaveTextContent('#FFFFFF');
    expect(document.documentElement.style.getPropertyValue('--accent-fg')).toBe('#FFFFFF');

    // Light default (#0066CC) -> #FFFFFF
    act(() => {
      screen.getByText('to-light').click();
    });
    expect(screen.getByTestId('accent')).toHaveTextContent('#0066CC');
    expect(screen.getByTestId('accent-fg')).toHaveTextContent('#FFFFFF');
    expect(document.documentElement.style.getPropertyValue('--accent-fg')).toBe('#FFFFFF');

    // Monochrome (#E0E0E0) -> #1D1D1F
    act(() => {
      screen.getByText('apply-monochrome-palette').click();
    });
    expect(screen.getByTestId('accent')).toHaveTextContent('#E0E0E0');
    expect(screen.getByTestId('accent-fg')).toHaveTextContent('#1D1D1F');
    expect(document.documentElement.style.getPropertyValue('--accent-fg')).toBe('#1D1D1F');

    // Cyan (#00E5FF) -> #1D1D1F
    act(() => {
      screen.getByText('apply-cyan-palette').click();
    });
    expect(screen.getByTestId('accent')).toHaveTextContent('#00E5FF');
    expect(screen.getByTestId('accent-fg')).toHaveTextContent('#1D1D1F');
    expect(document.documentElement.style.getPropertyValue('--accent-fg')).toBe('#1D1D1F');
  });

  it('sanitizes invalid reminderTiming and avoids redundant CloudStorage writes on hydration', async () => {
    localStorage.setItem(
      'app_theme_settings_v1',
      JSON.stringify({ themeMode: 'techno', reminderTiming: 'bogus_timing' }),
    );

    const setItemSpy = vi.fn((_k: string, _v: string, cb?: (err: string | null, ok?: boolean) => void) =>
      cb?.(null, true),
    );
    const cloud: TelegramCloudStorage = {
      setItem: setItemSpy,
      getItem: (_k, cb) => cb(null, undefined),
      getItems: (_ks, cb) => cb(null, {}),
      removeItem: (_k, cb) => cb?.(null, true),
      removeItems: (_ks, cb) => cb?.(null, true),
      getKeys: (cb) => cb(null, []),
    };
    window.Telegram = {
      WebApp: {
        initData: '',
        initDataUnsafe: {},
        version: '8.0',
        platform: 'ios',
        colorScheme: 'dark',
        themeParams: {},
        isExpanded: true,
        viewportHeight: 844,
        viewportStableHeight: 844,
        BackButton: { isVisible: false, onClick: vi.fn(), offClick: vi.fn(), show: vi.fn(), hide: vi.fn() },
        MainButton: {
          text: '',
          color: '#2997FF',
          textColor: '#FFFFFF',
          isVisible: false,
          isActive: true,
          setText: vi.fn(),
          onClick: vi.fn(),
          offClick: vi.fn(),
          show: vi.fn(),
          hide: vi.fn(),
          enable: vi.fn(),
          disable: vi.fn(),
          setParams: vi.fn(),
        },
        HapticFeedback: { impactOccurred: vi.fn(), notificationOccurred: vi.fn(), selectionChanged: vi.fn() },
        CloudStorage: cloud,
        ready: vi.fn(),
        expand: vi.fn(),
        close: vi.fn(),
      },
    };

    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 180));
    });

    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    expect(screen.getByTestId('reminder-timing')).toHaveTextContent('15_min_before');
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('uses high-contrast #1D1D1F text on bright custom accents in Light theme for AppleSegmentedControl & AppleRadialMenu', () => {
    const { rerender } = render(
      <AppleSegmentedControl
        items={['Все', '1 подгр.', '2 подгр.']}
        selectedIndex={0}
        onSelectIndex={() => undefined}
        isDarkTheme={false}
        accentColor="#E0E0E0"
      />,
    );
    const selectedTab = screen.getByRole('tab', { name: 'Все' });
    expect(selectedTab.style.color).toBe('rgb(29, 29, 31)');

    rerender(
      <AppleSegmentedControl
        items={['Все', '1 подгр.', '2 подгр.']}
        selectedIndex={0}
        onSelectIndex={() => undefined}
        isDarkTheme={false}
        accentColor="#0066CC"
      />,
    );
    expect(screen.getByRole('tab', { name: 'Все' }).style.color).toBe('rgb(0, 102, 204)');

    render(
      <AppleRadialMenu
        isOpen
        onDismiss={() => undefined}
        items={[
          { title: 'Расписание', icon: Calendar, index: 0 },
          { title: 'Оценки', icon: CheckCircle2, index: 1 },
          { title: 'Заметки', icon: Pencil, index: 2 },
          { title: 'Профиль', icon: User, index: 3 },
        ]}
        selectedIndex={0}
        onSelectIndex={() => undefined}
        isDarkTheme={false}
        accentColor="#E0E0E0"
        touchPosition={{ x: 249, y: 25 }}
      />,
    );
    const labelEl = screen.getByText('Расписание');
    expect(labelEl.style.color).toBe('rgb(29, 29, 31)');
  });

  it('keeps AppleRadialMenu cx inside edge-band thresholds and stops AppleVerticalDateRail swipe propagation', () => {
    const leftEdge = calculateAdaptiveAngles({ x: 141, y: 25 }, 4, 390, 844);
    const rightEdge = calculateAdaptiveAngles({ x: 249, y: 25 }, 4, 390, 844);
    expect(leftEdge.cx).toBeGreaterThanOrEqual(175);
    expect(rightEdge.cx).toBeLessThanOrEqual(215);

    const onParentPointerDown = vi.fn();
    const onParentPointerUp = vi.fn();
    const onVisibilityChange = vi.fn();
    render(
      <div onPointerDown={onParentPointerDown} onPointerUp={onParentPointerUp}>
        <AppleVerticalDateRail
          days={[1, 2, 3]}
          weekDays={['Пн', 'Вт', 'Ср']}
          selectedDayIndex={0}
          onDaySelected={() => undefined}
          isVisible
          onVisibilityChange={onVisibilityChange}
        />
      </div>,
    );
    const railBtn = screen.getByRole('button', { name: 'ПН 1' });
    fireEvent.pointerDown(railBtn, { clientX: 360, clientY: 200 });
    fireEvent.pointerMove(railBtn, { clientX: 430, clientY: 200 });
    fireEvent.pointerUp(railBtn, { clientX: 430, clientY: 200 });

    expect(onVisibilityChange).toHaveBeenCalledWith(false);
    expect(onParentPointerDown).not.toHaveBeenCalled();
    expect(onParentPointerUp).not.toHaveBeenCalled();
  });
});
