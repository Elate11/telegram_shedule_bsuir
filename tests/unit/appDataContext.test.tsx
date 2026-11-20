import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppDataProvider, useAppData } from '../../src/context/AppDataContext';
import { resetMockStore } from '../../src/services/mockData';
import {
  CACHE_KEY_IIS_MARKBOOK,
  CACHE_KEY_PROFILE,
  CLOUD_KEY_AUTH_SESSION,
  CLOUD_KEY_NOTES,
  CLOUD_KEY_SCHEDULE_PREFS,
  loadSchedulePrefs,
  setCachedMarkbook,
} from '../../src/services/storage';
import * as apiClient from '../../src/services/apiClient';
import { _resetTelegramAdaptersForTest } from '../../src/services/telegram';
import type { TelegramCloudStorage, TelegramWebApp } from '../../src/types';

function TestConsumer({
  onReady,
}: {
  onReady: (ctx: ReturnType<typeof useAppData>) => void;
}) {
  const ctx = useAppData();
  onReady(ctx);
  return (
    <div>
      <span data-testid="auth-mode">{ctx.authMode}</span>
      <span data-testid="group">{ctx.selectedGroup}</span>
      <span data-testid="subgroup">{ctx.subgroup}</span>
      <span data-testid="day">{ctx.selectedDayIndex}</span>
      <span data-testid="source">{ctx.dataSource}</span>
      <span data-testid="notes-count">{ctx.notes.length}</span>
      <span data-testid="lessons-count">{ctx.lessons.length}</span>
    </div>
  );
}

describe('AppDataContext', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetMockStore();
    _resetTelegramAdaptersForTest();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Offline in unit test')),
    );
  });

  afterEach(() => {
    delete window.Telegram;
    vi.restoreAllMocks();
  });

  it('throws when useAppData is called outside AppDataProvider', () => {
    function Broken() {
      useAppData();
      return null;
    }
    expect(() => render(<Broken />)).toThrow(
      'useAppData must be used within an AppDataProvider',
    );
  });

  it('handles logged_out -> guest -> authenticated -> logout and preserves notes/history', async () => {
    let latest!: ReturnType<typeof useAppData>;

    render(
      <AppDataProvider>
        <TestConsumer
          onReady={(ctx) => {
            latest = ctx;
          }}
        />
      </AppDataProvider>,
    );

    expect(screen.getByTestId('auth-mode').textContent).toBe('logged_out');
    expect(screen.getByTestId('group').textContent).toBe('310101');
    await waitFor(() => {
      expect(Number(screen.getByTestId('lessons-count').textContent)).toBeGreaterThan(0);
    });
    expect(screen.getByTestId('source').textContent).toBe('mock');

    // Add a note and change subgroup/group
    await act(async () => {
      await latest.addNote({
        id: 'persist-note',
        subject: 'РПМ',
        text: 'Сделать ЛР',
        date: '15.09.2025',
        time: null,
        isEvent: false,
        isPinned: false,
        lessonType: 'ЛР',
        attachments: [],
      });
      await latest.selectGroup('351001');
      await latest.setSubgroup(1);
    });

    expect(screen.getByTestId('group').textContent).toBe('351001');
    expect(screen.getByTestId('subgroup').textContent).toBe('1');
    expect(screen.getByTestId('notes-count').textContent).toBe('1');

    // Seed private IIS cache to verify guest login wipes it
    setCachedMarkbook({ averageMark: 8.5, markPages: {} });
    await act(async () => {
      await latest.loginAsGuest();
    });
    expect(screen.getByTestId('auth-mode').textContent).toBe('guest');
    expect(latest.profile.fio).toBe('Гость');
    expect(localStorage.getItem(CACHE_KEY_IIS_MARKBOOK)).toBeNull();

    // Authenticated login (falls back seamlessly to mock when network fails)
    await act(async () => {
      const res = await latest.login('31010103', 'secret');
      expect(res.ok).toBe(true);
    });
    expect(screen.getByTestId('auth-mode').textContent).toBe('authenticated');
    expect(latest.isAuthenticated).toBe(true);
    expect(latest.profile.fio).toBe('Соколов Артём Дмитриевич');

    // Logout clears auth and private IIS caches while preserving notes & search history
    await act(async () => {
      await latest.logout();
    });
    expect(screen.getByTestId('auth-mode').textContent).toBe('logged_out');
    expect(latest.notes).toHaveLength(1);
    expect(latest.searchHistory.some((h) => h.id === '351001')).toBe(true);
  });

  it('updates day index, date rail, inline employee view, and offline/baseUrl settings reactively', async () => {
    let latest!: ReturnType<typeof useAppData>;

    render(
      <AppDataProvider>
        <TestConsumer
          onReady={(ctx) => {
            latest = ctx;
          }}
        />
      </AppDataProvider>,
    );

    await act(async () => {
      latest.setSelectedDayIndex(10);
      await latest.setDateRailVisible(false);
      await latest.setForceOfflineMode(true);
      await latest.setApiBaseUrl('https://custom.bsuir.by/api/v1');
      await latest.selectEmployee({ urlId: 'a-smirnov', fullName: 'Смирнов А.В.' });
    });

    expect(screen.getByTestId('day').textContent).toBe('10');
    expect(latest.dateRailVisible).toBe(false);
    expect(latest.isOfflineMode).toBe(true);
    expect(latest.apiBaseUrl).toBe('https://custom.bsuir.by/api/v1');
    expect(latest.effectiveTarget).toBe('a-smirnov');

    await act(async () => {
      latest.resetToToday();
    });
    expect(screen.getByTestId('day').textContent).toBe('7');
  });

  it('prevents async CloudStorage hydration from overwriting user edits made during startup', async () => {
    let resolveNotesGet: ((err: string | null, val?: string) => void) | null = null;
    let resolvePrefsGet: ((err: string | null, val?: string) => void) | null = null;
    const cloudBacking = new Map<string, string>();

    const CloudStorage: TelegramCloudStorage = {
      setItem: vi.fn((k, v, cb) => {
        cloudBacking.set(k, v);
        cb?.(null, true);
      }),
      getItem: vi.fn((key, cb) => {
        if (key === CLOUD_KEY_NOTES && !resolveNotesGet) {
          resolveNotesGet = cb;
          return;
        }
        if (key === CLOUD_KEY_SCHEDULE_PREFS && !resolvePrefsGet) {
          resolvePrefsGet = cb;
          return;
        }
        cb(null, cloudBacking.get(key));
      }),
      getItems: vi.fn((_keys, cb) => cb(null, {})),
      removeItem: vi.fn((k, cb) => {
        cloudBacking.delete(k);
        cb?.(null, true);
      }),
      removeItems: vi.fn((keys, cb) => {
        for (const k of keys) cloudBacking.delete(k);
        cb?.(null, true);
      }),
      getKeys: vi.fn((cb) => cb(null, Array.from(cloudBacking.keys()))),
    };

    window.Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A1%7D',
        initDataUnsafe: { user: { id: 1, first_name: 'Test' } },
        version: '7.0',
        platform: 'tdesktop',
        colorScheme: 'dark',
        themeParams: {},
        isExpanded: true,
        viewportHeight: 800,
        viewportStableHeight: 800,
        BackButton: {
          isVisible: false,
          onClick: vi.fn(),
          offClick: vi.fn(),
          show: vi.fn(),
          hide: vi.fn(),
        },
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
        HapticFeedback: {
          impactOccurred: vi.fn(),
          notificationOccurred: vi.fn(),
          selectionChanged: vi.fn(),
        },
        CloudStorage,
        ready: vi.fn(),
        expand: vi.fn(),
        close: vi.fn(),
      } as unknown as TelegramWebApp,
    };

    let latest!: ReturnType<typeof useAppData>;
    render(
      <AppDataProvider>
        <TestConsumer
          onReady={(ctx) => {
            latest = ctx;
          }}
        />
      </AppDataProvider>,
    );

    // User mutates BEFORE slow CloudStorage resolves
    await act(async () => {
      await latest.addNote({
        id: 'user-new-note',
        subject: 'БД',
        text: 'Новая заметка пользователя',
        date: '18.09.2025',
        time: null,
        isEvent: false,
        isPinned: false,
        lessonType: 'ПЗ',
        attachments: [],
      });
      await latest.setSubgroup(2);
    });

    // Now stale CloudStorage responds with old values
    await act(async () => {
      resolveNotesGet?.(
        null,
        JSON.stringify([
          {
            id: 'stale-note',
            subject: 'Old',
            text: 'Stale',
            date: '01.09.2025',
            time: null,
            isEvent: false,
            isPinned: false,
            lessonType: '',
            attachments: [],
          },
        ]),
      );
      resolvePrefsGet?.(
        null,
        JSON.stringify({
          selectedGroup: '251001',
          selectedEmployee: null,
          subgroup: 1,
          dateRailVisible: true,
        }),
      );
      await Promise.resolve();
    });

    // User's edits win over stale hydration
    expect(latest.notes.map((n) => n.id)).toEqual(['user-new-note']);
    expect(latest.subgroup).toBe(2);
  });

  it('BUG-3 regression: concurrent selectGroup and setSubgroup persist both in async CloudStorage', async () => {
    const cloudBacking = new Map<string, string>();
    cloudBacking.set(
      CLOUD_KEY_SCHEDULE_PREFS,
      JSON.stringify({
        selectedGroup: '251001',
        selectedEmployee: null,
        subgroup: 1,
        dateRailVisible: true,
      }),
    );

    const CloudStorage: TelegramCloudStorage = {
      setItem: vi.fn((k, v, cb) => {
        setTimeout(() => {
          cloudBacking.set(k, v);
          cb?.(null, true);
        }, 15);
      }),
      getItem: vi.fn((key, cb) => {
        setTimeout(() => cb(null, cloudBacking.get(key)), 15);
      }),
      getItems: vi.fn((_keys, cb) => cb(null, {})),
      removeItem: vi.fn((k, cb) => {
        cloudBacking.delete(k);
        cb?.(null, true);
      }),
      removeItems: vi.fn((keys, cb) => {
        for (const k of keys) cloudBacking.delete(k);
        cb?.(null, true);
      }),
      getKeys: vi.fn((cb) => cb(null, Array.from(cloudBacking.keys()))),
    };

    window.Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A1%7D',
        initDataUnsafe: { user: { id: 1, first_name: 'Test' } },
        version: '7.0',
        platform: 'tdesktop',
        colorScheme: 'dark',
        themeParams: {},
        isExpanded: true,
        viewportHeight: 800,
        viewportStableHeight: 800,
        BackButton: {
          isVisible: false,
          onClick: vi.fn(),
          offClick: vi.fn(),
          show: vi.fn(),
          hide: vi.fn(),
        },
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
        HapticFeedback: {
          impactOccurred: vi.fn(),
          notificationOccurred: vi.fn(),
          selectionChanged: vi.fn(),
        },
        CloudStorage,
        ready: vi.fn(),
        expand: vi.fn(),
        close: vi.fn(),
      } as unknown as TelegramWebApp,
    };

    let latest!: ReturnType<typeof useAppData>;
    render(
      <AppDataProvider>
        <TestConsumer
          onReady={(ctx) => {
            latest = ctx;
          }}
        />
      </AppDataProvider>,
    );

    await act(async () => {
      await Promise.all([latest.selectGroup('351001', false), latest.setSubgroup(2)]);
    });

    const persisted = await loadSchedulePrefs();
    expect(persisted.selectedGroup).toBe('351001');
    expect(persisted.subgroup).toBe(2);
    expect(latest.selectedGroup).toBe('351001');
    expect(latest.subgroup).toBe(2);
  });

  it('prevents login() background enrichment from overwriting profile after immediate logout()', async () => {
    let resolveEnrichGroup!: () => void;
    const enrichGate = new Promise<void>((resolve) => {
      resolveEnrichGroup = resolve;
    });

    vi.spyOn(apiClient, 'login').mockResolvedValue({
      ok: true,
      source: 'live',
      session: {
        authenticated: true,
        isGuest: false,
        username: '31010103',
        fio: 'Иванов Иван',
        group: '310101',
        desc: 'ФКСиС · 3 курс',
        photoUrl: '',
        isHeadman: false,
      },
    });
    vi.spyOn(apiClient, 'fetchGroupInfo').mockImplementation(async () => {
      await enrichGate;
      return {
        data: { curator: null, students: [], isHeadman: true },
        source: 'live',
      };
    });
    vi.spyOn(apiClient, 'fetchUnreadNotificationsCount').mockResolvedValue({
      data: 7,
      source: 'live',
    });
    vi.spyOn(apiClient, 'fetchOmissions').mockResolvedValue({
      data: {
        totalHours: 10,
        unexcusedHours: 4,
        lessons: [],
        excuseDocuments: [],
        monthlyHours: {},
        monthlyUnexcusedHours: {},
      },
      source: 'live',
    });

    let latest!: ReturnType<typeof useAppData>;
    render(
      <AppDataProvider>
        <TestConsumer
          onReady={(ctx) => {
            latest = ctx;
          }}
        />
      </AppDataProvider>,
    );

    await act(async () => {
      const loginRes = await latest.login('31010103', 'secret');
      expect(loginRes.ok).toBe(true);
      // Immediately logout while background enrichment is still in flight
      await latest.logout();
    });

    // Now let background enrichment settle
    await act(async () => {
      resolveEnrichGroup();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest.authMode).toBe('logged_out');
    expect(latest.profile.fio).toBe('');
    expect(latest.profile.unreadNotifCount).toBe(0);
    expect(localStorage.getItem(CACHE_KEY_PROFILE)).toBeNull();
  });

  it('populates guestProfile when CloudStorage hydrates guest authSession and resets loading on loader error', async () => {
    const cloudBacking = new Map<string, string>();
    cloudBacking.set(
      CLOUD_KEY_AUTH_SESSION,
      JSON.stringify({ authMode: 'guest', username: null, loginGroup: null }),
    );
    cloudBacking.set(
      CLOUD_KEY_SCHEDULE_PREFS,
      JSON.stringify({
        selectedGroup: '351001',
        selectedEmployee: null,
        subgroup: 0,
        dateRailVisible: true,
      }),
    );

    const CloudStorage: TelegramCloudStorage = {
      setItem: vi.fn((k, v, cb) => {
        cloudBacking.set(k, v);
        cb?.(null, true);
      }),
      getItem: vi.fn((key, cb) => cb(null, cloudBacking.get(key))),
      getItems: vi.fn((_keys, cb) => cb(null, {})),
      removeItem: vi.fn((k, cb) => {
        cloudBacking.delete(k);
        cb?.(null, true);
      }),
      removeItems: vi.fn((keys, cb) => {
        for (const k of keys) cloudBacking.delete(k);
        cb?.(null, true);
      }),
      getKeys: vi.fn((cb) => cb(null, Array.from(cloudBacking.keys()))),
    };

    window.Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A1%7D',
        initDataUnsafe: { user: { id: 1, first_name: 'Test' } },
        version: '7.0',
        platform: 'tdesktop',
        colorScheme: 'dark',
        themeParams: {},
        isExpanded: true,
        viewportHeight: 800,
        viewportStableHeight: 800,
        BackButton: {
          isVisible: false,
          onClick: vi.fn(),
          offClick: vi.fn(),
          show: vi.fn(),
          hide: vi.fn(),
        },
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
        HapticFeedback: {
          impactOccurred: vi.fn(),
          notificationOccurred: vi.fn(),
          selectionChanged: vi.fn(),
        },
        CloudStorage,
        ready: vi.fn(),
        expand: vi.fn(),
        close: vi.fn(),
      } as unknown as TelegramWebApp,
    };

    let latest!: ReturnType<typeof useAppData>;
    render(
      <AppDataProvider>
        <TestConsumer
          onReady={(ctx) => {
            latest = ctx;
          }}
        />
      </AppDataProvider>,
    );

    await waitFor(() => {
      expect(latest.authMode).toBe('guest');
      expect(latest.profile.fio).toBe('Гость');
      expect(latest.profile.group).toBe('351001');
    });

    vi.spyOn(apiClient, 'fetchMarkbook').mockRejectedValueOnce(new Error('Boom'));
    await act(async () => {
      await expect(latest.loadMarkbook(true)).rejects.toThrow('Boom');
    });
    expect(latest.markbook.loading).toBe(false);
  });
});
