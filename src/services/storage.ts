import type {
  AcademicSubjectProgress,
  AnnouncementItem,
  AuthMode,
  AuthSessionState,
  BsuirEmployee,
  BsuirRatingResponse,
  BsuirScheduleResponse,
  BsuirStudentGroup,
  CertificateDto,
  CertificatePlaceGroup,
  CuratorDto,
  DeanNotification,
  DormitoryApplicationDto,
  DormitoryPrivilegeDto,
  GroupInfoResponse,
  GroupRatingEntry,
  GroupStudentDto,
  HeadmanDataResponse,
  HeadmanStudent,
  HeadmanSubject,
  Lesson,
  MarkSheetDto,
  MarkSheetSubjectDto,
  MarkbookResponse,
  NetworkPrefs,
  Note,
  NoteAttachment,
  OmissionsSummary,
  PenaltyDirectiveDto,
  PersonalCvDto,
  SchedulePrefs,
  ScheduleTargetKind,
  SearchHistoryEntry,
  UserProfileSummary,
} from '../types';
import { getCloudItem, setCloudItem } from './telegram';

// ==================== Storage Keys ====================

export const CLOUD_KEY_NOTES = 'bsuir_notes_v1';
export const CLOUD_KEY_SEARCH_HISTORY = 'bsuir_search_history_v1';
export const CLOUD_KEY_SCHEDULE_PREFS = 'bsuir_schedule_prefs_v1';
export const CLOUD_KEY_AUTH_SESSION = 'bsuir_auth_session_v1';
export const CLOUD_KEY_NETWORK_PREFS = 'bsuir_network_prefs_v1';

export const CACHE_KEY_GROUPS = 'bsuir_cache_groups_v1';
export const CACHE_KEY_EMPLOYEES = 'bsuir_cache_employees_v1';
export const CACHE_KEY_SCHEDULE_PREFIX = 'bsuir_cache_schedule_v1_';
export const CACHE_KEY_CURRENT_WEEK = 'bsuir_cache_current_week_v1';
export const CACHE_KEY_ANNOUNCEMENTS = 'bsuir_cache_announcements_v1';

export const CACHE_KEY_PROFILE = 'bsuir_cache_profile_v1';
export const CACHE_KEY_IIS_RATING = 'bsuir_cache_iis_rating_v1';
export const CACHE_KEY_IIS_MARKBOOK = 'bsuir_cache_iis_markbook_v1';
export const CACHE_KEY_IIS_GROUP_RATING = 'bsuir_cache_iis_group_rating_v1';
export const CACHE_KEY_IIS_OMISSIONS = 'bsuir_cache_iis_omissions_v1';
export const CACHE_KEY_IIS_GROUP_INFO = 'bsuir_cache_iis_group_info_v1';
export const CACHE_KEY_IIS_NOTIFICATIONS = 'bsuir_cache_iis_notifications_v1';
export const CACHE_KEY_IIS_CERTIFICATES = 'bsuir_cache_iis_certificates_v1';
export const CACHE_KEY_IIS_CERT_PLACES = 'bsuir_cache_iis_cert_places_v1';
export const CACHE_KEY_IIS_MARKSHEETS = 'bsuir_cache_iis_marksheets_v1';
export const CACHE_KEY_IIS_MS_SUBJECTS = 'bsuir_cache_iis_ms_subjects_v1';
export const CACHE_KEY_IIS_DORMITORY = 'bsuir_cache_iis_dormitory_v1';
export const CACHE_KEY_IIS_PRIVILEGES = 'bsuir_cache_iis_privileges_v1';
export const CACHE_KEY_IIS_PENALTIES = 'bsuir_cache_iis_penalties_v1';
export const CACHE_KEY_IIS_PERSONAL_CV = 'bsuir_cache_iis_personal_cv_v1';
export const CACHE_KEY_IIS_HEADMAN = 'bsuir_cache_iis_headman_v1';
export const CACHE_KEY_CUSTOM_AVATAR = 'bsuir_custom_avatar_v1';

export const NOTE_ATTACHMENT_LOCAL_PREFIX = 'bsuir_note_att_';
const LOCAL_POINTER_PREFIX = 'local://';
export const INLINE_ATTACHMENT_OFFLOAD_THRESHOLD = 16_384;
export const MAX_SEARCH_HISTORY = 5;
export const DEFAULT_GROUP_NUMBER = '310101';

export const PRIVATE_IIS_CACHE_KEYS = [
  CACHE_KEY_PROFILE,
  CACHE_KEY_IIS_RATING,
  CACHE_KEY_IIS_MARKBOOK,
  CACHE_KEY_IIS_GROUP_RATING,
  CACHE_KEY_IIS_OMISSIONS,
  CACHE_KEY_IIS_GROUP_INFO,
  CACHE_KEY_IIS_NOTIFICATIONS,
  CACHE_KEY_IIS_CERTIFICATES,
  CACHE_KEY_IIS_CERT_PLACES,
  CACHE_KEY_IIS_MARKSHEETS,
  CACHE_KEY_IIS_MS_SUBJECTS,
  CACHE_KEY_IIS_DORMITORY,
  CACHE_KEY_IIS_PRIVILEGES,
  CACHE_KEY_IIS_PENALTIES,
  CACHE_KEY_IIS_PERSONAL_CV,
  CACHE_KEY_IIS_HEADMAN,
  CACHE_KEY_CUSTOM_AVATAR,
] as const;

// ==================== Cache Payload Shapes ====================

export interface CachedScheduleEntry {
  updatedAt: number;
  response: BsuirScheduleResponse;
  lessons: Lesson[];
  exams: Lesson[];
  startExamsDate: string;
  endExamsDate: string;
}

export interface CachedRatingEntry {
  subjects: AcademicSubjectProgress[];
  raw?: BsuirRatingResponse;
  rating?: number | null;
  place?: number | null;
}

export interface CachedGroupInfoEntry {
  curator: CuratorDto | null;
  students: GroupStudentDto[];
  raw?: GroupInfoResponse;
}

export interface CachedHeadmanEntry {
  subjects: HeadmanSubject[];
  students: HeadmanStudent[];
  dataByTermHoursId: Record<number, HeadmanDataResponse>;
}

// ==================== Safe localStorage Helpers ====================

export function readLocalRaw(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalRaw(key: string, value: string): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeLocalKey(key: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

export function readLocalJson<T>(key: string): T | null {
  const raw = readLocalRaw(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeLocalJson<T>(key: string, value: T): boolean {
  try {
    return writeLocalRaw(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

function generateId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ==================== Sanitization & Normalization ====================

export function sanitizeGroupNumber(
  group?: string | null,
  fallback = DEFAULT_GROUP_NUMBER,
): string {
  const trimmed = (group ?? '').trim();
  if (!trimmed || trimmed === '114001') {
    return fallback;
  }
  return trimmed;
}

function defaultSchedulePrefs(): SchedulePrefs {
  return {
    selectedGroup: DEFAULT_GROUP_NUMBER,
    selectedEmployee: null,
    subgroup: 0,
    dateRailVisible: true,
  };
}

function normalizeSchedulePrefs(raw: unknown): SchedulePrefs {
  const defaults = defaultSchedulePrefs();
  if (!raw || typeof raw !== 'object') return defaults;
  const obj = raw as Record<string, unknown>;

  const selectedGroup = sanitizeGroupNumber(
    typeof obj.selectedGroup === 'string' ? obj.selectedGroup : null,
    DEFAULT_GROUP_NUMBER,
  );

  let selectedEmployee: { urlId: string; fullName: string } | null = null;
  if (obj.selectedEmployee && typeof obj.selectedEmployee === 'object') {
    const emp = obj.selectedEmployee as Record<string, unknown>;
    const urlId = typeof emp.urlId === 'string' ? emp.urlId.trim() : '';
    const fullName = typeof emp.fullName === 'string' ? emp.fullName.trim() : '';
    if (urlId) {
      selectedEmployee = { urlId, fullName: fullName || urlId };
    }
  }

  const subgroupRaw = obj.subgroup;
  const subgroup: 0 | 1 | 2 =
    subgroupRaw === 1 || subgroupRaw === 2 ? subgroupRaw : 0;

  const dateRailVisible =
    typeof obj.dateRailVisible === 'boolean' ? obj.dateRailVisible : true;

  return {
    selectedGroup,
    selectedEmployee,
    subgroup,
    dateRailVisible,
  };
}

function defaultAuthSessionState(): AuthSessionState {
  return {
    authMode: 'logged_out',
    username: null,
    loginGroup: null,
  };
}

function normalizeAuthSessionState(raw: unknown): AuthSessionState {
  const defaults = defaultAuthSessionState();
  if (!raw || typeof raw !== 'object') return defaults;
  const obj = raw as Record<string, unknown>;

  const validModes: AuthMode[] = ['authenticated', 'guest', 'logged_out'];
  const authMode: AuthMode =
    typeof obj.authMode === 'string' && validModes.includes(obj.authMode as AuthMode)
      ? (obj.authMode as AuthMode)
      : 'logged_out';

  const username =
    typeof obj.username === 'string' && obj.username.trim() ? obj.username.trim() : null;
  const loginGroup =
    typeof obj.loginGroup === 'string' && obj.loginGroup.trim()
      ? sanitizeGroupNumber(obj.loginGroup, DEFAULT_GROUP_NUMBER)
      : null;

  return {
    authMode,
    username,
    loginGroup,
  };
}

function defaultNetworkPrefs(): NetworkPrefs {
  const envUrl =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.VITE_API_BASE_URL === 'string'
      ? import.meta.env.VITE_API_BASE_URL.trim()
      : '';
  return {
    apiBaseUrl: envUrl || '/api/v1',
    forceOffline: false,
  };
}

function normalizeNetworkPrefs(raw: unknown): NetworkPrefs {
  const defaults = defaultNetworkPrefs();
  if (!raw || typeof raw !== 'object') return defaults;
  const obj = raw as Record<string, unknown>;
  const apiBaseUrl =
    typeof obj.apiBaseUrl === 'string' && obj.apiBaseUrl.trim()
      ? obj.apiBaseUrl.trim().replace(/\/+$/, '')
      : defaults.apiBaseUrl;
  const forceOffline =
    typeof obj.forceOffline === 'boolean' ? obj.forceOffline : defaults.forceOffline;
  return { apiBaseUrl, forceOffline };
}

function normalizeSearchHistory(raw: unknown): SearchHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const result: SearchHistoryEntry[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    let entry: SearchHistoryEntry | null = null;
    if (typeof item === 'string') {
      const id = item.trim();
      if (id) {
        entry = { id, label: id, kind: 'group' };
      }
    } else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const id = typeof obj.id === 'string' ? obj.id.trim() : '';
      const label = typeof obj.label === 'string' ? obj.label.trim() : id;
      const kind: ScheduleTargetKind =
        obj.kind === 'employee' ? 'employee' : 'group';
      const subtitle =
        typeof obj.subtitle === 'string' && obj.subtitle.trim()
          ? obj.subtitle.trim()
          : undefined;
      if (id) {
        entry = { id, label: label || id, kind, ...(subtitle ? { subtitle } : {}) };
      }
    }

    if (entry) {
      const dedupeKey = `${entry.kind}:${entry.id.toLowerCase()}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        result.push(entry);
      }
    }
    if (result.length >= MAX_SEARCH_HISTORY) break;
  }

  return result;
}

function resolveAttachmentUri(att: NoteAttachment): NoteAttachment {
  if (att.uri.startsWith(LOCAL_POINTER_PREFIX)) {
    const localKey = att.uri.slice(LOCAL_POINTER_PREFIX.length);
    const localUri = readLocalRaw(localKey);
    if (localUri !== null) {
      return { ...att, uri: localUri };
    }
  }
  return att;
}

function offloadAttachmentForCloud(att: NoteAttachment): {
  cloudAttachment: NoteAttachment;
  localKeyUsed: string | null;
} {
  if (
    att.uri.startsWith('data:') &&
    att.uri.length > INLINE_ATTACHMENT_OFFLOAD_THRESHOLD
  ) {
    const safeId = att.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const localKey = `${NOTE_ATTACHMENT_LOCAL_PREFIX}${safeId}`;
    writeLocalRaw(localKey, att.uri);
    return {
      cloudAttachment: { ...att, uri: `${LOCAL_POINTER_PREFIX}${localKey}` },
      localKeyUsed: localKey,
    };
  }
  return { cloudAttachment: att, localKeyUsed: null };
}

function cleanupOrphanedAttachmentKeys(activeLocalKeys: Set<string>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(NOTE_ATTACHMENT_LOCAL_PREFIX) && !activeLocalKeys.has(key)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore cleanup failures
  }
}

function normalizeNotes(raw: unknown, resolveAttachments = true): Note[] {
  if (!Array.isArray(raw)) return [];
  const notes: Note[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : generateId('note');
    const subject = typeof obj.subject === 'string' ? obj.subject : '';
    const text = typeof obj.text === 'string' ? obj.text : '';
    const date = typeof obj.date === 'string' ? obj.date : '';
    const time = typeof obj.time === 'string' ? obj.time : null;
    const isEvent = Boolean(obj.isEvent);
    const isPinned = Boolean(obj.isPinned);
    const lessonType = typeof obj.lessonType === 'string' ? obj.lessonType : '';
    const calendarEventId =
      typeof obj.calendarEventId === 'number' ? obj.calendarEventId : null;

    const rawAttachments = Array.isArray(obj.attachments) ? obj.attachments : [];
    const attachments: NoteAttachment[] = [];
    for (const rawAtt of rawAttachments) {
      if (!rawAtt || typeof rawAtt !== 'object') continue;
      const a = rawAtt as Record<string, unknown>;
      const attId =
        typeof a.id === 'string' && a.id.trim() ? a.id.trim() : generateId('att');
      const attObj: NoteAttachment = {
        id: attId,
        uri: typeof a.uri === 'string' ? a.uri : '',
        name: typeof a.name === 'string' ? a.name : 'file',
        mimeType: typeof a.mimeType === 'string' ? a.mimeType : 'application/octet-stream',
        sizeBytes: typeof a.sizeBytes === 'number' && Number.isFinite(a.sizeBytes) ? a.sizeBytes : 0,
      };
      attachments.push(resolveAttachments ? resolveAttachmentUri(attObj) : attObj);
    }

    notes.push({
      id,
      subject,
      text,
      date,
      time,
      isEvent,
      isPinned,
      lessonType,
      attachments,
      calendarEventId,
    });
  }

  return notes;
}

// ==================== Per-Key Async RMW Queue ====================

const storageLocks = new Map<string, Promise<unknown>>();

export function withStorageLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = storageLocks.get(key) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  const tail = next.then(
    () => undefined,
    () => undefined,
  );
  storageLocks.set(key, tail);
  void tail.then(() => {
    if (storageLocks.get(key) === tail) {
      storageLocks.delete(key);
    }
  });
  return next;
}

// ==================== Notes CRUD (CloudStorage + Attachment Offload) ====================

export function loadNotesSync(): Note[] {
  const parsed = readLocalJson<unknown>(CLOUD_KEY_NOTES);
  return normalizeNotes(parsed, true);
}

export async function loadNotes(): Promise<Note[]> {
  const raw = await getCloudItem(CLOUD_KEY_NOTES);
  if (!raw) return [];
  try {
    return normalizeNotes(JSON.parse(raw), true);
  } catch {
    return [];
  }
}

async function saveNotesUnlocked(notes: Note[]): Promise<Note[]> {
  const normalized = normalizeNotes(notes, false);
  const activeLocalKeys = new Set<string>();
  const resolvedNotes: Note[] = [];

  const cloudNotes: Note[] = normalized.map((note) => {
    const resolvedAtts: NoteAttachment[] = [];
    const cloudAtts: NoteAttachment[] = note.attachments.map((att) => {
      // If caller passes an already-offloaded local:// pointer, resolve for return & retain local key
      if (att.uri.startsWith(LOCAL_POINTER_PREFIX)) {
        const localKey = att.uri.slice(LOCAL_POINTER_PREFIX.length);
        activeLocalKeys.add(localKey);
        resolvedAtts.push(resolveAttachmentUri(att));
        return att;
      }
      const { cloudAttachment, localKeyUsed } = offloadAttachmentForCloud(att);
      if (localKeyUsed) {
        activeLocalKeys.add(localKeyUsed);
      }
      resolvedAtts.push(att);
      return cloudAttachment;
    });

    resolvedNotes.push({ ...note, attachments: resolvedAtts });
    return { ...note, attachments: cloudAtts };
  });

  cleanupOrphanedAttachmentKeys(activeLocalKeys);
  await setCloudItem(CLOUD_KEY_NOTES, JSON.stringify(cloudNotes));
  return resolvedNotes;
}

export async function saveNotes(notes: Note[]): Promise<Note[]> {
  return withStorageLock(CLOUD_KEY_NOTES, () => saveNotesUnlocked(notes));
}

export async function addNote(
  input: Omit<Note, 'id'> & { id?: string },
): Promise<Note[]> {
  return withStorageLock(CLOUD_KEY_NOTES, async () => {
    const current = await loadNotes();
    const newNote: Note = {
      ...input,
      id: input.id?.trim() || generateId('note'),
      attachments: Array.isArray(input.attachments) ? input.attachments : [],
    };
    return saveNotesUnlocked([...current, newNote]);
  });
}

export async function updateNote(
  id: string,
  patch: Partial<Omit<Note, 'id'>>,
): Promise<Note[]> {
  return withStorageLock(CLOUD_KEY_NOTES, async () => {
    const current = await loadNotes();
    const updated = current.map((n) => (n.id === id ? { ...n, ...patch, id: n.id } : n));
    return saveNotesUnlocked(updated);
  });
}

export async function deleteNote(id: string): Promise<Note[]> {
  return withStorageLock(CLOUD_KEY_NOTES, async () => {
    const current = await loadNotes();
    const filtered = current.filter((n) => n.id !== id);
    return saveNotesUnlocked(filtered);
  });
}

export async function togglePinNote(id: string): Promise<Note[]> {
  return withStorageLock(CLOUD_KEY_NOTES, async () => {
    const current = await loadNotes();
    const updated = current.map((n) =>
      n.id === id ? { ...n, isPinned: !n.isPinned } : n,
    );
    return saveNotesUnlocked(updated);
  });
}

// ==================== Search History (CloudStorage, Max 5 MRU) ====================

export function loadSearchHistorySync(): SearchHistoryEntry[] {
  return normalizeSearchHistory(readLocalJson<unknown>(CLOUD_KEY_SEARCH_HISTORY));
}

export async function loadSearchHistory(): Promise<SearchHistoryEntry[]> {
  const raw = await getCloudItem(CLOUD_KEY_SEARCH_HISTORY);
  if (!raw) return [];
  try {
    return normalizeSearchHistory(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function addSearchHistory(
  entry: SearchHistoryEntry,
): Promise<SearchHistoryEntry[]> {
  return withStorageLock(CLOUD_KEY_SEARCH_HISTORY, async () => {
    const cleanId = entry.id.trim();
    if (!cleanId) return loadSearchHistory();

    const current = await loadSearchHistory();
    const normalizedEntry: SearchHistoryEntry = {
      id: cleanId,
      label: entry.label.trim() || cleanId,
      kind: entry.kind === 'employee' ? 'employee' : 'group',
      ...(entry.subtitle?.trim() ? { subtitle: entry.subtitle.trim() } : {}),
    };

    const next = [
      normalizedEntry,
      ...current.filter(
        (item) =>
          !(
            item.kind === normalizedEntry.kind &&
            item.id.toLowerCase() === normalizedEntry.id.toLowerCase()
          ),
      ),
    ].slice(0, MAX_SEARCH_HISTORY);

    await setCloudItem(CLOUD_KEY_SEARCH_HISTORY, JSON.stringify(next));
    return next;
  });
}

export async function removeSearchHistoryItem(
  id: string,
  kind?: ScheduleTargetKind,
): Promise<SearchHistoryEntry[]> {
  return withStorageLock(CLOUD_KEY_SEARCH_HISTORY, async () => {
    const current = await loadSearchHistory();
    const targetLower = id.trim().toLowerCase();
    const next = current.filter((item) => {
      if (kind && item.kind !== kind) return true;
      return item.id.toLowerCase() !== targetLower;
    });
    await setCloudItem(CLOUD_KEY_SEARCH_HISTORY, JSON.stringify(next));
    return next;
  });
}

export async function clearSearchHistory(): Promise<SearchHistoryEntry[]> {
  return withStorageLock(CLOUD_KEY_SEARCH_HISTORY, async () => {
    await setCloudItem(CLOUD_KEY_SEARCH_HISTORY, JSON.stringify([]));
    return [];
  });
}

// ==================== Schedule Prefs (CloudStorage) ====================

export function loadSchedulePrefsSync(): SchedulePrefs {
  return normalizeSchedulePrefs(readLocalJson<unknown>(CLOUD_KEY_SCHEDULE_PREFS));
}

export async function loadSchedulePrefs(): Promise<SchedulePrefs> {
  const raw = await getCloudItem(CLOUD_KEY_SCHEDULE_PREFS);
  if (!raw) return defaultSchedulePrefs();
  try {
    return normalizeSchedulePrefs(JSON.parse(raw));
  } catch {
    return defaultSchedulePrefs();
  }
}

export async function saveSchedulePrefs(
  partial: Partial<SchedulePrefs>,
): Promise<SchedulePrefs> {
  return withStorageLock(CLOUD_KEY_SCHEDULE_PREFS, async () => {
    const current = await loadSchedulePrefs();
    const merged = normalizeSchedulePrefs({ ...current, ...partial });
    await setCloudItem(CLOUD_KEY_SCHEDULE_PREFS, JSON.stringify(merged));
    return merged;
  });
}

export async function saveSelectedGroup(group: string): Promise<SchedulePrefs> {
  return saveSchedulePrefs({
    selectedGroup: sanitizeGroupNumber(group, DEFAULT_GROUP_NUMBER),
    selectedEmployee: null,
  });
}

export async function saveSelectedEmployee(
  employee: { urlId: string; fullName: string } | null,
): Promise<SchedulePrefs> {
  return saveSchedulePrefs({ selectedEmployee: employee });
}

export async function saveSubgroup(subgroup: 0 | 1 | 2): Promise<SchedulePrefs> {
  return saveSchedulePrefs({ subgroup });
}

export async function saveDateRailVisible(visible: boolean): Promise<SchedulePrefs> {
  return saveSchedulePrefs({ dateRailVisible: visible });
}

// ==================== Auth Session & Network Prefs (CloudStorage) ====================

export function loadAuthSessionSync(): AuthSessionState {
  return normalizeAuthSessionState(readLocalJson<unknown>(CLOUD_KEY_AUTH_SESSION));
}

export async function loadAuthSession(): Promise<AuthSessionState> {
  const raw = await getCloudItem(CLOUD_KEY_AUTH_SESSION);
  if (!raw) return defaultAuthSessionState();
  try {
    return normalizeAuthSessionState(JSON.parse(raw));
  } catch {
    return defaultAuthSessionState();
  }
}

export async function saveAuthSession(
  partial: Partial<AuthSessionState>,
): Promise<AuthSessionState> {
  return withStorageLock(CLOUD_KEY_AUTH_SESSION, async () => {
    const current = await loadAuthSession();
    const next = normalizeAuthSessionState({ ...current, ...partial });
    await setCloudItem(CLOUD_KEY_AUTH_SESSION, JSON.stringify(next));
    return next;
  });
}

export function loadNetworkPrefsSync(): NetworkPrefs {
  return normalizeNetworkPrefs(readLocalJson<unknown>(CLOUD_KEY_NETWORK_PREFS));
}

export async function loadNetworkPrefs(): Promise<NetworkPrefs> {
  const raw = await getCloudItem(CLOUD_KEY_NETWORK_PREFS);
  if (!raw) return defaultNetworkPrefs();
  try {
    return normalizeNetworkPrefs(JSON.parse(raw));
  } catch {
    return defaultNetworkPrefs();
  }
}

export async function saveNetworkPrefs(
  partial: Partial<NetworkPrefs>,
): Promise<NetworkPrefs> {
  return withStorageLock(CLOUD_KEY_NETWORK_PREFS, async () => {
    const current = await loadNetworkPrefs();
    const next = normalizeNetworkPrefs({ ...current, ...partial });
    await setCloudItem(CLOUD_KEY_NETWORK_PREFS, JSON.stringify(next));
    return next;
  });
}

// ==================== localStorage Public & Private Caches ====================

function sanitizeTargetKey(target: string): string {
  return target.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function getCachedSchedule(target: string): CachedScheduleEntry | null {
  const clean = sanitizeTargetKey(target);
  if (!clean) return null;
  return readLocalJson<CachedScheduleEntry>(`${CACHE_KEY_SCHEDULE_PREFIX}${clean}`);
}

export function setCachedSchedule(
  target: string,
  entry: CachedScheduleEntry,
): boolean {
  const clean = sanitizeTargetKey(target);
  if (!clean) return false;
  return writeLocalJson(`${CACHE_KEY_SCHEDULE_PREFIX}${clean}`, entry);
}

export function getCachedStudentGroups(): BsuirStudentGroup[] | null {
  const cached = readLocalJson<{ updatedAt: number; data: BsuirStudentGroup[] }>(
    CACHE_KEY_GROUPS,
  );
  return Array.isArray(cached?.data) ? cached.data : null;
}

export function setCachedStudentGroups(data: BsuirStudentGroup[]): boolean {
  return writeLocalJson(CACHE_KEY_GROUPS, { updatedAt: Date.now(), data });
}

export function getCachedEmployees(): BsuirEmployee[] | null {
  const cached = readLocalJson<{ updatedAt: number; data: BsuirEmployee[] }>(
    CACHE_KEY_EMPLOYEES,
  );
  return Array.isArray(cached?.data) ? cached.data : null;
}

export function setCachedEmployees(data: BsuirEmployee[]): boolean {
  return writeLocalJson(CACHE_KEY_EMPLOYEES, { updatedAt: Date.now(), data });
}

export function getCachedCurrentWeek(): number | null {
  const cached = readLocalJson<{ updatedAt: number; week: number }>(
    CACHE_KEY_CURRENT_WEEK,
  );
  return typeof cached?.week === 'number' && cached.week >= 1 && cached.week <= 4
    ? cached.week
    : null;
}

export function setCachedCurrentWeek(week: number): boolean {
  return writeLocalJson(CACHE_KEY_CURRENT_WEEK, { updatedAt: Date.now(), week });
}

export function getCachedAnnouncements(): AnnouncementItem[] | null {
  const cached = readLocalJson<{ updatedAt: number; data: AnnouncementItem[] }>(
    CACHE_KEY_ANNOUNCEMENTS,
  );
  return Array.isArray(cached?.data) ? cached.data : null;
}

export function setCachedAnnouncements(data: AnnouncementItem[]): boolean {
  return writeLocalJson(CACHE_KEY_ANNOUNCEMENTS, { updatedAt: Date.now(), data });
}

export function getCachedProfile(): UserProfileSummary | null {
  return readLocalJson<UserProfileSummary>(CACHE_KEY_PROFILE);
}

export function setCachedProfile(profile: UserProfileSummary): boolean {
  return writeLocalJson(CACHE_KEY_PROFILE, profile);
}

export function getCustomAvatar(): string | null {
  return readLocalRaw(CACHE_KEY_CUSTOM_AVATAR);
}

export function setCustomAvatar(dataUrl: string | null): void {
  if (!dataUrl) {
    removeLocalKey(CACHE_KEY_CUSTOM_AVATAR);
    return;
  }
  writeLocalRaw(CACHE_KEY_CUSTOM_AVATAR, dataUrl);
}

export function getIisCache<T>(key: string): T | null {
  return readLocalJson<T>(key);
}

export function setIisCache<T>(key: string, value: T): boolean {
  return writeLocalJson(key, value);
}

// Specific typed aliases matching all private IIS caches
export const getCachedRating = (): CachedRatingEntry | null =>
  getIisCache<CachedRatingEntry>(CACHE_KEY_IIS_RATING);
export const setCachedRating = (v: CachedRatingEntry): boolean =>
  setIisCache(CACHE_KEY_IIS_RATING, v);

export const getCachedMarkbook = (): MarkbookResponse | null =>
  getIisCache<MarkbookResponse>(CACHE_KEY_IIS_MARKBOOK);
export const setCachedMarkbook = (v: MarkbookResponse): boolean =>
  setIisCache(CACHE_KEY_IIS_MARKBOOK, v);

export const getCachedGroupRating = (): GroupRatingEntry[] | null =>
  getIisCache<GroupRatingEntry[]>(CACHE_KEY_IIS_GROUP_RATING);
export const setCachedGroupRating = (v: GroupRatingEntry[]): boolean =>
  setIisCache(CACHE_KEY_IIS_GROUP_RATING, v);

export const getCachedOmissions = (): OmissionsSummary | null =>
  getIisCache<OmissionsSummary>(CACHE_KEY_IIS_OMISSIONS);
export const setCachedOmissions = (v: OmissionsSummary): boolean =>
  setIisCache(CACHE_KEY_IIS_OMISSIONS, v);

export const getCachedGroupInfo = (): CachedGroupInfoEntry | null =>
  getIisCache<CachedGroupInfoEntry>(CACHE_KEY_IIS_GROUP_INFO);
export const setCachedGroupInfo = (v: CachedGroupInfoEntry): boolean =>
  setIisCache(CACHE_KEY_IIS_GROUP_INFO, v);

export const getCachedNotifications = (): DeanNotification[] | null =>
  getIisCache<DeanNotification[]>(CACHE_KEY_IIS_NOTIFICATIONS);
export const setCachedNotifications = (v: DeanNotification[]): boolean =>
  setIisCache(CACHE_KEY_IIS_NOTIFICATIONS, v);

export const getCachedCertificates = (): CertificateDto[] | null =>
  getIisCache<CertificateDto[]>(CACHE_KEY_IIS_CERTIFICATES);
export const setCachedCertificates = (v: CertificateDto[]): boolean =>
  setIisCache(CACHE_KEY_IIS_CERTIFICATES, v);

export const getCachedCertificatePlaces = (): CertificatePlaceGroup[] | null =>
  getIisCache<CertificatePlaceGroup[]>(CACHE_KEY_IIS_CERT_PLACES);
export const setCachedCertificatePlaces = (v: CertificatePlaceGroup[]): boolean =>
  setIisCache(CACHE_KEY_IIS_CERT_PLACES, v);

export const getCachedMarkSheets = (): MarkSheetDto[] | null =>
  getIisCache<MarkSheetDto[]>(CACHE_KEY_IIS_MARKSHEETS);
export const setCachedMarkSheets = (v: MarkSheetDto[]): boolean =>
  setIisCache(CACHE_KEY_IIS_MARKSHEETS, v);

export const getCachedMarkSheetSubjects = (): MarkSheetSubjectDto[] | null =>
  getIisCache<MarkSheetSubjectDto[]>(CACHE_KEY_IIS_MS_SUBJECTS);
export const setCachedMarkSheetSubjects = (v: MarkSheetSubjectDto[]): boolean =>
  setIisCache(CACHE_KEY_IIS_MS_SUBJECTS, v);

export const getCachedDormitoryApps = (): DormitoryApplicationDto[] | null =>
  getIisCache<DormitoryApplicationDto[]>(CACHE_KEY_IIS_DORMITORY);
export const setCachedDormitoryApps = (v: DormitoryApplicationDto[]): boolean =>
  setIisCache(CACHE_KEY_IIS_DORMITORY, v);

export const getCachedDormitoryPrivileges = (): DormitoryPrivilegeDto[] | null =>
  getIisCache<DormitoryPrivilegeDto[]>(CACHE_KEY_IIS_PRIVILEGES);
export const setCachedDormitoryPrivileges = (v: DormitoryPrivilegeDto[]): boolean =>
  setIisCache(CACHE_KEY_IIS_PRIVILEGES, v);

export const getCachedPenalties = (): PenaltyDirectiveDto[] | null =>
  getIisCache<PenaltyDirectiveDto[]>(CACHE_KEY_IIS_PENALTIES);
export const setCachedPenalties = (v: PenaltyDirectiveDto[]): boolean =>
  setIisCache(CACHE_KEY_IIS_PENALTIES, v);

export const getCachedPersonalCv = (): PersonalCvDto | null =>
  getIisCache<PersonalCvDto>(CACHE_KEY_IIS_PERSONAL_CV);
export const setCachedPersonalCv = (v: PersonalCvDto): boolean =>
  setIisCache(CACHE_KEY_IIS_PERSONAL_CV, v);

export const getCachedHeadman = (): CachedHeadmanEntry | null =>
  getIisCache<CachedHeadmanEntry>(CACHE_KEY_IIS_HEADMAN);
export const setCachedHeadman = (v: CachedHeadmanEntry): boolean =>
  setIisCache(CACHE_KEY_IIS_HEADMAN, v);

// ==================== Logout & Session Cache Isolation ====================

export function clearPrivateIisCaches(): void {
  for (const key of PRIVATE_IIS_CACHE_KEYS) {
    removeLocalKey(key);
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      const toRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i += 1) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('bsuir_')) {
          toRemove.push(key);
        }
      }
      for (const k of toRemove) {
        sessionStorage.removeItem(k);
      }
    }
  } catch {
    // ignore sessionStorage failures
  }
}

export async function logoutAndClearAuth(): Promise<void> {
  clearPrivateIisCaches();
  await saveAuthSession({
    authMode: 'logged_out',
    username: null,
    loginGroup: null,
  });
}

// ==================== Sync Snapshot & Async Hydration ====================

export interface StorageSyncSnapshot {
  authSession: AuthSessionState;
  schedulePrefs: SchedulePrefs;
  notes: Note[];
  searchHistory: SearchHistoryEntry[];
  networkPrefs: NetworkPrefs;
  profileCache: UserProfileSummary | null;
  customAvatar: string | null;
}

export function getStorageSyncSnapshot(): StorageSyncSnapshot {
  return {
    authSession: loadAuthSessionSync(),
    schedulePrefs: loadSchedulePrefsSync(),
    notes: loadNotesSync(),
    searchHistory: loadSearchHistorySync(),
    networkPrefs: loadNetworkPrefsSync(),
    profileCache: getCachedProfile(),
    customAvatar: getCustomAvatar(),
  };
}

export interface HydratedCloudState {
  authSession: AuthSessionState;
  schedulePrefs: SchedulePrefs;
  notes: Note[];
  searchHistory: SearchHistoryEntry[];
  networkPrefs: NetworkPrefs;
}

export async function hydrateCloudState(): Promise<HydratedCloudState> {
  const [notes, searchHistory, schedulePrefs, authSession, networkPrefs] =
    await Promise.all([
      loadNotes(),
      loadSearchHistory(),
      loadSchedulePrefs(),
      loadAuthSession(),
      loadNetworkPrefs(),
    ]);

  return {
    authSession,
    schedulePrefs,
    notes,
    searchHistory,
    networkPrefs,
  };
}
