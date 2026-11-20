import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CACHE_KEY_IIS_MARKBOOK,
  CACHE_KEY_PROFILE,
  CLOUD_KEY_AUTH_SESSION,
  CLOUD_KEY_NOTES,
  CLOUD_KEY_SCHEDULE_PREFS,
  CLOUD_KEY_SEARCH_HISTORY,
  NOTE_ATTACHMENT_LOCAL_PREFIX,
  addNote,
  addSearchHistory,
  clearSearchHistory,
  deleteNote,
  loadAuthSession,
  loadNotes,
  loadSchedulePrefs,
  loadSearchHistory,
  logoutAndClearAuth,
  removeSearchHistoryItem,
  saveDateRailVisible,
  saveSchedulePrefs,
  saveSelectedGroup,
  saveSubgroup,
  setCachedMarkbook,
  setCachedProfile,
  setCustomAvatar,
  togglePinNote,
  updateNote,
} from '../../src/services/storage';
import { _resetTelegramAdaptersForTest } from '../../src/services/telegram';
import type { TelegramCloudStorage, TelegramWebApp } from '../../src/types';

function installMockTelegramCloud(): Map<string, string> {
  const store = new Map<string, string>();
  const CloudStorage: TelegramCloudStorage = {
    setItem: vi.fn((key, value, cb) => {
      store.set(key, value);
      cb?.(null, true);
    }),
    getItem: vi.fn((key, cb) => {
      cb(null, store.get(key));
    }),
    getItems: vi.fn((keys, cb) => {
      const out: Record<string, string> = {};
      for (const k of keys) {
        const v = store.get(k);
        if (v !== undefined) out[k] = v;
      }
      cb(null, out);
    }),
    removeItem: vi.fn((key, cb) => {
      store.delete(key);
      cb?.(null, true);
    }),
    removeItems: vi.fn((keys, cb) => {
      for (const k of keys) store.delete(k);
      cb?.(null, true);
    }),
    getKeys: vi.fn((cb) => {
      cb(null, Array.from(store.keys()));
    }),
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

  return store;
}

describe('storage service (F7)', () => {
  let cloudStore: Map<string, string>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    _resetTelegramAdaptersForTest();
    cloudStore = installMockTelegramCloud();
  });

  afterEach(() => {
    delete window.Telegram;
  });

  it('performs Notes CRUD and round-trips >3800B Cyrillic notes via chunked CloudStorage', async () => {
    const bigCyrillicText = 'Подготовка к лабораторной работе по БГУИР. '.repeat(140);
    expect(new TextEncoder().encode(bigCyrillicText).length).toBeGreaterThan(3800);

    const afterAdd = await addNote({
      id: 'n1',
      subject: 'РПМ',
      text: bigCyrillicText,
      date: '15.09.2025',
      time: '09:00',
      isEvent: true,
      isPinned: false,
      lessonType: 'ЛР',
      attachments: [],
    });

    expect(afterAdd).toHaveLength(1);
    expect(cloudStore.has(`${CLOUD_KEY_NOTES}__chunks`)).toBe(true);

    // Clear localStorage mirror to verify pure CloudStorage reconstruction
    localStorage.removeItem(CLOUD_KEY_NOTES);
    const hydrated = await loadNotes();
    expect(hydrated).toHaveLength(1);
    expect(hydrated[0].text).toBe(bigCyrillicText);

    const toggled = await togglePinNote('n1');
    expect(toggled[0].isPinned).toBe(true);

    const updated = await updateNote('n1', { text: 'Обновлённый текст' });
    expect(updated[0].text).toBe('Обновлённый текст');

    const afterDelete = await deleteNote('n1');
    expect(afterDelete).toHaveLength(0);
  });

  it('offloads oversized data: attachments to localStorage and cleans up on delete', async () => {
    const largeDataUrl = `data:image/png;base64,${'A'.repeat(17_000)}`;
    const notes = await addNote({
      id: 'att-note',
      subject: 'БД',
      text: 'Схема БД',
      date: '20.09.2025',
      time: null,
      isEvent: false,
      isPinned: false,
      lessonType: 'ЛР',
      attachments: [
        {
          id: 'img1',
          uri: largeDataUrl,
          name: 'schema.png',
          mimeType: 'image/png',
          sizeBytes: 17000,
        },
      ],
    });

    expect(notes[0].attachments[0].uri).toBe(largeDataUrl);
    const cloudRaw = cloudStore.get(CLOUD_KEY_NOTES) ?? '';
    expect(cloudRaw).toContain(`local://${NOTE_ATTACHMENT_LOCAL_PREFIX}img1`);
    expect(localStorage.getItem(`${NOTE_ATTACHMENT_LOCAL_PREFIX}img1`)).toBe(
      largeDataUrl,
    );

    const reloaded = await loadNotes();
    expect(reloaded[0].attachments[0].uri).toBe(largeDataUrl);

    await deleteNote('att-note');
    expect(localStorage.getItem(`${NOTE_ATTACHMENT_LOCAL_PREFIX}img1`)).toBeNull();
  });

  it('maintains max-5 MRU search history with deduplication for groups and employees', async () => {
    await addSearchHistory({ id: '310101', label: '310101', kind: 'group' });
    await addSearchHistory({ id: '510902', label: '510902', kind: 'group' });
    await addSearchHistory({ id: 'a-smirnov', label: 'Смирнов А.В.', kind: 'employee' });
    await addSearchHistory({ id: '251001', label: '251001', kind: 'group' });
    await addSearchHistory({ id: '153501', label: '153501', kind: 'group' });
    const sixth = await addSearchHistory({ id: '351001', label: '351001', kind: 'group' });

    expect(sixth).toHaveLength(5);
    expect(sixth[0].id).toBe('351001');
    // Oldest ('310101') evicted
    expect(sixth.find((x) => x.id === '310101')).toBeUndefined();

    // Re-adding existing item promotes it to index 0 without duplicates
    const promoted = await addSearchHistory({
      id: 'a-smirnov',
      label: 'Смирнов А.В.',
      kind: 'employee',
    });
    expect(promoted).toHaveLength(5);
    expect(promoted[0].id).toBe('a-smirnov');

    const afterRemove = await removeSearchHistoryItem('510902', 'group');
    expect(afterRemove).toHaveLength(4);

    const cleared = await clearSearchHistory();
    expect(cleared).toHaveLength(0);
    expect(await loadSearchHistory()).toEqual([]);
  });

  it('sanitizes group 114001/blank to 310101 and keeps CloudStorage vs localStorage split', async () => {
    const prefs = await saveSelectedGroup('114001');
    expect(prefs.selectedGroup).toBe('310101');

    const updated = await saveSchedulePrefs({
      selectedGroup: '   ',
      subgroup: 2,
      dateRailVisible: false,
    });
    expect(updated.selectedGroup).toBe('310101');
    expect(updated.subgroup).toBe(2);
    expect(updated.dateRailVisible).toBe(false);

    const loaded = await loadSchedulePrefs();
    expect(loaded).toEqual(updated);
    expect(cloudStore.has(CLOUD_KEY_SCHEDULE_PREFS)).toBe(true);
  });

  it('clears private IIS caches on logout while preserving theme, notes, history, and schedule prefs', async () => {
    localStorage.setItem('app_theme_settings_v1', JSON.stringify({ themeMode: 'light' }));
    await addNote({
      id: 'keep-me',
      subject: 'КС',
      text: 'Сохранить при выходе',
      date: '01.10.2025',
      time: null,
      isEvent: false,
      isPinned: true,
      lessonType: 'ЛК',
      attachments: [],
    });
    await addSearchHistory({ id: '351001', label: '351001', kind: 'group' });
    await saveSelectedGroup('351001');

    setCachedProfile({
      fio: 'Иванов И.И.',
      desc: 'ФКП',
      group: '351001',
      photo: '',
      birthDate: '',
      isHeadman: true,
      unreadNotifCount: 2,
      unexcusedHours: 4,
    });
    setCachedMarkbook({ averageMark: 8.5, markPages: {} });
    setCustomAvatar('data:image/png;base64,AAA');

    // Private caches must NOT go to CloudStorage
    expect(cloudStore.has(CACHE_KEY_PROFILE)).toBe(false);
    expect(cloudStore.has(CACHE_KEY_IIS_MARKBOOK)).toBe(false);

    await logoutAndClearAuth();

    expect(localStorage.getItem(CACHE_KEY_PROFILE)).toBeNull();
    expect(localStorage.getItem(CACHE_KEY_IIS_MARKBOOK)).toBeNull();
    expect(localStorage.getItem('bsuir_custom_avatar_v1')).toBeNull();

    // Preserved user artifacts
    expect(localStorage.getItem('app_theme_settings_v1')).toContain('light');
    expect((await loadNotes()).map((n) => n.id)).toEqual(['keep-me']);
    expect((await loadSearchHistory()).map((h) => h.id)).toEqual(['351001']);
    expect((await loadSchedulePrefs()).selectedGroup).toBe('351001');
    expect((await loadAuthSession()).authMode).toBe('logged_out');
    expect(cloudStore.get(CLOUD_KEY_AUTH_SESSION)).not.toContain('password');
    expect(cloudStore.has(CLOUD_KEY_SEARCH_HISTORY)).toBe(true);
  });

  it('BUG-3 regression: serializes concurrent CloudStorage RMW updates per key without clobbering', async () => {
    // Replace CloudStorage with an async-delayed version (15ms per getItem/setItem)
    const asyncBacking = new Map<string, string>();
    const cs = window.Telegram!.WebApp!.CloudStorage!;
    cs.getItem = vi.fn((key, cb) => {
      setTimeout(() => cb(null, asyncBacking.get(key)), 15);
    });
    cs.setItem = vi.fn((key, value, cb) => {
      setTimeout(() => {
        asyncBacking.set(key, value);
        cb?.(null, true);
      }, 15);
    });

    await saveSelectedGroup('251001');

    // Concurrent schedulePrefs updates must preserve all fields
    await Promise.all([
      saveSelectedGroup('351001'),
      saveSubgroup(2),
      saveDateRailVisible(false),
    ]);
    const prefs = await loadSchedulePrefs();
    expect(prefs.selectedGroup).toBe('351001');
    expect(prefs.subgroup).toBe(2);
    expect(prefs.dateRailVisible).toBe(false);

    // Concurrent notes mutations must preserve all notes
    await Promise.all([
      addNote({
        id: 'c1',
        subject: 'БД',
        text: 'Первая',
        date: '10.10.2025',
        time: null,
        isEvent: false,
        isPinned: false,
        lessonType: 'ЛР',
        attachments: [],
      }),
      addNote({
        id: 'c2',
        subject: 'РПМ',
        text: 'Вторая',
        date: '11.10.2025',
        time: null,
        isEvent: false,
        isPinned: false,
        lessonType: 'ПЗ',
        attachments: [],
      }),
      addNote({
        id: 'c3',
        subject: 'КС',
        text: 'Третья',
        date: '12.10.2025',
        time: null,
        isEvent: false,
        isPinned: false,
        lessonType: 'ЛК',
        attachments: [],
      }),
    ]);
    const notes = await loadNotes();
    expect(notes.map((n) => n.id)).toEqual(['c1', 'c2', 'c3']);

    // Concurrent search history updates must preserve both entries
    await Promise.all([
      addSearchHistory({ id: '351001', label: '351001', kind: 'group' }),
      addSearchHistory({ id: '251001', label: '251001', kind: 'group' }),
    ]);
    const history = await loadSearchHistory();
    expect(history.map((h) => h.id)).toEqual(['251001', '351001']);
  });
});
