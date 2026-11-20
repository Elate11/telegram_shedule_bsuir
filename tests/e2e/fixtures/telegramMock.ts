import type { Page } from '@playwright/test';

export type TelegramMockMode =
  | 'full'
  | 'none'
  | 'noCloudStorage'
  | 'partialSdk'
  | 'corruptedInitData';

export interface TelegramMockUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramSafeArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface TelegramMockLogEntry {
  method: string;
  args: unknown[];
  ts: number;
}

export interface TelegramMockOptions {
  mode?: TelegramMockMode;
  version?: string;
  platform?: string;
  colorScheme?: 'dark' | 'light';
  themeParams?: Record<string, string>;
  safeAreaInset?: TelegramSafeArea;
  contentSafeAreaInset?: TelegramSafeArea;
  viewportHeight?: number;
  viewportStableHeight?: number;
  user?: TelegramMockUser;
  initData?: string;
  initialCloudStorage?: Record<string, string>;
  cloudStorageErrorOnGet?: boolean;
  cloudStorageErrorOnSet?: boolean;
  cloudStorageErrorOnRemove?: boolean;
  cloudStorageErrorOnKeys?: boolean;
}

export interface TelegramBridgeState {
  cloudStore: Map<string, string>;
  faults: {
    get: boolean;
    set: boolean;
    remove: boolean;
    keys: boolean;
  };
}

const pageCloudStates = new WeakMap<Page, TelegramBridgeState>();
const pageBridgeInstalled = new WeakSet<Page>();
const pageRouteInstalled = new WeakSet<Page>();

const MAX_CLOUD_VALUE_BYTES = 4096;

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function buildDefaultInitData(user: TelegramMockUser): string {
  const params = new URLSearchParams();
  params.set('query_id', 'AAHdF6IQAAAAAN0XohDhrOrc');
  params.set('user', JSON.stringify(user));
  params.set('auth_date', '1795000000');
  params.set('hash', 'mock_hmac_sha256_signature_hex');
  return params.toString();
}

export async function installTelegramMock(
  page: Page,
  options: TelegramMockOptions = {},
): Promise<void> {
  const mode: TelegramMockMode = options.mode ?? 'full';
  const version =
    options.version ?? (mode === 'noCloudStorage' ? '6.0' : '7.10');
  const platform = options.platform ?? 'ios';
  const colorScheme = options.colorScheme ?? 'dark';
  const user: TelegramMockUser = options.user ?? {
    id: 10042001,
    first_name: 'Алексей',
    last_name: 'Соколов',
    username: 'sokolov_bsuir',
    language_code: 'ru',
  };

  const safeAreaInset: TelegramSafeArea = options.safeAreaInset ?? {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  };
  const contentSafeAreaInset: TelegramSafeArea = options.contentSafeAreaInset ?? {
    ...safeAreaInset,
  };
  const themeParams = options.themeParams ?? {
    bg_color: colorScheme === 'dark' ? '#272729' : '#f5f5f7',
    text_color: colorScheme === 'dark' ? '#ffffff' : '#1d1d1f',
    hint_color: colorScheme === 'dark' ? '#cccccc' : '#7a7a7a',
    link_color: colorScheme === 'dark' ? '#2997ff' : '#0066cc',
    button_color: colorScheme === 'dark' ? '#0071e3' : '#0066cc',
    button_text_color: '#ffffff',
    secondary_bg_color: colorScheme === 'dark' ? '#2a2a2c' : '#ffffff',
  };

  let initData = options.initData ?? buildDefaultInitData(user);
  let initDataUnsafe: Record<string, unknown> = {
    query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
    user,
    auth_date: 1795000000,
    hash: 'mock_hmac_sha256_signature_hex',
  };

  if (mode === 'corruptedInitData') {
    initData = 'user=%7Bbroken_json%%%&auth_date=not_a_number&hash=';
    initDataUnsafe = {};
  }

  const state: TelegramBridgeState = {
    cloudStore: new Map(Object.entries(options.initialCloudStorage ?? {})),
    faults: {
      get: Boolean(options.cloudStorageErrorOnGet),
      set: Boolean(options.cloudStorageErrorOnSet),
      remove: Boolean(options.cloudStorageErrorOnRemove),
      keys: Boolean(options.cloudStorageErrorOnKeys),
    },
  };
  pageCloudStates.set(page, state);

  if (!pageRouteInstalled.has(page)) {
    pageRouteInstalled.add(page);
    await page.route(
      (url) =>
        url.hostname === 'telegram.org' ||
        url.hostname.endsWith('.telegram.org') ||
        /telegram-web-app\.js/i.test(url.pathname),
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/javascript; charset=utf-8',
          body: '/* telegram-web-app.js mocked by telegramMock */',
        });
      },
    );
  }

  if (!pageBridgeInstalled.has(page)) {
    pageBridgeInstalled.add(page);
    await page.exposeFunction(
      '__tgMockCloudBridge__',
      (
        op: 'getItem' | 'getItems' | 'setItem' | 'removeItem' | 'removeItems' | 'getKeys',
        arg1?: unknown,
        arg2?: unknown,
      ): { error: string | null; value?: unknown } => {
        const cur = pageCloudStates.get(page);
        if (!cur) return { error: 'BRIDGE_UNAVAILABLE' };

        if (op === 'getItem') {
          if (cur.faults.get) return { error: 'CLOUD_STORAGE_GET_ERROR' };
          const key = String(arg1 ?? '');
          return { error: null, value: cur.cloudStore.get(key) ?? '' };
        }
        if (op === 'getItems') {
          if (cur.faults.get) return { error: 'CLOUD_STORAGE_GET_ERROR' };
          const keys = Array.isArray(arg1) ? arg1.map(String) : [];
          const out: Record<string, string> = {};
          for (const k of keys) {
            out[k] = cur.cloudStore.get(k) ?? '';
          }
          return { error: null, value: out };
        }
        if (op === 'setItem') {
          if (cur.faults.set) return { error: 'CLOUD_STORAGE_SET_ERROR', value: false };
          const key = String(arg1 ?? '');
          const val = String(arg2 ?? '');
          if (key.length === 0 || key.length > 128) {
            return { error: 'INVALID_KEY', value: false };
          }
          if (utf8ByteLength(val) > MAX_CLOUD_VALUE_BYTES) {
            return { error: 'VALUE_TOO_LONG', value: false };
          }
          cur.cloudStore.set(key, val);
          return { error: null, value: true };
        }
        if (op === 'removeItem') {
          if (cur.faults.remove) return { error: 'CLOUD_STORAGE_REMOVE_ERROR', value: false };
          cur.cloudStore.delete(String(arg1 ?? ''));
          return { error: null, value: true };
        }
        if (op === 'removeItems') {
          if (cur.faults.remove) return { error: 'CLOUD_STORAGE_REMOVE_ERROR', value: false };
          const keys = Array.isArray(arg1) ? arg1.map(String) : [];
          for (const k of keys) cur.cloudStore.delete(k);
          return { error: null, value: true };
        }
        if (op === 'getKeys') {
          if (cur.faults.keys) return { error: 'CLOUD_STORAGE_KEYS_ERROR', value: [] };
          return { error: null, value: Array.from(cur.cloudStore.keys()) };
        }
        return { error: 'UNKNOWN_OP' };
      },
    );
  }

  await page.addInitScript(
    (cfg: {
      mode: TelegramMockMode;
      version: string;
      platform: string;
      colorScheme: 'dark' | 'light';
      themeParams: Record<string, string>;
      safeAreaInset: TelegramSafeArea;
      contentSafeAreaInset: TelegramSafeArea;
      viewportHeight: number;
      viewportStableHeight: number;
      initData: string;
      initDataUnsafe: Record<string, unknown>;
    }) => {
      const w = window as unknown as Record<string, unknown>;
      const logs: Array<{ method: string; args: unknown[]; ts: number }> = [];
      const backCallbacks: Array<() => void> = [];
      const mainCallbacks: Array<() => void> = [];
      const eventHandlers: Record<string, Array<() => void>> = {};

      w.__TG_MOCK_LOG__ = logs;
      w.__TG_BACK_CALLBACKS__ = backCallbacks;
      w.__TG_MAIN_CALLBACKS__ = mainCallbacks;

      const record = (method: string, ...args: unknown[]) => {
        logs.push({ method, args, ts: Date.now() });
      };

      if (cfg.mode === 'none') {
        try {
          delete w.Telegram;
        } catch {
          w.Telegram = undefined;
        }
        return;
      }

      const bridge = w.__tgMockCloudBridge__ as
        | ((
            op: string,
            arg1?: unknown,
            arg2?: unknown,
          ) => Promise<{ error: string | null; value?: unknown }>)
        | undefined;

      const cloudStorage =
        cfg.mode === 'noCloudStorage' || cfg.mode === 'partialSdk'
          ? undefined
          : {
              setItem(
                key: string,
                value: string,
                cb?: (err: string | null, ok?: boolean) => void,
              ) {
                record('CloudStorage.setItem', key, value);
                if (!bridge) {
                  cb?.('BRIDGE_MISSING', false);
                  return;
                }
                void bridge('setItem', key, value).then((res) => {
                  cb?.(res.error, Boolean(res.value));
                });
              },
              getItem(key: string, cb: (err: string | null, val?: string) => void) {
                record('CloudStorage.getItem', key);
                if (!bridge) {
                  cb('BRIDGE_MISSING');
                  return;
                }
                void bridge('getItem', key).then((res) => {
                  cb(res.error, typeof res.value === 'string' ? res.value : '');
                });
              },
              getItems(
                keys: string[],
                cb: (err: string | null, vals?: Record<string, string>) => void,
              ) {
                record('CloudStorage.getItems', keys);
                if (!bridge) {
                  cb('BRIDGE_MISSING');
                  return;
                }
                void bridge('getItems', keys).then((res) => {
                  cb(
                    res.error,
                    (res.value as Record<string, string> | undefined) ?? {},
                  );
                });
              },
              removeItem(
                key: string,
                cb?: (err: string | null, ok?: boolean) => void,
              ) {
                record('CloudStorage.removeItem', key);
                if (!bridge) {
                  cb?.('BRIDGE_MISSING', false);
                  return;
                }
                void bridge('removeItem', key).then((res) => {
                  cb?.(res.error, Boolean(res.value));
                });
              },
              removeItems(
                keys: string[],
                cb?: (err: string | null, ok?: boolean) => void,
              ) {
                record('CloudStorage.removeItems', keys);
                if (!bridge) {
                  cb?.('BRIDGE_MISSING', false);
                  return;
                }
                void bridge('removeItems', keys).then((res) => {
                  cb?.(res.error, Boolean(res.value));
                });
              },
              getKeys(cb: (err: string | null, keys?: string[]) => void) {
                record('CloudStorage.getKeys');
                if (!bridge) {
                  cb('BRIDGE_MISSING');
                  return;
                }
                void bridge('getKeys').then((res) => {
                  cb(res.error, Array.isArray(res.value) ? (res.value as string[]) : []);
                });
              },
            };

      const webAppBase: Record<string, unknown> = {
        initData: cfg.initData,
        initDataUnsafe: cfg.initDataUnsafe,
        version: cfg.version,
        platform: cfg.platform,
        colorScheme: cfg.colorScheme,
        themeParams: cfg.themeParams,
        isExpanded: false,
        viewportHeight: cfg.viewportHeight,
        viewportStableHeight: cfg.viewportStableHeight,
        safeAreaInset: cfg.safeAreaInset,
        contentSafeAreaInset: cfg.contentSafeAreaInset,
        ready() {
          record('ready');
        },
        expand() {
          webAppBase.isExpanded = true;
          record('expand');
        },
        close() {
          record('close');
        },
        setHeaderColor(color: string) {
          record('setHeaderColor', color);
        },
        setBackgroundColor(color: string) {
          record('setBackgroundColor', color);
        },
      };

      if (cfg.mode !== 'partialSdk') {
        const backButton = {
          isVisible: false,
          show() {
            backButton.isVisible = true;
            record('BackButton.show');
          },
          hide() {
            backButton.isVisible = false;
            record('BackButton.hide');
          },
          onClick(cb: () => void) {
            if (!backCallbacks.includes(cb)) backCallbacks.push(cb);
            record('BackButton.onClick');
          },
          offClick(cb: () => void) {
            const idx = backCallbacks.indexOf(cb);
            if (idx !== -1) backCallbacks.splice(idx, 1);
            record('BackButton.offClick');
          },
        };

        const mainButton = {
          text: 'Продолжить',
          color: cfg.themeParams.button_color ?? '#0071e3',
          textColor: '#ffffff',
          isVisible: false,
          isActive: true,
          setText(text: string) {
            mainButton.text = text;
            record('MainButton.setText', text);
          },
          onClick(cb: () => void) {
            if (!mainCallbacks.includes(cb)) mainCallbacks.push(cb);
            record('MainButton.onClick');
          },
          offClick(cb: () => void) {
            const idx = mainCallbacks.indexOf(cb);
            if (idx !== -1) mainCallbacks.splice(idx, 1);
            record('MainButton.offClick');
          },
          show() {
            mainButton.isVisible = true;
            record('MainButton.show');
          },
          hide() {
            mainButton.isVisible = false;
            record('MainButton.hide');
          },
          enable() {
            mainButton.isActive = true;
            record('MainButton.enable');
          },
          disable() {
            mainButton.isActive = false;
            record('MainButton.disable');
          },
          setParams(params: Record<string, unknown>) {
            if (typeof params.text === 'string') mainButton.text = params.text;
            if (typeof params.color === 'string') mainButton.color = params.color;
            if (typeof params.text_color === 'string') mainButton.textColor = params.text_color;
            if (typeof params.is_active === 'boolean') mainButton.isActive = params.is_active;
            if (typeof params.is_visible === 'boolean') mainButton.isVisible = params.is_visible;
            record('MainButton.setParams', params);
          },
        };

        const hapticFeedback = {
          impactOccurred(style: string) {
            record('HapticFeedback.impactOccurred', style);
          },
          notificationOccurred(type: string) {
            record('HapticFeedback.notificationOccurred', type);
          },
          selectionChanged() {
            record('HapticFeedback.selectionChanged');
          },
        };

        webAppBase.BackButton = backButton;
        webAppBase.MainButton = mainButton;
        webAppBase.HapticFeedback = hapticFeedback;
        webAppBase.disableVerticalSwipes = () => {
          record('disableVerticalSwipes');
        };
        webAppBase.enableVerticalSwipes = () => {
          record('enableVerticalSwipes');
        };
        webAppBase.onEvent = (eventType: string, cb: () => void) => {
          if (!eventHandlers[eventType]) eventHandlers[eventType] = [];
          eventHandlers[eventType].push(cb);
          record('onEvent', eventType);
        };
        webAppBase.offEvent = (eventType: string, cb: () => void) => {
          const list = eventHandlers[eventType];
          if (list) {
            const idx = list.indexOf(cb);
            if (idx !== -1) list.splice(idx, 1);
          }
          record('offEvent', eventType);
        };
      }

      if (cloudStorage) {
        webAppBase.CloudStorage = cloudStorage;
      }

      w.Telegram = {
        WebApp: webAppBase,
      };
    },
    {
      mode,
      version,
      platform,
      colorScheme,
      themeParams,
      safeAreaInset,
      contentSafeAreaInset,
      viewportHeight: options.viewportHeight ?? 844,
      viewportStableHeight: options.viewportStableHeight ?? 844,
      initData,
      initDataUnsafe,
    },
  );
}

export async function getTelegramMockLog(page: Page): Promise<TelegramMockLogEntry[]> {
  return page.evaluate(() => {
    const w = window as unknown as { __TG_MOCK_LOG__?: TelegramMockLogEntry[] };
    return Array.isArray(w.__TG_MOCK_LOG__) ? [...w.__TG_MOCK_LOG__] : [];
  });
}

export async function clearTelegramMockLog(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __TG_MOCK_LOG__?: TelegramMockLogEntry[] };
    w.__TG_MOCK_LOG__ = [];
  });
}

export async function triggerTelegramBackButton(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __TG_BACK_CALLBACKS__?: Array<() => void> };
    const cbs = w.__TG_BACK_CALLBACKS__ ?? [];
    for (const cb of [...cbs]) {
      cb();
    }
  });
}

export async function triggerTelegramMainButton(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __TG_MAIN_CALLBACKS__?: Array<() => void> };
    const cbs = w.__TG_MAIN_CALLBACKS__ ?? [];
    for (const cb of [...cbs]) {
      cb();
    }
  });
}

export async function getCloudStorageSnapshot(
  page: Page,
): Promise<Record<string, string>> {
  const state = pageCloudStates.get(page);
  if (!state) return {};
  return Object.fromEntries(state.cloudStore.entries());
}

export function setCloudStorageFaults(
  page: Page,
  faults: Partial<TelegramBridgeState['faults']>,
): void {
  const state = pageCloudStates.get(page);
  if (!state) return;
  state.faults = { ...state.faults, ...faults };
}

export async function getTelegramState(page: Page): Promise<{
  backButtonVisible: boolean;
  mainButtonVisible: boolean;
  mainButtonText: string;
  isExpanded: boolean;
  cloudStorage: Record<string, string>;
}> {
  const domState = await page.evaluate(() => {
    const wa = (
      window as unknown as {
        Telegram?: {
          WebApp?: {
            isExpanded?: boolean;
            BackButton?: { isVisible?: boolean };
            MainButton?: { isVisible?: boolean; text?: string };
          };
        };
      }
    ).Telegram?.WebApp;
    return {
      backButtonVisible: Boolean(wa?.BackButton?.isVisible),
      mainButtonVisible: Boolean(wa?.MainButton?.isVisible),
      mainButtonText: wa?.MainButton?.text ?? '',
      isExpanded: Boolean(wa?.isExpanded),
    };
  });

  return {
    ...domState,
    cloudStorage: await getCloudStorageSnapshot(page),
  };
}
