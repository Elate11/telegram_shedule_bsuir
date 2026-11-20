import type {
  MainButtonConfig,
  SafeAreaInsets,
  TelegramCloudStorage,
  TelegramContextInfo,
  TelegramUser,
  TelegramWebApp,
  ThemeMode,
} from '../types';

export interface ParsedInitData {
  raw: string;
  authDate: number | null;
  queryId: string | null;
  hash: string | null;
  startParam: string | null;
  chatType: string | null;
  user: TelegramUser | null;
  params: Record<string, string>;
}

const CLOUD_CHUNK_BYTE_LIMIT = 3800;
const LEGACY_BACK_ID = -1;

let nextBackId = 1;
const backStack: Array<{ id: number; handler: () => void }> = [];
let backClickAttached = false;
let activeMainButtonHandler: (() => void) | null = null;
let sdkEventsBound = false;

const hapticConfig = {
  enabled: true,
  strength: 0.6,
};

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

export function isInsideTelegram(tg: TelegramWebApp | null = getTelegramWebApp()): boolean {
  if (!tg) return false;
  return Boolean(
    tg.initData ||
      tg.initDataUnsafe?.user ||
      (tg.platform && tg.platform !== 'unknown'),
  );
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

function isVersionAtLeast(tg: TelegramWebApp | null, minVersion: string): boolean {
  if (!tg) return false;
  if (!tg.version) return true;
  return compareVersions(tg.version, minVersion) >= 0;
}

function getSupportedCloudStorage(tg: TelegramWebApp | null): TelegramCloudStorage | null {
  if (!tg?.CloudStorage) return null;
  if (!isInsideTelegram(tg)) return null;
  if (!isVersionAtLeast(tg, '6.9')) return null;
  return tg.CloudStorage;
}

function applySafeAreaCssVars(tg: TelegramWebApp | null): {
  safe: SafeAreaInsets;
  contentSafe: SafeAreaInsets;
} {
  const safe: SafeAreaInsets = {
    top: tg?.safeAreaInset?.top ?? 0,
    bottom: tg?.safeAreaInset?.bottom ?? 0,
    left: tg?.safeAreaInset?.left ?? 0,
    right: tg?.safeAreaInset?.right ?? 0,
  };
  const contentSafe: SafeAreaInsets = {
    top: tg?.contentSafeAreaInset?.top ?? safe.top,
    bottom: tg?.contentSafeAreaInset?.bottom ?? safe.bottom,
    left: tg?.contentSafeAreaInset?.left ?? safe.left,
    right: tg?.contentSafeAreaInset?.right ?? safe.right,
  };

  if (typeof document !== 'undefined') {
    const root = document.documentElement.style;
    root.setProperty('--tg-safe-area-inset-top', `${safe.top}px`);
    root.setProperty('--tg-safe-area-inset-bottom', `${safe.bottom}px`);
    root.setProperty('--tg-safe-area-inset-left', `${safe.left}px`);
    root.setProperty('--tg-safe-area-inset-right', `${safe.right}px`);

    root.setProperty('--tg-content-safe-area-inset-top', `${contentSafe.top}px`);
    root.setProperty('--tg-content-safe-area-inset-bottom', `${contentSafe.bottom}px`);
    root.setProperty('--tg-content-safe-area-inset-left', `${contentSafe.left}px`);
    root.setProperty('--tg-content-safe-area-inset-right', `${contentSafe.right}px`);

    if (typeof tg?.viewportHeight === 'number' && tg.viewportHeight > 0) {
      root.setProperty('--tg-viewport-height', `${tg.viewportHeight}px`);
    }
    if (typeof tg?.viewportStableHeight === 'number' && tg.viewportStableHeight > 0) {
      root.setProperty('--tg-viewport-stable-height', `${tg.viewportStableHeight}px`);
    }
  }

  return { safe, contentSafe };
}

function handleSdkViewportOrSafeAreaEvent(): void {
  applySafeAreaCssVars(getTelegramWebApp());
}

export function parseInitData(rawInitData?: string): ParsedInitData {
  const raw = (rawInitData ?? '').trim();
  const empty: ParsedInitData = {
    raw,
    authDate: null,
    queryId: null,
    hash: null,
    startParam: null,
    chatType: null,
    user: null,
    params: {},
  };
  if (!raw) return empty;

  const search = new URLSearchParams(raw);
  const params: Record<string, string> = {};
  search.forEach((value, key) => {
    params[key] = value;
  });

  let user: TelegramUser | null = null;
  if (params.user) {
    try {
      const parsed = JSON.parse(params.user) as TelegramUser;
      if (parsed && typeof parsed === 'object' && typeof parsed.id === 'number') {
        user = parsed;
      }
    } catch {
      user = null;
    }
  }

  let authDate: number | null = null;
  if (params.auth_date) {
    const n = Number.parseInt(params.auth_date, 10);
    if (!Number.isNaN(n)) {
      authDate = n;
    }
  }

  return {
    raw,
    authDate,
    queryId: params.query_id ?? null,
    hash: params.hash ?? null,
    startParam: params.start_param ?? null,
    chatType: params.chat_type ?? null,
    user,
    params,
  };
}

export function initTelegramApp(): TelegramContextInfo {
  const tg = getTelegramWebApp();

  try {
    tg?.ready?.();
  } catch {
    // ignore SDK errors in restricted environments
  }
  try {
    tg?.expand?.();
  } catch {
    // ignore
  }
  try {
    if (isVersionAtLeast(tg, '7.7')) {
      tg?.disableVerticalSwipes?.();
    }
  } catch {
    // ignore
  }

  const { safe, contentSafe } = applySafeAreaCssVars(tg);

  if (tg?.onEvent && !sdkEventsBound) {
    sdkEventsBound = true;
    try {
      tg.onEvent('viewportChanged', handleSdkViewportOrSafeAreaEvent);
      tg.onEvent('safeAreaChanged', handleSdkViewportOrSafeAreaEvent);
      tg.onEvent('contentSafeAreaChanged', handleSdkViewportOrSafeAreaEvent);
    } catch {
      // ignore
    }
  }

  const parsed = parseInitData(tg?.initData ?? '');
  const initDataUnsafe = {
    ...(tg?.initDataUnsafe ?? {}),
  };
  if (!initDataUnsafe.user && parsed.user) {
    initDataUnsafe.user = parsed.user;
  }

  const colorScheme: ThemeMode = tg?.colorScheme === 'light' ? 'light' : 'dark';

  return {
    isTelegram: isInsideTelegram(tg),
    platform: tg?.platform ?? 'web',
    version: tg?.version ?? '0.0',
    colorScheme,
    themeParams: tg?.themeParams ?? {},
    initData: tg?.initData ?? '',
    initDataUnsafe,
    user: initDataUnsafe.user ?? parsed.user ?? null,
    safeAreaInsets: safe,
    contentSafeAreaInsets: contentSafe,
    hasCloudStorage: Boolean(getSupportedCloudStorage(tg)),
  };
}

export function syncTelegramChromeColors(bgColor: string, headerColor?: string): void {
  const tg = getTelegramWebApp();
  if (!tg || !isVersionAtLeast(tg, '6.1')) return;
  try {
    tg.setBackgroundColor?.(bgColor);
  } catch {
    // ignore unsupported color format or legacy clients
  }
  try {
    tg.setHeaderColor?.(headerColor ?? bgColor);
  } catch {
    // ignore
  }
}

// ==================== BackButton LIFO Stack ====================

function dispatchBackClick(): void {
  const top = backStack[backStack.length - 1];
  top?.handler();
}

function syncBackButtonRegistration(tg: TelegramWebApp | null): void {
  if (!tg?.BackButton) return;
  if (backStack.length > 0) {
    if (!backClickAttached) {
      tg.BackButton.onClick(dispatchBackClick);
      backClickAttached = true;
    }
    tg.BackButton.show();
  } else {
    if (backClickAttached) {
      tg.BackButton.offClick(dispatchBackClick);
      backClickAttached = false;
    }
    tg.BackButton.hide();
  }
}

export function pushBackHandler(handler: () => void): () => void {
  const id = nextBackId++;
  backStack.push({ id, handler });
  syncBackButtonRegistration(getTelegramWebApp());

  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    const idx = backStack.findIndex((entry) => entry.id === id);
    if (idx !== -1) {
      backStack.splice(idx, 1);
    }
    syncBackButtonRegistration(getTelegramWebApp());
  };
}

export function setBackButton(visible: boolean, onClick?: () => void): void {
  const legacyIdx = backStack.findIndex((entry) => entry.id === LEGACY_BACK_ID);
  if (legacyIdx !== -1) {
    backStack.splice(legacyIdx, 1);
  }
  if (visible && onClick) {
    backStack.push({ id: LEGACY_BACK_ID, handler: onClick });
  }
  syncBackButtonRegistration(getTelegramWebApp());
}

// ==================== MainButton Lifecycle ====================

export function setMainButton(config: MainButtonConfig): void {
  const tg = getTelegramWebApp();
  if (!tg?.MainButton) return;

  if (activeMainButtonHandler) {
    try {
      tg.MainButton.offClick(activeMainButtonHandler);
    } catch {
      // ignore
    }
    activeMainButtonHandler = null;
  }

  if (!config.visible) {
    try {
      tg.MainButton.hide();
    } catch {
      // ignore
    }
    return;
  }

  const text = config.text ?? 'Готово';
  const isActive = config.isActive ?? true;

  try {
    tg.MainButton.setParams?.({
      text,
      color: config.color,
      text_color: config.textColor,
      is_active: isActive,
      is_visible: true,
    });
  } catch {
    // fallback below
  }

  try {
    tg.MainButton.setText?.(text);
    if (isActive) {
      tg.MainButton.enable?.();
    } else {
      tg.MainButton.disable?.();
    }
  } catch {
    // ignore
  }

  if (config.onClick) {
    activeMainButtonHandler = config.onClick;
    tg.MainButton.onClick(config.onClick);
  }

  tg.MainButton.show();
}

// ==================== HapticFeedback ====================

export function setHapticConfig(enabled: boolean, strength: number): void {
  hapticConfig.enabled = enabled;
  hapticConfig.strength = Math.max(0, Math.min(1, strength));
}

export function getHapticConfig(): { enabled: boolean; strength: number } {
  return { ...hapticConfig };
}

export function triggerHaptic(
  kind: 'impact' | 'notification' | 'selection',
  style?: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' | 'success' | 'warning' | 'error',
): void {
  if (!hapticConfig.enabled || hapticConfig.strength <= 0.05) return;
  const tg = getTelegramWebApp();
  const hf = tg?.HapticFeedback;
  if (!hf) return;

  try {
    if (kind === 'impact') {
      const defaultStyle: 'light' | 'medium' | 'heavy' =
        hapticConfig.strength < 0.35
          ? 'light'
          : hapticConfig.strength < 0.7
            ? 'medium'
            : 'heavy';
      const impactStyle =
        style === 'light' || style === 'medium' || style === 'heavy' || style === 'rigid' || style === 'soft'
          ? style
          : defaultStyle;
      hf.impactOccurred(impactStyle);
    } else if (kind === 'notification') {
      const notifType =
        style === 'success' || style === 'warning' || style === 'error' ? style : 'success';
      hf.notificationOccurred(notifType);
    } else {
      hf.selectionChanged();
    }
  } catch {
    // ignore unsupported desktop/legacy client calls
  }
}

// ==================== CloudStorage + localStorage Fallback ====================

const encoder = new TextEncoder();

const CHUNK_META_SUFFIX = '__chunks';
const CHUNK_PART_RE = /^(.+)(?:__chunk_\d+|__s[01]_\d+)$/;
const MAX_CLOUD_CHUNKS = 1024;
const MAX_CLOUD_KEY_LENGTH = 128;

const chunkMetaKey = (key: string): string => `${key}${CHUNK_META_SUFFIX}`;
const legacyChunkPartKey = (key: string, idx: number): string => `${key}__chunk_${idx}`;
const slottedChunkPartKey = (key: string, slot: 0 | 1, idx: number): string =>
  `${key}__s${slot}_${idx}`;

type ParsedChunkMeta =
  | { kind: 'inline' }
  | { kind: 'chunks'; version: 1; slot: null; count: number }
  | { kind: 'chunks'; version: 2; slot: 0 | 1; count: number };

function isValidChunkCount(count: unknown): count is number {
  return (
    typeof count === 'number' &&
    Number.isSafeInteger(count) &&
    count > 0 &&
    count <= MAX_CLOUD_CHUNKS
  );
}

function parseChunkMeta(metaRaw: string | null | undefined): ParsedChunkMeta | null {
  if (!metaRaw) return null;
  try {
    const parsed = JSON.parse(metaRaw) as {
      v?: unknown;
      slot?: unknown;
      count?: unknown;
      inline?: unknown;
    };
    if (!parsed || typeof parsed !== 'object') return null;

    if (parsed.v === 2 && parsed.inline === true) {
      return { kind: 'inline' };
    }

    if (!isValidChunkCount(parsed.count)) {
      return null;
    }

    if (parsed.v === 2) {
      if (parsed.slot !== 0 && parsed.slot !== 1) {
        return null;
      }
      return { kind: 'chunks', version: 2, slot: parsed.slot, count: parsed.count };
    }

    return { kind: 'chunks', version: 1, slot: null, count: parsed.count };
  } catch {
    return null;
  }
}

function getChunkPartKeysForMeta(
  key: string,
  meta: Extract<ParsedChunkMeta, { kind: 'chunks' }>,
): string[] {
  return Array.from({ length: meta.count }, (_, idx) =>
    meta.slot === null
      ? legacyChunkPartKey(key, idx)
      : slottedChunkPartKey(key, meta.slot, idx),
  );
}

function isLegacyChunkKeyForBase(candidateKey: string, baseKey: string): boolean {
  const prefix = `${baseKey}__chunk_`;
  if (!candidateKey.startsWith(prefix)) return false;
  return /^\d+$/.test(candidateKey.slice(prefix.length));
}

function isSlottedChunkKeyForBase(candidateKey: string, baseKey: string, slot?: 0 | 1): boolean {
  if (slot !== undefined) {
    const prefix = `${baseKey}__s${slot}_`;
    if (!candidateKey.startsWith(prefix)) return false;
    return /^\d+$/.test(candidateKey.slice(prefix.length));
  }
  const prefix = `${baseKey}__s`;
  if (!candidateKey.startsWith(prefix)) return false;
  return /^[01]_\d+$/.test(candidateKey.slice(prefix.length));
}

function normalizeCloudKeys(rawKeys: string[]): string[] {
  const logicalKeys = new Set<string>();
  for (const k of rawKeys) {
    if (k.endsWith(CHUNK_META_SUFFIX)) {
      const base = k.slice(0, -CHUNK_META_SUFFIX.length);
      if (base.length > 0) {
        logicalKeys.add(base);
      }
    } else if (CHUNK_PART_RE.test(k)) {
      continue;
    } else {
      logicalKeys.add(k);
    }
  }
  return Array.from(logicalKeys);
}

export function splitUtf8ByByteLimit(value: string, maxBytes: number = CLOUD_CHUNK_BYTE_LIMIT): string[] {
  if (value.length === 0) return [''];
  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const ch of value) {
    const chBytes = encoder.encode(ch).length;
    if (currentBytes + chBytes > maxBytes && current.length > 0) {
      chunks.push(current);
      current = ch;
      currentBytes = chBytes;
    } else {
      current += ch;
      currentBytes += chBytes;
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

function safeLocalGet(key: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalSet(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore quota errors
  }
}

function safeLocalRemove(key: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function csGetItem(cs: TelegramCloudStorage, key: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    try {
      cs.getItem(key, (error, value) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve(value === undefined ? null : value);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

function csGetItems(cs: TelegramCloudStorage, keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return Promise.resolve({});
  if (typeof cs.getItems === 'function') {
    return new Promise((resolve, reject) => {
      try {
        cs.getItems(keys, (error, values) => {
          if (error) {
            reject(new Error(error));
          } else {
            resolve(values ?? {});
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  return Promise.all(keys.map(async (k) => [k, await csGetItem(cs, k)] as const)).then(
    (entries) => {
      const out: Record<string, string> = {};
      for (const [k, v] of entries) {
        if (typeof v === 'string') out[k] = v;
      }
      return out;
    },
  );
}

function csSetItem(cs: TelegramCloudStorage, key: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      cs.setItem(key, value, (error) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

function csRemoveItem(cs: TelegramCloudStorage, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      cs.removeItem(key, (error) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

function csRemoveItems(cs: TelegramCloudStorage, keys: string[]): Promise<void> {
  if (keys.length === 0) return Promise.resolve();
  if (typeof cs.removeItems === 'function') {
    return new Promise((resolve, reject) => {
      try {
        cs.removeItems(keys, (error) => {
          if (error) {
            reject(new Error(error));
          } else {
            resolve();
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }
  return Promise.all(keys.map((k) => csRemoveItem(cs, k))).then(() => undefined);
}

function csGetKeys(cs: TelegramCloudStorage): Promise<string[]> {
  return new Promise((resolve, reject) => {
    try {
      cs.getKeys((error, keys) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve(keys ?? []);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

async function cleanupChunksAfterSmallWrite(
  cs: TelegramCloudStorage,
  key: string,
): Promise<void> {
  let prevMetaRaw: string | null = null;
  let metaReadFailed = false;
  try {
    prevMetaRaw = await csGetItem(cs, chunkMetaKey(key));
  } catch {
    metaReadFailed = true;
  }

  if (prevMetaRaw === null && !metaReadFailed) {
    return;
  }

  const toRemove = new Set<string>([chunkMetaKey(key)]);
  const prevMeta = parseChunkMeta(prevMetaRaw);

  if (prevMeta?.kind === 'chunks') {
    for (const partKey of getChunkPartKeysForMeta(key, prevMeta)) {
      toRemove.add(partKey);
    }
  } else {
    const allKeys = await csGetKeys(cs).catch(() => [] as string[]);
    for (const k of allKeys) {
      if (isLegacyChunkKeyForBase(k, key) || isSlottedChunkKeyForBase(k, key)) {
        toRemove.add(k);
      }
    }
  }

  try {
    await csRemoveItems(cs, Array.from(toRemove));
  } catch {
    // Batch removeItems failed; delete __chunks individually so stale chunks never shadow `key`.
    try {
      await csRemoveItem(cs, chunkMetaKey(key));
    } catch {
      // Fallback: mark __chunks inline so getCloudItem reads the committed base key.
      await csSetItem(cs, chunkMetaKey(key), JSON.stringify({ v: 2, inline: true })).catch(
        () => undefined,
      );
    }
  }
}

async function cleanupOldChunksAfterCommit(
  cs: TelegramCloudStorage,
  key: string,
  nextSlot: 0 | 1,
  prevMeta: ParsedChunkMeta | null,
  prevMetaRaw: string | null,
): Promise<void> {
  try {
    const toRemove = new Set<string>();
    const otherSlot: 0 | 1 = nextSlot === 0 ? 1 : 0;

    if (prevMeta?.kind === 'chunks') {
      if (prevMeta.slot === null || prevMeta.slot !== nextSlot) {
        for (const partKey of getChunkPartKeysForMeta(key, prevMeta)) {
          toRemove.add(partKey);
        }
      }
    } else if (prevMetaRaw !== null) {
      const allKeys = await csGetKeys(cs).catch(() => [] as string[]);
      for (const k of allKeys) {
        if (isLegacyChunkKeyForBase(k, key) || isSlottedChunkKeyForBase(k, key, otherSlot)) {
          toRemove.add(k);
        }
      }
    }

    if (toRemove.size > 0) {
      await csRemoveItems(cs, Array.from(toRemove));
    }
  } catch {
    // ignore post-commit cleanup failures; inactive slot is unreferenced
  }
}

export async function setCloudItem(key: string, value: string): Promise<void> {
  safeLocalSet(key, value);

  const cs = getSupportedCloudStorage(getTelegramWebApp());
  if (!cs) return;

  try {
    const byteLength = encoder.encode(value).length;
    if (byteLength <= CLOUD_CHUNK_BYTE_LIMIT) {
      await csSetItem(cs, key, value);
      await cleanupChunksAfterSmallWrite(cs, key);
      return;
    }

    const chunks = splitUtf8ByByteLimit(value, CLOUD_CHUNK_BYTE_LIMIT);
    if (chunks.length > MAX_CLOUD_CHUNKS) {
      return;
    }

    if (
      chunkMetaKey(key).length > MAX_CLOUD_KEY_LENGTH ||
      slottedChunkPartKey(key, 0, chunks.length - 1).length > MAX_CLOUD_KEY_LENGTH
    ) {
      return;
    }

    // Read current chunk metadata; abort before mutating any slot if metadata lookup fails.
    const prevMetaRaw = await csGetItem(cs, chunkMetaKey(key));
    const prevMeta = parseChunkMeta(prevMetaRaw);
    const nextSlot: 0 | 1 = prevMeta?.kind === 'chunks' && prevMeta.slot === 0 ? 1 : 0;

    // 1. Write all chunks into the inactive slot first (leaving live slot + __chunks intact on error).
    for (let idx = 0; idx < chunks.length; idx += 1) {
      await csSetItem(cs, slottedChunkPartKey(key, nextSlot, idx), chunks[idx]);
    }

    // 2. Atomically flip __chunks metadata to the newly written slot and count.
    await csSetItem(
      cs,
      chunkMetaKey(key),
      JSON.stringify({ v: 2, slot: nextSlot, count: chunks.length }),
    );

    // 3. Best-effort cleanup of old slot / legacy chunks and any stale unchunked base key.
    await cleanupOldChunksAfterCommit(cs, key, nextSlot, prevMeta, prevMetaRaw);
    await csRemoveItem(cs, key).catch(() => undefined);
  } catch {
    // fallback already saved in localStorage; CloudStorage live slot remains intact
  }
}

export async function getCloudItem(key: string): Promise<string | null> {
  const cs = getSupportedCloudStorage(getTelegramWebApp());
  if (!cs) {
    return safeLocalGet(key);
  }

  try {
    const metaRaw = await csGetItem(cs, chunkMetaKey(key));
    if (metaRaw) {
      const meta = parseChunkMeta(metaRaw);
      if (meta === null) {
        return safeLocalGet(key);
      }

      if (meta.kind === 'chunks') {
        const partKeys = getChunkPartKeysForMeta(key, meta);
        const values = await csGetItems(cs, partKeys);
        const parts: string[] = [];
        let valid = true;
        for (const partKey of partKeys) {
          if (typeof values[partKey] !== 'string') {
            valid = false;
            break;
          }
          parts.push(values[partKey]);
        }
        if (valid) {
          const joined = parts.join('');
          safeLocalSet(key, joined);
          return joined;
        }
        return safeLocalGet(key);
      }
      // meta.kind === 'inline': fall through to read base `key`
    }

    const direct = await csGetItem(cs, key);
    if (typeof direct === 'string') {
      safeLocalSet(key, direct);
      return direct;
    }
    return safeLocalGet(key);
  } catch {
    return safeLocalGet(key);
  }
}

export async function removeCloudItem(key: string): Promise<void> {
  safeLocalRemove(key);

  const cs = getSupportedCloudStorage(getTelegramWebApp());
  if (!cs) return;

  try {
    const keysToRemove = new Set<string>([key, chunkMetaKey(key)]);
    const metaRaw = await csGetItem(cs, chunkMetaKey(key)).catch(() => null);
    const meta = parseChunkMeta(metaRaw);
    if (meta?.kind === 'chunks') {
      for (const partKey of getChunkPartKeysForMeta(key, meta)) {
        keysToRemove.add(partKey);
      }
    }

    const allKeys = await csGetKeys(cs).catch(() => [] as string[]);
    for (const k of allKeys) {
      if (isLegacyChunkKeyForBase(k, key) || isSlottedChunkKeyForBase(k, key)) {
        keysToRemove.add(k);
      }
    }

    await csRemoveItems(cs, Array.from(keysToRemove));
  } catch {
    // ignore CloudStorage removal failures
  }
}

export async function getCloudKeys(): Promise<string[]> {
  const cs = getSupportedCloudStorage(getTelegramWebApp());
  if (!cs) {
    if (typeof localStorage === 'undefined') return [];
    return normalizeCloudKeys(Object.keys(localStorage));
  }

  try {
    const keys = await csGetKeys(cs);
    return normalizeCloudKeys(keys);
  } catch {
    if (typeof localStorage === 'undefined') return [];
    return normalizeCloudKeys(Object.keys(localStorage));
  }
}

export function _resetTelegramAdaptersForTest(): void {
  const tg = getTelegramWebApp();
  if (tg?.BackButton && backClickAttached) {
    try {
      tg.BackButton.offClick(dispatchBackClick);
    } catch {
      // ignore
    }
  }
  backStack.length = 0;
  backClickAttached = false;

  if (tg?.MainButton && activeMainButtonHandler) {
    try {
      tg.MainButton.offClick(activeMainButtonHandler);
    } catch {
      // ignore
    }
  }
  activeMainButtonHandler = null;
  sdkEventsBound = false;
  hapticConfig.enabled = true;
  hapticConfig.strength = 0.6;
}
