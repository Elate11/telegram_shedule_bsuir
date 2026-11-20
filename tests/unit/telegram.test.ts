import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetTelegramAdaptersForTest,
  getCloudItem,
  getCloudKeys,
  initTelegramApp,
  parseInitData,
  pushBackHandler,
  removeCloudItem,
  setBackButton,
  setCloudItem,
  setHapticConfig,
  setMainButton,
  splitUtf8ByByteLimit,
  syncTelegramChromeColors,
  triggerHaptic,
} from '../../src/services/telegram';
import type { TelegramCloudStorage, TelegramWebApp } from '../../src/types';

function createMockWebApp(overrides?: Partial<TelegramWebApp>): {
  webApp: TelegramWebApp;
  triggerBackClick: () => void;
  triggerMainClick: () => void;
  store: Map<string, string>;
} {
  const backListeners = new Set<() => void>();
  const mainListeners = new Set<() => void>();
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

  const webApp: TelegramWebApp = {
    initData: '',
    initDataUnsafe: {},
    version: '8.0',
    platform: 'ios',
    colorScheme: 'dark',
    themeParams: { bg_color: '#272729' },
    isExpanded: false,
    viewportHeight: 844,
    viewportStableHeight: 844,
    safeAreaInset: { top: 47, bottom: 34, left: 0, right: 0 },
    contentSafeAreaInset: { top: 54, bottom: 34, left: 0, right: 0 },
    BackButton: {
      isVisible: false,
      onClick: vi.fn((cb) => {
        backListeners.add(cb);
      }),
      offClick: vi.fn((cb) => {
        backListeners.delete(cb);
      }),
      show: vi.fn(() => {
        webApp.BackButton.isVisible = true;
      }),
      hide: vi.fn(() => {
        webApp.BackButton.isVisible = false;
      }),
    },
    MainButton: {
      text: '',
      color: '#2997FF',
      textColor: '#FFFFFF',
      isVisible: false,
      isActive: true,
      setText: vi.fn((t) => {
        webApp.MainButton.text = t;
      }),
      onClick: vi.fn((cb) => {
        mainListeners.add(cb);
      }),
      offClick: vi.fn((cb) => {
        mainListeners.delete(cb);
      }),
      show: vi.fn(() => {
        webApp.MainButton.isVisible = true;
      }),
      hide: vi.fn(() => {
        webApp.MainButton.isVisible = false;
      }),
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
    expand: vi.fn(() => {
      webApp.isExpanded = true;
    }),
    close: vi.fn(),
    disableVerticalSwipes: vi.fn(),
    setHeaderColor: vi.fn(),
    setBackgroundColor: vi.fn(),
    onEvent: vi.fn(),
    offEvent: vi.fn(),
    ...overrides,
  };

  return {
    webApp,
    store,
    triggerBackClick: () => {
      Array.from(backListeners).forEach((fn) => fn());
    },
    triggerMainClick: () => {
      Array.from(mainListeners).forEach((fn) => fn());
    },
  };
}

describe('telegram.ts SDK adapter', () => {
  beforeEach(() => {
    _resetTelegramAdaptersForTest();
    localStorage.clear();
    delete window.Telegram;
    document.documentElement.style.cssText = '';
  });

  it('initializes Telegram WebApp, calls ready/expand/disableVerticalSwipes and writes safe-area CSS vars', () => {
    const userJson = encodeURIComponent(JSON.stringify({ id: 42, first_name: 'Ivan', username: 'ivan_bsuir' }));
    const { webApp } = createMockWebApp({
      initData: `query_id=q1&user=${userJson}&auth_date=1700000000&hash=abc`,
      colorScheme: 'light',
    });
    window.Telegram = { WebApp: webApp };

    const info = initTelegramApp();
    expect(webApp.ready).toHaveBeenCalledTimes(1);
    expect(webApp.expand).toHaveBeenCalledTimes(1);
    expect(webApp.disableVerticalSwipes).toHaveBeenCalledTimes(1);
    expect(info.isTelegram).toBe(true);
    expect(info.colorScheme).toBe('light');
    expect(info.user?.id).toBe(42);
    expect(document.documentElement.style.getPropertyValue('--tg-safe-area-inset-top')).toBe('47px');
    expect(document.documentElement.style.getPropertyValue('--tg-content-safe-area-inset-top')).toBe('54px');

    syncTelegramChromeColors('#272729');
    expect(webApp.setBackgroundColor).toHaveBeenCalledWith('#272729');
    expect(webApp.setHeaderColor).toHaveBeenCalledWith('#272729');
  });

  it('gracefully initializes outside Telegram when window.Telegram is absent', () => {
    const info = initTelegramApp();
    expect(info.isTelegram).toBe(false);
    expect(info.user).toBeNull();
    expect(info.hasCloudStorage).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--tg-safe-area-inset-top')).toBe('0px');
  });

  it('parses valid, empty, and malformed initData safely', () => {
    const empty = parseInitData('');
    expect(empty.user).toBeNull();
    expect(empty.authDate).toBeNull();

    const malformed = parseInitData('user=%7Bbad_json&auth_date=notanumber');
    expect(malformed.user).toBeNull();
    expect(malformed.authDate).toBeNull();

    const valid = parseInitData(
      `query_id=AAHdF6&user=${encodeURIComponent(JSON.stringify({ id: 101, first_name: 'Anna' }))}&auth_date=1710000000&start_param=group_123&hash=deadbeef`,
    );
    expect(valid.user?.first_name).toBe('Anna');
    expect(valid.authDate).toBe(1710000000);
    expect(valid.startParam).toBe('group_123');
    expect(valid.hash).toBe('deadbeef');
  });

  it('manages BackButton as a LIFO handler stack and supports setBackButton', () => {
    const { webApp, triggerBackClick } = createMockWebApp();
    window.Telegram = { WebApp: webApp };

    const h1 = vi.fn();
    const h2 = vi.fn();

    const pop1 = pushBackHandler(h1);
    const pop2 = pushBackHandler(h2);
    expect(webApp.BackButton.show).toHaveBeenCalled();

    triggerBackClick();
    expect(h2).toHaveBeenCalledTimes(1);
    expect(h1).not.toHaveBeenCalled();

    pop2();
    triggerBackClick();
    expect(h1).toHaveBeenCalledTimes(1);

    pop1();
    expect(webApp.BackButton.hide).toHaveBeenCalled();

    const legacy = vi.fn();
    setBackButton(true, legacy);
    triggerBackClick();
    expect(legacy).toHaveBeenCalledTimes(1);
    setBackButton(false);
    expect(webApp.BackButton.hide).toHaveBeenCalledTimes(2);
  });

  it('replaces MainButton listener cleanly and hides on visible: false', () => {
    const { webApp, triggerMainClick } = createMockWebApp();
    window.Telegram = { WebApp: webApp };

    const click1 = vi.fn();
    const click2 = vi.fn();

    setMainButton({ visible: true, text: 'Шаг 1', onClick: click1 });
    setMainButton({ visible: true, text: 'Шаг 2', onClick: click2 });

    expect(webApp.MainButton.offClick).toHaveBeenCalledWith(click1);
    triggerMainClick();
    expect(click1).not.toHaveBeenCalled();
    expect(click2).toHaveBeenCalledTimes(1);

    setMainButton({ visible: false });
    expect(webApp.MainButton.hide).toHaveBeenCalled();
    triggerMainClick();
    expect(click2).toHaveBeenCalledTimes(1);
  });

  it('dispatches HapticFeedback and respects enabled/strength suppression', () => {
    const { webApp } = createMockWebApp();
    window.Telegram = { WebApp: webApp };

    setHapticConfig(true, 0.8);
    triggerHaptic('impact', 'medium');
    triggerHaptic('notification', 'success');
    triggerHaptic('selection');
    expect(webApp.HapticFeedback.impactOccurred).toHaveBeenCalledWith('medium');
    expect(webApp.HapticFeedback.notificationOccurred).toHaveBeenCalledWith('success');
    expect(webApp.HapticFeedback.selectionChanged).toHaveBeenCalledTimes(1);

    setHapticConfig(false, 0.8);
    triggerHaptic('impact', 'heavy');
    expect(webApp.HapticFeedback.impactOccurred).toHaveBeenCalledTimes(1);

    setHapticConfig(true, 0.04);
    triggerHaptic('selection');
    expect(webApp.HapticFeedback.selectionChanged).toHaveBeenCalledTimes(1);
  });

  it('stores small and >4096-byte Cyrillic/emoji values via UTF-8 safe chunking in CloudStorage', async () => {
    const { webApp, store } = createMockWebApp();
    window.Telegram = { WebApp: webApp };

    await setCloudItem('simple_key', 'hello');
    expect(store.get('simple_key')).toBe('hello');
    expect(await getCloudItem('simple_key')).toBe('hello');

    const longCyrillic = 'Заметка БГУИР 🚀 '.repeat(400); // > 9000 UTF-8 bytes
    const chunks = splitUtf8ByByteLimit(longCyrillic, 3800);
    expect(chunks.length).toBeGreaterThan(2);
    const enc = new TextEncoder();
    for (const chunk of chunks) {
      expect(enc.encode(chunk).length).toBeLessThanOrEqual(3800);
    }

    await setCloudItem('notes_v1', longCyrillic);
    expect(store.has('notes_v1__chunks')).toBe(true);
    for (const [k, v] of store.entries()) {
      expect(enc.encode(v).length).toBeLessThanOrEqual(4096);
      expect(k.length).toBeGreaterThan(0);
    }

    const keys = await getCloudKeys();
    expect(keys).toContain('simple_key');
    expect(keys.some((k) => k.includes('__chunk'))).toBe(false);

    const restored = await getCloudItem('notes_v1');
    expect(restored).toBe(longCyrillic);

    await removeCloudItem('notes_v1');
    expect(store.has('notes_v1__chunks')).toBe(false);
    expect(Array.from(store.keys()).some((k) => k.startsWith('notes_v1__'))).toBe(false);
  });

  it('falls back seamlessly to localStorage when CloudStorage is missing or returns error', async () => {
    await setCloudItem('offline_key', 'value_123');
    expect(await getCloudItem('offline_key')).toBe('value_123');
    expect(await getCloudKeys()).toContain('offline_key');

    const failingCloud: TelegramCloudStorage = {
      setItem: (_k, _v, cb) => cb?.('CLOUD_ERR'),
      getItem: (_k, cb) => cb('CLOUD_ERR'),
      getItems: (_ks, cb) => cb('CLOUD_ERR'),
      removeItem: (_k, cb) => cb?.('CLOUD_ERR'),
      removeItems: (_ks, cb) => cb?.('CLOUD_ERR'),
      getKeys: (cb) => cb('CLOUD_ERR'),
    };
    const { webApp } = createMockWebApp({ CloudStorage: failingCloud });
    window.Telegram = { WebApp: webApp };

    await setCloudItem('fallback_key', 'safe_data');
    expect(await getCloudItem('fallback_key')).toBe('safe_data');
  });

  it('recovers chunked keys in getCloudKeys() without leaking internal __chunks/__chunk_* keys', async () => {
    const { webApp, store } = createMockWebApp();
    window.Telegram = { WebApp: webApp };

    await setCloudItem('exact_small', 'x'.repeat(100));
    await setCloudItem('big_notes', 'Б'.repeat(4500)); // > 3800 UTF-8 bytes => chunked

    expect(store.has('big_notes__chunks')).toBe(true);
    expect(store.has('big_notes')).toBe(false);

    const keys = await getCloudKeys();
    expect(keys).toContain('exact_small');
    expect(keys).toContain('big_notes');
    expect(keys.filter((k) => k === 'big_notes')).toHaveLength(1);
    expect(keys.some((k) => k.includes('__chunk'))).toBe(false);
  });

  it('rejects invalid chunk count (1e9, 1.5, -1, NaN) and falls back cleanly without corrupting localStorage', async () => {
    const { webApp, store } = createMockWebApp();
    window.Telegram = { WebApp: webApp };

    localStorage.setItem('corrupt_key', 'LOCAL_SAFE_VALUE');
    store.set('corrupt_key__chunk_0', 'corrupt_partial');

    for (const badMeta of [
      JSON.stringify({ v: 1, count: 1e9 }),
      JSON.stringify({ v: 1, count: 1.5 }),
      JSON.stringify({ v: 1, count: -1 }),
      JSON.stringify({ v: 1, count: Number.NaN }),
      '{bad-json',
    ]) {
      store.set('corrupt_key__chunks', badMeta);
      const val = await getCloudItem('corrupt_key');
      expect(val).toBe('LOCAL_SAFE_VALUE');
      expect(localStorage.getItem('corrupt_key')).toBe('LOCAL_SAFE_VALUE');
    }

    // removeCloudItem must also handle absurd count safely without OOM
    store.set('corrupt_key__chunks', JSON.stringify({ v: 1, count: 1e9 }));
    await removeCloudItem('corrupt_key');
    expect(store.has('corrupt_key__chunks')).toBe(false);
    expect(store.has('corrupt_key__chunk_0')).toBe(false);
  });

  it('preserves existing CloudStorage chunks when shrinking 5->2 fails on chunk_0 or chunk_1', async () => {
    const { webApp, store } = createMockWebApp();
    window.Telegram = { WebApp: webApp };

    const originalValue = 'Я'.repeat(8500); // ~17000 UTF-8 bytes => 5 chunks
    await setCloudItem('atomic_key', originalValue);
    const metaBefore = JSON.parse(store.get('atomic_key__chunks') ?? '{}') as {
      v?: number;
      slot?: number;
      count?: number;
    };
    expect(metaBefore.v).toBe(2);
    expect(metaBefore.slot).toBe(0);
    expect(metaBefore.count).toBe(5);

    const origSetItem = webApp.CloudStorage!.setItem;
    const smallerValue = 'А'.repeat(2500); // ~5000 UTF-8 bytes => 2 chunks

    // Case A: fail on chunk_0 of next slot (s1_0)
    localStorage.removeItem('atomic_key');
    webApp.CloudStorage!.setItem = vi.fn((k, v, cb) => {
      if (k === 'atomic_key__s1_0') {
        cb?.('TRANSIENT_NET_ERR_0');
        return;
      }
      origSetItem(k, v, cb);
    });
    await setCloudItem('atomic_key', smallerValue);
    expect(store.has('atomic_key__s0_2')).toBe(true);
    expect(store.has('atomic_key__s0_4')).toBe(true);
    expect(await getCloudItem('atomic_key')).toBe(originalValue);

    // Case B: fail on chunk_1 of next slot (s1_1) — must not return hybrid А + Я
    localStorage.removeItem('atomic_key');
    webApp.CloudStorage!.setItem = vi.fn((k, v, cb) => {
      if (k === 'atomic_key__s1_1') {
        cb?.('TRANSIENT_NET_ERR_1');
        return;
      }
      origSetItem(k, v, cb);
    });
    await setCloudItem('atomic_key', smallerValue);
    expect(store.has('atomic_key__s0_2')).toBe(true);
    expect(store.has('atomic_key__s0_4')).toBe(true);
    expect(await getCloudItem('atomic_key')).toBe(originalValue);
  });

  it('preserves existing CloudStorage chunks when growing 2->5 fails on __chunks commit', async () => {
    const { webApp, store } = createMockWebApp();
    window.Telegram = { WebApp: webApp };

    const originalValue = 'Б'.repeat(2500); // ~5000 UTF-8 bytes => 2 chunks (slot 0)
    await setCloudItem('growth_key', originalValue);
    const metaBefore = JSON.parse(store.get('growth_key__chunks') ?? '{}') as {
      v?: number;
      slot?: number;
      count?: number;
    };
    expect(metaBefore.slot).toBe(0);
    expect(metaBefore.count).toBe(2);

    localStorage.removeItem('growth_key');

    const origSetItem = webApp.CloudStorage!.setItem;
    webApp.CloudStorage!.setItem = vi.fn((k, v, cb) => {
      if (k === 'growth_key__chunks') {
        cb?.('TRANSIENT_META_ERR');
        return;
      }
      origSetItem(k, v, cb);
    });

    const largerValue = 'В'.repeat(8500); // ~17000 UTF-8 bytes => 5 chunks (slot 1)
    await setCloudItem('growth_key', largerValue);

    // __chunks still points to slot 0 (count 2) and slot 0 chunks are untouched
    const metaAfter = JSON.parse(store.get('growth_key__chunks') ?? '{}') as {
      slot?: number;
      count?: number;
    };
    expect(metaAfter.slot).toBe(0);
    expect(metaAfter.count).toBe(2);
    expect(await getCloudItem('growth_key')).toBe(originalValue);
  });

  it('never lets stale __chunks shadow a smaller <=3800B write when removeItems fails', async () => {
    const { webApp, store } = createMockWebApp();
    window.Telegram = { WebApp: webApp };

    const chunkedValue = 'Г'.repeat(4500); // 3 chunks
    await setCloudItem('shrink_small', chunkedValue);
    expect(store.has('shrink_small__chunks')).toBe(true);

    // Case 1: removeItems fails, removeItem succeeds
    webApp.CloudStorage!.removeItems = vi.fn((_ks, cb) => cb?.('REMOVE_ERR'));
    await setCloudItem('shrink_small', 'small_ok');
    localStorage.removeItem('shrink_small');
    expect(await getCloudItem('shrink_small')).toBe('small_ok');

    // Case 2: both removeItems and removeItem fail -> inline marker fallback prevents shadowing
    await setCloudItem('shrink_small_2', chunkedValue);
    webApp.CloudStorage!.removeItems = vi.fn((_ks, cb) => cb?.('REMOVE_ERR'));
    webApp.CloudStorage!.removeItem = vi.fn((_k, cb) => cb?.('REMOVE_SINGLE_ERR'));
    await setCloudItem('shrink_small_2', 'small_fallback_ok');
    localStorage.removeItem('shrink_small_2');
    expect(await getCloudItem('shrink_small_2')).toBe('small_fallback_ok');
  });

  it('reads and upgrades legacy v1 __chunk_* data cleanly', async () => {
    const { webApp, store } = createMockWebApp();
    window.Telegram = { WebApp: webApp };

    store.set('legacy_key__chunks', JSON.stringify({ v: 1, count: 2 }));
    store.set('legacy_key__chunk_0', 'partA_');
    store.set('legacy_key__chunk_1', 'partB');

    expect(await getCloudItem('legacy_key')).toBe('partA_partB');
    expect(await getCloudKeys()).toContain('legacy_key');

    const updated = 'Ю'.repeat(4500);
    await setCloudItem('legacy_key', updated);
    expect(store.has('legacy_key__chunk_0')).toBe(false);
    expect(store.has('legacy_key__chunk_1')).toBe(false);
    localStorage.removeItem('legacy_key');
    expect(await getCloudItem('legacy_key')).toBe(updated);
  });
});
