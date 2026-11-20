import type {
  AcademicMarkInfo,
  AcademicSubjectProgress,
  AnnouncementItem,
  ApiResult,
  AuthSession,
  BsuirEmployee,
  BsuirRatingResponse,
  BsuirScheduleResponse,
  BsuirStudentGroup,
  CertificateDto,
  CertificatePlaceGroup,
  CertificateRegisterPayload,
  CuratorDto,
  CvReference,
  CvSkill,
  DeanNotification,
  DisrespectfulOmission,
  DormitoryApplicationDto,
  DormitoryPrivilegeDto,
  ExcuseDocument,
  GroupInfoNormalized,
  GroupRatingEntry,
  GroupStudentDto,
  HeadmanCreatePayload,
  HeadmanDataResponse,
  HeadmanJournalData,
  HeadmanStudent,
  HeadmanSubject,
  Lesson,
  LoginResult,
  MarkSheetCreatePayload,
  MarkSheetDto,
  MarkSheetSubjectDto,
  MarkbookParsedSemester,
  MarkbookResponse,
  OmissionLesson,
  OmissionsSummary,
  OrviOmissionPayload,
  OrviOmissionResult,
  PenaltyDirectiveDto,
  PersonalCvDto,
  ProfileCvSectionEndpoint,
} from '../types';
import { calculateMarkSheetCost } from '../utils/formatters';
import { getBsuirWeekInfo, parseScheduleResponse } from '../utils/scheduleMath';
import {
  MOCK_ANNOUNCEMENTS,
  MOCK_CERTIFICATE_PLACES,
  MOCK_DORMITORY_APPLICATIONS,
  MOCK_DORMITORY_PRIVILEGES,
  MOCK_EMPLOYEES,
  MOCK_GROUP_RATING,
  MOCK_MARK_SHEET_SUBJECTS,
  MOCK_MARKBOOK,
  MOCK_PENALTIES,
  MOCK_PERMANENT_ADDRESS,
  MOCK_RATING_RESPONSE,
  MOCK_STUDENT_GROUPS,
  getMockCertificates,
  getMockEmployeeSchedule,
  getMockGroupInfo,
  getMockGroupSchedule,
  getMockHeadmanJournal,
  getMockMarkSheets,
  getMockNotifications,
  getMockOmissions,
  getMockPersonalCv,
  mockCloseCertificate,
  mockCloseMarkSheet,
  mockCreateMarkSheet,
  mockCreateOrviOmission,
  mockLogin,
  mockLogout,
  mockMarkNotificationsRead,
  mockRegisterCertificate,
  mockSaveHeadmanAttendance,
  mockUpdateCvReferences,
  mockUpdateCvSection,
  mockUpdateCvSkills,
} from './mockData';
import {
  getCachedAnnouncements,
  getCachedCertificatePlaces,
  getCachedCertificates,
  getCachedCurrentWeek,
  getCachedDormitoryApps,
  getCachedDormitoryPrivileges,
  getCachedEmployees,
  getCachedGroupInfo,
  getCachedGroupRating,
  getCachedHeadman,
  getCachedMarkSheetSubjects,
  getCachedMarkSheets,
  getCachedMarkbook,
  getCachedNotifications,
  getCachedOmissions,
  getCachedPenalties,
  getCachedPersonalCv,
  getCachedRating,
  getCachedSchedule,
  getCachedStudentGroups,
  loadNetworkPrefsSync,
  readLocalRaw,
  removeLocalKey,
  sanitizeGroupNumber,
  setCachedAnnouncements,
  setCachedCertificatePlaces,
  setCachedCertificates,
  setCachedCurrentWeek,
  setCachedDormitoryApps,
  setCachedDormitoryPrivileges,
  setCachedEmployees,
  setCachedGroupInfo,
  setCachedGroupRating,
  setCachedHeadman,
  setCachedMarkSheetSubjects,
  setCachedMarkSheets,
  setCachedMarkbook,
  setCachedNotifications,
  setCachedOmissions,
  setCachedPenalties,
  setCachedPersonalCv,
  setCachedRating,
  setCachedSchedule,
  setCachedStudentGroups,
  writeLocalRaw,
} from './storage';

export const DEFAULT_TIMEOUT_MS = 4500;
export const API_BASE_URL_STORAGE_KEY = 'bsuir_api_base_url';
export const FORCE_OFFLINE_STORAGE_KEY = 'bsuir_force_offline';

type CredentialsProvider = () => { username: string; password: string } | null;

let reloginCredentialsProvider: CredentialsProvider | null = null;
let reloginPromise: Promise<boolean> | null = null;
let guestModeActive = false;

// ==================== Configuration & Mode Helpers ====================

export function getApiBaseUrl(): string {
  const override = readLocalRaw(API_BASE_URL_STORAGE_KEY)?.trim();
  if (override) {
    return override.replace(/\/+$/, '');
  }
  const prefsUrl = loadNetworkPrefsSync().apiBaseUrl.trim();
  if (prefsUrl) {
    return prefsUrl.replace(/\/+$/, '');
  }
  const envUrl =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.VITE_API_BASE_URL === 'string'
      ? import.meta.env.VITE_API_BASE_URL.trim()
      : '';
  return (envUrl || '/api/v1').replace(/\/+$/, '');
}

export function configureApiBaseUrl(url: string): void {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) {
    removeLocalKey(API_BASE_URL_STORAGE_KEY);
    return;
  }
  writeLocalRaw(API_BASE_URL_STORAGE_KEY, trimmed);
}

export function isOfflineMode(): boolean {
  const rawForce = readLocalRaw(FORCE_OFFLINE_STORAGE_KEY);
  const forced =
    rawForce !== null
      ? rawForce === 'true'
      : loadNetworkPrefsSync().forceOffline;
  if (forced) return true;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  return false;
}

export function setForceOfflineMode(force: boolean): void {
  writeLocalRaw(FORCE_OFFLINE_STORAGE_KEY, force ? 'true' : 'false');
}

export function setGuestModeHint(isGuest: boolean): void {
  guestModeActive = isGuest;
}

export function setReloginCredentialsProvider(provider: CredentialsProvider | null): void {
  reloginCredentialsProvider = provider;
}

export function getIcalScheduleUrl(): string {
  return `${getApiBaseUrl()}/iCal/schedule`;
}

// ==================== Core Browser-Compliant Fetch Wrapper ====================

interface RawHttpResponse<T> {
  ok: boolean;
  status: number;
  data: T | null;
  text: string;
  networkError?: string;
}

async function performFetch<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    timeoutMs?: number;
    allowAuthRetry?: boolean;
  } = {},
  hasRetried = false,
): Promise<RawHttpResponse<T>> {
  const method = options.method ?? 'GET';
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
  };
  let serializedBody: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json; charset=utf-8';
    serializedBody = JSON.stringify(options.body);
  }

  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: serializedBody,
      credentials: 'include',
      signal: controller.signal,
    });

    if (
      response.status === 401 &&
      options.allowAuthRetry !== false &&
      !hasRetried &&
      !guestModeActive
    ) {
      const relogged = await tryAutoRelogin();
      if (relogged) {
        return performFetch<T>(path, options, true);
      }
    }

    const text = await response.text();
    let parsed: T | null = null;
    if (text) {
      try {
        parsed = JSON.parse(text) as T;
      } catch {
        parsed = text as unknown as T;
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      data: parsed,
      text,
    };
  } catch (err) {
    const reason =
      err instanceof Error
        ? err.name === 'AbortError'
          ? 'Превышено время ожидания сервера (4.5 сек)'
          : err.message || 'Ошибка сети или CORS'
        : 'Ошибка сети';
    return {
      ok: false,
      status: 0,
      data: null,
      text: '',
      networkError: reason,
    };
  } finally {
    clearTimeout(timerId);
  }
}

async function tryAutoRelogin(): Promise<boolean> {
  if (reloginPromise) return reloginPromise;
  const creds = reloginCredentialsProvider?.();
  if (!creds || !creds.username.trim() || !creds.password) {
    return false;
  }

  reloginPromise = (async () => {
    try {
      const res = await performFetch<Record<string, unknown>>('/auth/login', {
        method: 'POST',
        body: { username: creds.username.trim(), password: creds.password },
        allowAuthRetry: false,
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      reloginPromise = null;
    }
  })();

  return reloginPromise;
}

// ==================== Auth & Profile Cascade ====================

function extractGroupString(val: unknown): string {
  if (typeof val === 'string') return val.trim();
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (typeof obj.name === 'string') return obj.name.trim();
    if (typeof obj.studentGroup === 'string') return obj.studentGroup.trim();
  }
  return '';
}

function buildFioFromObj(obj: Record<string, unknown>): string {
  if (typeof obj.fio === 'string' && obj.fio.trim()) return obj.fio.trim();
  const ln = typeof obj.lastName === 'string' ? obj.lastName.trim() : '';
  const fn = typeof obj.firstName === 'string' ? obj.firstName.trim() : '';
  const mn = typeof obj.middleName === 'string' ? obj.middleName.trim() : '';
  return [ln, fn, mn].filter(Boolean).join(' ').trim();
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const cleanUser = username.trim();
  if (!cleanUser || !password.trim()) {
    return {
      ok: false,
      error: 'Пожалуйста, заполните все поля',
      source: 'live',
    };
  }

  if (isOfflineMode()) {
    guestModeActive = false;
    const session = mockLogin(cleanUser);
    return {
      ok: true,
      session,
      source: 'mock',
      offlineReason: 'Автономный режим включён',
    };
  }

  const res = await performFetch<Record<string, unknown>>('/auth/login', {
    method: 'POST',
    body: { username: cleanUser, password },
    allowAuthRetry: false,
  });

  if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) {
    return {
      ok: false,
      error: 'Неверный логин или пароль',
      status: res.status,
      source: 'live',
    };
  }

  if (!res.ok || res.networkError || res.status >= 500) {
    guestModeActive = false;
    const session = mockLogin(cleanUser);
    return {
      ok: true,
      session,
      status: res.status || undefined,
      source: 'mock',
      offlineReason:
        res.networkError || `Сервер недоступен (${res.status || 'CORS'}) — включён оффлайн-режим`,
    };
  }

  guestModeActive = false;
  const loginBody = (res.data && typeof res.data === 'object' ? res.data : {}) as Record<
    string,
    unknown
  >;
  let fio = buildFioFromObj(loginBody);
  let group =
    extractGroupString(loginBody.group) ||
    extractGroupString(loginBody.studentGroup);
  let photoUrl =
    (typeof loginBody.photoUrl === 'string' && loginBody.photoUrl.trim()) ||
    (typeof loginBody.photoLink === 'string' && loginBody.photoLink.trim()) ||
    '';
  let desc = '';

  // Post-login cascade matching MainActivity.kt:302-405
  const cvRes = await performFetch<PersonalCvDto>('/profiles/personal-cv', {
    allowAuthRetry: false,
  });
  if (cvRes.ok && cvRes.data && typeof cvRes.data === 'object') {
    setCachedPersonalCv(cvRes.data);
    const cvObj = cvRes.data as unknown as Record<string, unknown>;
    fio = fio || buildFioFromObj(cvObj);
    group =
      group ||
      extractGroupString(cvRes.data.studentGroup) ||
      extractGroupString(cvRes.data.group);
    photoUrl =
      photoUrl ||
      (cvRes.data.photoUrl ?? '').trim() ||
      (cvRes.data.photoLink ?? '').trim();
    const fac = (cvRes.data.facultyAbbrev || cvRes.data.faculty || '').trim();
    const course = cvRes.data.course ? `${cvRes.data.course} курс` : '';
    desc = [fac, course].filter(Boolean).join(' · ');
  }

  if (!group) {
    const mbRes = await performFetch<MarkbookResponse>('/markbook', {
      allowAuthRetry: false,
    });
    if (mbRes.ok && mbRes.data && typeof mbRes.data === 'object') {
      const mb = normalizeMarkbook(mbRes.data);
      setCachedMarkbook(mb);
      group =
        extractGroupString(mb.student?.group) ||
        extractGroupString(mb.student?.studentGroup) ||
        extractGroupString(mb.markBookGroupDto?.studentGroup) ||
        extractGroupString(mb.studentGroup);
      fio =
        fio ||
        (mb.student ? buildFioFromObj(mb.student as Record<string, unknown>) : '');
    }
  }

  if (!group) {
    const omRes = await performFetch<Record<string, unknown>>('/omissions', {
      allowAuthRetry: false,
    });
    if (omRes.ok && omRes.data && typeof omRes.data === 'object') {
      group = extractGroupString(omRes.data.studentGroup);
    }
  }

  const session: AuthSession = {
    authenticated: true,
    isGuest: false,
    username: cleanUser,
    fio: fio || cleanUser,
    group: sanitizeGroupNumber(group, '310101'),
    desc,
    photoUrl,
    isHeadman: false,
  };

  return {
    ok: true,
    session,
    source: 'live',
  };
}

export async function logout(): Promise<void> {
  mockLogout();
  if (!isOfflineMode()) {
    await performFetch('/auth/logout', {
      method: 'POST',
      allowAuthRetry: false,
      timeoutMs: 2000,
    }).catch(() => undefined);
  }
}

// ==================== Public BSUIR Schedule & Catalogs ====================

export async function fetchStudentGroups(): Promise<ApiResult<BsuirStudentGroup[]>> {
  if (!isOfflineMode()) {
    const res = await performFetch<BsuirStudentGroup[]>('/student-groups', {
      allowAuthRetry: false,
    });
    if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
      setCachedStudentGroups(res.data);
      return { data: res.data, source: 'live' };
    }
    const cached = getCachedStudentGroups();
    if (cached && cached.length > 0) {
      return {
        data: cached,
        source: 'cache',
        offlineReason: res.networkError || 'Загружено из кэша',
      };
    }
    return {
      data: MOCK_STUDENT_GROUPS,
      source: 'mock',
      offlineReason: res.networkError || 'Демо-данные групп',
    };
  }

  const cached = getCachedStudentGroups();
  if (cached && cached.length > 0) {
    return { data: cached, source: 'cache', offlineReason: 'Оффлайн режим (кэш)' };
  }
  return { data: MOCK_STUDENT_GROUPS, source: 'mock', offlineReason: 'Оффлайн режим' };
}

function normalizeEmployee(emp: BsuirEmployee): BsuirEmployee {
  const computedFull = [emp.lastName, emp.firstName, emp.middleName]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ');
  return {
    ...emp,
    fullName: emp.fullName?.trim() || computedFull || emp.fio?.trim() || '',
  };
}

export async function fetchEmployees(): Promise<ApiResult<BsuirEmployee[]>> {
  if (!isOfflineMode()) {
    const res = await performFetch<BsuirEmployee[]>('/employees/all', {
      allowAuthRetry: false,
    });
    if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
      const normalized = res.data.map(normalizeEmployee);
      setCachedEmployees(normalized);
      return { data: normalized, source: 'live' };
    }
    const cached = getCachedEmployees();
    if (cached && cached.length > 0) {
      return {
        data: cached,
        source: 'cache',
        offlineReason: res.networkError || 'Загружено из кэша',
      };
    }
    return {
      data: MOCK_EMPLOYEES,
      source: 'mock',
      offlineReason: res.networkError || 'Демо-данные преподавателей',
    };
  }

  const cached = getCachedEmployees();
  if (cached && cached.length > 0) {
    return { data: cached, source: 'cache', offlineReason: 'Оффлайн режим (кэш)' };
  }
  return { data: MOCK_EMPLOYEES, source: 'mock', offlineReason: 'Оффлайн режим' };
}

function cacheScheduleResponse(target: string, response: BsuirScheduleResponse): void {
  const { lessons, exams } = parseScheduleResponse(response);
  setCachedSchedule(target, {
    updatedAt: Date.now(),
    response,
    lessons,
    exams,
    startExamsDate: (response.startExamsDate ?? '').trim(),
    endExamsDate: (response.endExamsDate ?? '').trim(),
  });
}

export async function fetchGroupSchedule(
  group: string,
): Promise<ApiResult<BsuirScheduleResponse>> {
  const grp = sanitizeGroupNumber(group, '310101');

  if (!isOfflineMode()) {
    let res = await performFetch<BsuirScheduleResponse>(
      `/schedule?studentGroup=${encodeURIComponent(grp)}`,
      { allowAuthRetry: false },
    );

    if (
      (!res.ok || !res.data || typeof res.data !== 'object') &&
      !res.networkError
    ) {
      res = await performFetch<BsuirScheduleResponse>(
        `/schedules?studentGroup=${encodeURIComponent(grp)}`,
        { allowAuthRetry: false },
      );
    }

    if (
      res.ok &&
      res.data &&
      typeof res.data === 'object' &&
      (res.data.schedules || res.data.nextSchedules || res.data.exams)
    ) {
      cacheScheduleResponse(grp, res.data);
      return { data: res.data, source: 'live' };
    }

    const cached = getCachedSchedule(grp);
    if (cached?.response) {
      return {
        data: cached.response,
        source: 'cache',
        offlineReason: res.networkError || `Кэш расписания (${res.status || 'оффлайн'})`,
      };
    }

    return {
      data: getMockGroupSchedule(grp),
      source: 'mock',
      offlineReason: res.networkError || 'Демо-расписание (сервер недоступен)',
    };
  }

  const cached = getCachedSchedule(grp);
  if (cached?.response) {
    return {
      data: cached.response,
      source: 'cache',
      offlineReason: 'Оффлайн режим (кэш)',
    };
  }
  return {
    data: getMockGroupSchedule(grp),
    source: 'mock',
    offlineReason: 'Оффлайн режим',
  };
}

export async function fetchEmployeeSchedule(
  urlId: string,
): Promise<ApiResult<BsuirScheduleResponse>> {
  const cleanId = urlId.trim();
  const cacheKey = `emp_${cleanId}`;

  if (!isOfflineMode() && cleanId) {
    const res = await performFetch<BsuirScheduleResponse>(
      `/employees/schedule/${encodeURIComponent(cleanId)}`,
      { allowAuthRetry: false },
    );
    if (
      res.ok &&
      res.data &&
      typeof res.data === 'object' &&
      (res.data.schedules || res.data.nextSchedules || res.data.exams)
    ) {
      cacheScheduleResponse(cacheKey, res.data);
      return { data: res.data, source: 'live' };
    }

    const cached = getCachedSchedule(cacheKey);
    if (cached?.response) {
      return {
        data: cached.response,
        source: 'cache',
        offlineReason: res.networkError || 'Кэш расписания преподавателя',
      };
    }

    return {
      data: getMockEmployeeSchedule(cleanId),
      source: 'mock',
      offlineReason: res.networkError || 'Демо-расписание преподавателя',
    };
  }

  const cached = getCachedSchedule(cacheKey);
  if (cached?.response) {
    return {
      data: cached.response,
      source: 'cache',
      offlineReason: 'Оффлайн режим (кэш)',
    };
  }
  return {
    data: getMockEmployeeSchedule(cleanId),
    source: 'mock',
    offlineReason: 'Оффлайн режим',
  };
}

export async function fetchCurrentWeek(): Promise<ApiResult<number>> {
  if (!isOfflineMode()) {
    const res = await performFetch<number | string>('/schedule/current-week', {
      allowAuthRetry: false,
    });
    const parsed =
      typeof res.data === 'number'
        ? res.data
        : Number.parseInt(String(res.data ?? '').trim(), 10);
    if (res.ok && Number.isFinite(parsed) && parsed >= 1 && parsed <= 4) {
      setCachedCurrentWeek(parsed);
      return { data: parsed, source: 'live' };
    }
  }

  const cached = getCachedCurrentWeek();
  if (cached !== null) {
    return { data: cached, source: 'cache', offlineReason: 'Кэш текущей недели' };
  }

  return {
    data: getBsuirWeekInfo(new Date()).weekNumber,
    source: 'mock',
    offlineReason: 'Локальный расчёт недели',
  };
}

export async function fetchAnnouncements(): Promise<ApiResult<AnnouncementItem[]>> {
  if (!isOfflineMode()) {
    const res = await performFetch<unknown>('/announcements?page=0&size=20', {
      allowAuthRetry: false,
    });
    if (res.ok && res.data) {
      let items: AnnouncementItem[] = [];
      if (Array.isArray(res.data)) {
        items = res.data as AnnouncementItem[];
      } else if (typeof res.data === 'object') {
        const obj = res.data as Record<string, unknown>;
        if (Array.isArray(obj.content)) items = obj.content as AnnouncementItem[];
        else if (Array.isArray(obj.items)) items = obj.items as AnnouncementItem[];
        else if (obj.title || obj.content || obj.name) items = [obj as AnnouncementItem];
      }
      if (items.length > 0) {
        setCachedAnnouncements(items);
        return { data: items, source: 'live' };
      }
    }
    const cached = getCachedAnnouncements();
    if (cached && cached.length > 0) {
      return { data: cached, source: 'cache', offlineReason: res.networkError };
    }
    return {
      data: MOCK_ANNOUNCEMENTS,
      source: 'mock',
      offlineReason: res.networkError || 'Демо-объявления',
    };
  }

  const cached = getCachedAnnouncements();
  if (cached && cached.length > 0) {
    return { data: cached, source: 'cache', offlineReason: 'Оффлайн режим (кэш)' };
  }
  return { data: MOCK_ANNOUNCEMENTS, source: 'mock', offlineReason: 'Оффлайн режим' };
}

// ==================== Personal CV / Resume ====================

export async function fetchPersonalCv(): Promise<ApiResult<PersonalCvDto>> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<PersonalCvDto>('/profiles/personal-cv');
    if (res.ok && res.data && typeof res.data === 'object') {
      setCachedPersonalCv(res.data);
      return { data: res.data, source: 'live' };
    }
    const cached = getCachedPersonalCv();
    if (cached) {
      return {
        data: cached,
        source: 'cache',
        offlineReason: res.networkError || 'Профиль загружен из кэша',
      };
    }
    return {
      data: getMockPersonalCv(),
      source: 'mock',
      offlineReason: res.networkError || 'Демо-профиль ИИС',
    };
  }

  if (!guestModeActive) {
    const cached = getCachedPersonalCv();
    if (cached) {
      return { data: cached, source: 'cache', offlineReason: 'Оффлайн режим (кэш)' };
    }
  }
  return { data: getMockPersonalCv(), source: 'mock', offlineReason: 'Оффлайн режим' };
}

export async function updateCvSection(
  endpoint: ProfileCvSectionEndpoint,
  patch: Partial<PersonalCvDto>,
): Promise<ApiResult<PersonalCvDto>> {
  const current = getCachedPersonalCv() ?? getMockPersonalCv();
  const merged: PersonalCvDto = { ...current, ...patch };

  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<PersonalCvDto>(`/profiles/${endpoint}`, {
      method: 'PUT',
      body: merged,
    });
    if (res.ok) {
      const updated = res.data && typeof res.data === 'object' ? res.data : merged;
      setCachedPersonalCv(updated);
      mockUpdateCvSection(endpoint, updated);
      return { data: updated, source: 'live' };
    }
  }

  const updated = mockUpdateCvSection(endpoint, merged);
  setCachedPersonalCv(updated);
  return {
    data: updated,
    source: 'mock',
    offlineReason: 'Изменения сохранены локально',
  };
}

export async function updateCvSkills(
  skills: Array<{ id?: number; name: string }>,
): Promise<ApiResult<CvSkill[]>> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<CvSkill[]>('/profiles/my-skills', {
      method: 'POST',
      body: skills,
    });
    if (res.ok && Array.isArray(res.data)) {
      const updated = mockUpdateCvSkills(res.data);
      const cached = getCachedPersonalCv();
      if (cached) {
        setCachedPersonalCv({ ...cached, skills: updated });
      }
      return { data: updated, source: 'live' };
    }
  }

  const updated = mockUpdateCvSkills(skills);
  const cached = getCachedPersonalCv();
  if (cached) {
    setCachedPersonalCv({ ...cached, skills: updated });
  }
  return {
    data: updated,
    source: 'mock',
    offlineReason: 'Навыки сохранены локально',
  };
}

export async function updateCvReferences(
  refs: Array<{ id?: number; name: string; reference: string }>,
): Promise<ApiResult<CvReference[]>> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<CvReference[]>('/profiles/my-references', {
      method: 'PUT',
      body: refs,
    });
    if (res.ok && Array.isArray(res.data)) {
      const updated = mockUpdateCvReferences(res.data);
      const cached = getCachedPersonalCv();
      if (cached) {
        setCachedPersonalCv({ ...cached, references: updated });
      }
      return { data: updated, source: 'live' };
    }
  }

  const updated = mockUpdateCvReferences(refs);
  const cached = getCachedPersonalCv();
  if (cached) {
    setCachedPersonalCv({ ...cached, references: updated });
  }
  return {
    data: updated,
    source: 'mock',
    offlineReason: 'Ссылки сохранены локально',
  };
}

// ==================== Personal Rating, Group Rating & Markbook ====================

function normalizeLessonTypeAbbrev(
  id: number | null | undefined,
  abbrev: string | null | undefined,
): string {
  const upper = (abbrev ?? '').trim().toUpperCase();
  if (id === 4 || upper.includes('ЛР') || upper.includes('ЛАБ')) return 'ЛР';
  if (id === 2 || upper.includes('ПЗ') || upper.includes('ПРАК')) return 'ПЗ';
  if (id === 3 || upper.includes('СЕМ')) return 'СЕМ';
  if (id === 1 || upper.includes('ЛК') || upper.includes('ЛЕК')) return 'ЛК';
  if (upper.includes('КП') || upper.includes('КР')) return 'КП';
  return (abbrev ?? '').trim() || 'ПЗ';
}

export function parsePersonalRatingToProgress(
  raw: BsuirRatingResponse,
): AcademicSubjectProgress[] {
  const subjects = raw.subjects ?? [];
  const deadlinesMap = new Map<number, number>();

  for (const dlGroup of raw.deadlines ?? []) {
    if (dlGroup.termHoursId != null) {
      const count = dlGroup.taskCount ?? dlGroup.labCount ?? 0;
      deadlinesMap.set(dlGroup.termHoursId, count);
    }
  }

  return subjects.map((subj) => {
    const allMarks: AcademicMarkInfo[] = [];
    let hasLabs = false;
    let totalLabs = 0;
    const submittedTaskNumbers = new Set<number>();
    let validLabMarksCount = 0;

    for (const lt of subj.lessonTypes ?? []) {
      const normalizedType = normalizeLessonTypeAbbrev(lt.id, lt.abbrev);
      const isLab = normalizedType === 'ЛР';
      if (isLab) {
        hasLabs = true;
        const fromDeadlines =
          lt.termHoursId != null ? deadlinesMap.get(lt.termHoursId) : undefined;
        let maxTaskNum = 0;
        for (const lesson of lt.lessons ?? []) {
          for (const m of lesson.marks ?? []) {
            if (typeof m.taskNumber === 'number' && m.taskNumber > maxTaskNum) {
              maxTaskNum = m.taskNumber;
            }
          }
        }
        const fallbackLessons = Math.min(
          8,
          Math.max(2, (lt.lessons ?? []).length),
        );
        const typeLabs =
          fromDeadlines && fromDeadlines > 0
            ? fromDeadlines
            : maxTaskNum > 0
              ? maxTaskNum
              : fallbackLessons;
        totalLabs += typeLabs;
      }

      for (const lesson of lt.lessons ?? []) {
        for (const m of lesson.marks ?? []) {
          if (typeof m.mark === 'number' && m.mark > 0) {
            allMarks.push({
              mark: m.mark,
              taskNumber: m.taskNumber ?? null,
              lessonType: normalizedType,
              dateString: lesson.dateString ?? null,
              controlPoint: lesson.controlPoint ?? null,
            });
            if (isLab) {
              if (typeof m.taskNumber === 'number' && m.taskNumber > 0) {
                submittedTaskNumbers.add(m.taskNumber);
              } else {
                validLabMarksCount += 1;
              }
            }
          }
        }
      }
    }

    const rawSubmitted =
      submittedTaskNumbers.size > 0
        ? submittedTaskNumbers.size
        : validLabMarksCount;
    const submittedLabs = totalLabs > 0 ? Math.min(rawSubmitted, totalLabs) : rawSubmitted;

    const avg =
      allMarks.length > 0
        ? Number(
            (
              allMarks.reduce((sum, item) => sum + item.mark, 0) / allMarks.length
            ).toFixed(2),
          )
        : null;

    return {
      id: subj.id ?? null,
      name: (subj.name ?? subj.abbrev ?? 'Дисциплина').trim(),
      abbrev: (subj.abbrev ?? subj.name ?? 'Предмет').trim(),
      totalLabs,
      submittedLabs,
      marks: allMarks,
      averageMark: avg,
      hasLabs,
    };
  });
}

export function extractSubjectsFromSchedule(
  lessons: Lesson[],
): AcademicSubjectProgress[] {
  const byTitle = new Map<string, AcademicSubjectProgress>();
  for (const lesson of lessons) {
    const key = lesson.title.trim();
    if (!key) continue;
    const existing = byTitle.get(key);
    const isLab = lesson.lessonType.trim().toUpperCase() === 'ЛР';
    if (!existing) {
      byTitle.set(key, {
        name: lesson.subjectFullName || key,
        abbrev: key,
        totalLabs: isLab ? 4 : 0,
        submittedLabs: 0,
        marks: [],
        averageMark: null,
        hasLabs: isLab,
      });
    } else if (isLab && !existing.hasLabs) {
      existing.hasLabs = true;
      existing.totalLabs = 4;
    }
  }
  return Array.from(byTitle.values());
}

export async function fetchPersonalRating(): Promise<
  ApiResult<{ subjects: AcademicSubjectProgress[]; raw: BsuirRatingResponse }>
> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<BsuirRatingResponse>('/personal-rating');
    if (res.ok && res.data && typeof res.data === 'object') {
      const subjects = parsePersonalRatingToProgress(res.data);
      setCachedRating({ subjects, raw: res.data });
      return { data: { subjects, raw: res.data }, source: 'live' };
    }
    const cached = getCachedRating();
    if (cached?.raw) {
      return {
        data: { subjects: cached.subjects, raw: cached.raw },
        source: 'cache',
        offlineReason: res.networkError || 'Оценки загружены из кэша',
      };
    }
  }

  if (!guestModeActive) {
    const cached = getCachedRating();
    if (cached?.raw) {
      return {
        data: { subjects: cached.subjects, raw: cached.raw },
        source: 'cache',
        offlineReason: 'Оффлайн режим (кэш)',
      };
    }
  }

  return {
    data: {
      subjects: parsePersonalRatingToProgress(MOCK_RATING_RESPONSE),
      raw: MOCK_RATING_RESPONSE,
    },
    source: 'mock',
    offlineReason: guestModeActive ? 'Гостевой режим (демо-данные)' : 'Демо-оценки',
  };
}

export async function fetchGroupRating(group: string): Promise<
  ApiResult<{
    rating: number | null;
    place: number | null;
    entries: GroupRatingEntry[];
  }>
> {
  const grp = sanitizeGroupNumber(group, '310101');
  if (!isOfflineMode() && !guestModeActive) {
    let res = await performFetch<unknown>(
      `/rating/last?studentGroup=${encodeURIComponent(grp)}`,
    );
    if ((!res.ok || !res.data) && !res.networkError) {
      res = await performFetch<unknown>(
        `/rating/group?studentGroup=${encodeURIComponent(grp)}`,
      );
    }

    if (res.ok && res.data) {
      let entries: GroupRatingEntry[] = [];
      let rating: number | null = null;
      let place: number | null = null;

      if (Array.isArray(res.data)) {
        entries = res.data as GroupRatingEntry[];
      } else if (typeof res.data === 'object') {
        const obj = res.data as Record<string, unknown>;
        rating = typeof obj.rating === 'number' ? obj.rating : null;
        place =
          typeof obj.place === 'number'
            ? obj.place
            : typeof obj.position === 'number'
              ? obj.position
              : null;
        if (Array.isArray(obj.rating)) {
          entries = obj.rating as GroupRatingEntry[];
        } else if (Array.isArray(obj.students)) {
          entries = obj.students as GroupRatingEntry[];
        }
      }
      if (entries.length > 0) {
        setCachedGroupRating(entries);
      }
      return { data: { rating, place, entries }, source: 'live' };
    }

    const cached = getCachedGroupRating();
    if (cached && cached.length > 0) {
      return {
        data: { rating: 8.65, place: 3, entries: cached },
        source: 'cache',
        offlineReason: res.networkError,
      };
    }
  }

  return {
    data: { rating: 8.65, place: 3, entries: MOCK_GROUP_RATING },
    source: 'mock',
    offlineReason: 'Демо-рейтинг группы',
  };
}

function normalizeMarkbook(raw: MarkbookResponse): MarkbookResponse {
  const studentGroup =
    raw.studentGroup ??
    raw.student?.studentGroup ??
    raw.student?.group ??
    raw.markBookGroupDto?.studentGroup ??
    null;

  return {
    ...raw,
    studentGroup,
    markPages: raw.markPages ?? {},
  };
}

export function parseMarkbookSemesters(
  mb: MarkbookResponse | null | undefined,
): MarkbookParsedSemester[] {
  if (!mb?.markPages) return [];
  return Object.entries(mb.markPages)
    .map(([key, page]) => {
      const semNum = Number.parseInt(key, 10) || 0;
      const marks = (page?.marks ?? []).map((m) => {
        const hasMark =
          m.mark !== null && m.mark !== undefined && String(m.mark).trim() !== '';
        const formattedMark = hasMark
          ? m.mark
          : m.formOfControl
            ? `— (${m.formOfControl})`
            : '—';
        return { ...m, mark: formattedMark };
      });
      return {
        semesterNumber: semNum,
        title: semNum > 0 ? `${semNum} семестр` : key,
        marks,
        averageMark: page?.averageMark ?? null,
      };
    })
    .sort((a, b) => a.semesterNumber - b.semesterNumber);
}

export async function fetchMarkbook(): Promise<ApiResult<MarkbookResponse>> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<MarkbookResponse>('/markbook');
    if (res.ok && res.data && typeof res.data === 'object') {
      const normalized = normalizeMarkbook(res.data);
      setCachedMarkbook(normalized);
      return { data: normalized, source: 'live' };
    }
    const cached = getCachedMarkbook();
    if (cached) {
      return { data: cached, source: 'cache', offlineReason: res.networkError };
    }
  }

  if (!guestModeActive) {
    const cached = getCachedMarkbook();
    if (cached) {
      return { data: cached, source: 'cache', offlineReason: 'Оффлайн режим (кэш)' };
    }
  }

  return {
    data: MOCK_MARKBOOK,
    source: 'mock',
    offlineReason: 'Демо-зачётка',
  };
}

// ==================== Omissions & ORVI ====================

const MONTH_ABBR_BY_INDEX = [
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
  'Июл',
  'Авг',
  'Сен',
  'Окт',
  'Ноя',
  'Дек',
] as const;

function extractMonthNameFromDate(dateStr: string): string {
  const dmy = dateStr.match(/^\d{1,2}\.(\d{1,2})\.\d{4}/);
  if (dmy) {
    const idx = Number.parseInt(dmy[1], 10) - 1;
    if (idx >= 0 && idx < 12) return MONTH_ABBR_BY_INDEX[idx];
  }
  const ymd = dateStr.match(/^\d{4}-(\d{2})-\d{2}/);
  if (ymd) {
    const idx = Number.parseInt(ymd[1], 10) - 1;
    if (idx >= 0 && idx < 12) return MONTH_ABBR_BY_INDEX[idx];
  }
  return 'Окт';
}

function normalizeRawOmissionLesson(raw: Record<string, unknown>): OmissionLesson {
  const hours = Number(
    raw.gradeBookOmissions ?? raw.missedHours ?? raw.omissions ?? 0,
  ) || 0;
  const isRespectful = Boolean(
    raw.isRespectfulOmission ?? raw.respectful ?? false,
  );
  const dateString = String(raw.dateString ?? raw.date ?? '').trim();
  const subject = String(
    raw.nameLesson ?? raw.subject ?? raw.lessonName ?? 'Учебное занятие',
  ).trim();
  const lessonType = String(raw.lessonType ?? raw.type ?? 'ПЗ').trim();
  const note = String(raw.note ?? raw.reason ?? raw.comment ?? '').trim();
  const teacher = String(raw.teacher ?? raw.employee ?? '').trim();

  return {
    subject,
    lessonType,
    dateString,
    hours,
    isRespectful,
    note,
    teacher,
    monthName: extractMonthNameFromDate(dateString),
  };
}

function parseOmissionsPayload(raw: unknown): OmissionLesson[] {
  const rawList: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? Array.isArray((raw as Record<string, unknown>).omissions)
        ? ((raw as Record<string, unknown>).omissions as unknown[])
        : Array.isArray((raw as Record<string, unknown>).items)
          ? ((raw as Record<string, unknown>).items as unknown[])
          : []
      : [];

  const lessons: OmissionLesson[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const nestedStudent = obj.student as Record<string, unknown> | undefined;
    if (nestedStudent && Array.isArray(nestedStudent.lessons)) {
      for (const nl of nestedStudent.lessons) {
        if (nl && typeof nl === 'object') {
          lessons.push(normalizeRawOmissionLesson(nl as Record<string, unknown>));
        }
      }
    } else if (Array.isArray(obj.lessons)) {
      for (const nl of obj.lessons) {
        if (nl && typeof nl === 'object') {
          lessons.push(normalizeRawOmissionLesson(nl as Record<string, unknown>));
        }
      }
    } else {
      lessons.push(normalizeRawOmissionLesson(obj));
    }
  }
  return lessons;
}

function parseExcuseDocuments(raw: unknown): ExcuseDocument[] {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? Array.isArray((raw as Record<string, unknown>).omissionDtoList)
        ? ((raw as Record<string, unknown>).omissionDtoList as unknown[])
        : Array.isArray((raw as Record<string, unknown>).omissions)
          ? ((raw as Record<string, unknown>).omissions as unknown[])
          : []
      : [];

  return list
    .filter((d): d is Record<string, unknown> => Boolean(d && typeof d === 'object'))
    .map((d) => {
      const df = String(d.dateFrom ?? d.dateStart ?? '').trim();
      const dt = String(d.dateTo ?? d.dateEnd ?? '').trim();
      const dates = [df, dt].filter(Boolean);
      return {
        title: String(d.name ?? d.title ?? 'Документ об уважительной причине').trim(),
        note: String(d.note ?? d.reason ?? '').trim(),
        hoursClosed: Number(d.omissionCount ?? d.hours ?? d.hoursClosed ?? 0) || 0,
        dates,
        subjects: Array.isArray(d.subjects)
          ? d.subjects.map((s) => String(s))
          : [],
      };
    });
}

export async function fetchOmissionsByStudent(): Promise<ApiResult<ExcuseDocument[]>> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<unknown>('/omissions-by-student');
    if (res.ok && res.data) {
      return { data: parseExcuseDocuments(res.data), source: 'live' };
    }
  }
  return {
    data: getMockOmissions().excuseDocuments,
    source: 'mock',
    offlineReason: 'Демо-документы пропусков',
  };
}

export async function fetchDisrespectfulOmissions(): Promise<
  ApiResult<DisrespectfulOmission[]>
> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<DisrespectfulOmission[]>(
      '/disrespectful-omissions-by-student',
    );
    if (res.ok && Array.isArray(res.data)) {
      return { data: res.data, source: 'live' };
    }
  }
  return {
    data: [{ omissionCount: getMockOmissions().unexcusedHours, month: 9 }],
    source: 'mock',
    offlineReason: 'Демо-неуважительные пропуски',
  };
}

export async function fetchOmissions(): Promise<ApiResult<OmissionsSummary>> {
  if (!isOfflineMode() && !guestModeActive) {
    const [omRes, byStudRes, disRes] = await Promise.all([
      performFetch<unknown>('/omissions'),
      performFetch<unknown>('/omissions-by-student'),
      performFetch<DisrespectfulOmission[]>('/disrespectful-omissions-by-student'),
    ]);

    if (omRes.ok && omRes.data) {
      const lessons = parseOmissionsPayload(omRes.data);
      const excuseDocuments = byStudRes.ok && byStudRes.data
        ? parseExcuseDocuments(byStudRes.data)
        : [];

      const monthlyHours: Record<string, number> = {};
      const monthlyUnexcusedHours: Record<string, number> = {};
      let totalHours = 0;
      let unexcusedFromLessons = 0;

      for (const l of lessons) {
        totalHours += l.hours;
        monthlyHours[l.monthName] = (monthlyHours[l.monthName] ?? 0) + l.hours;
        if (!l.isRespectful) {
          unexcusedFromLessons += l.hours;
          monthlyUnexcusedHours[l.monthName] =
            (monthlyUnexcusedHours[l.monthName] ?? 0) + l.hours;
        }
      }

      let unexcusedHours = unexcusedFromLessons;
      if (disRes.ok && Array.isArray(disRes.data) && disRes.data.length > 0) {
        const summed = disRes.data.reduce(
          (acc, d) => acc + (Number(d.omissionCount ?? d.hours ?? 0) || 0),
          0,
        );
        if (summed > 0) unexcusedHours = summed;
      }

      const summary: OmissionsSummary = {
        totalHours,
        unexcusedHours,
        lessons,
        excuseDocuments,
        monthlyHours,
        monthlyUnexcusedHours,
        monthlyData: { ...monthlyHours },
        monthlyUnexcusedData: { ...monthlyUnexcusedHours },
      };
      setCachedOmissions(summary);
      return { data: summary, source: 'live' };
    }

    const cached = getCachedOmissions();
    if (cached) {
      return {
        data: cached,
        source: 'cache',
        offlineReason: omRes.networkError || 'Пропуски из кэша',
      };
    }
  }

  if (!guestModeActive) {
    const cached = getCachedOmissions();
    if (cached) {
      return { data: cached, source: 'cache', offlineReason: 'Оффлайн режим (кэш)' };
    }
  }

  return {
    data: getMockOmissions(),
    source: 'mock',
    offlineReason: 'Демо-данные пропусков',
  };
}

export async function fetchPermanentAddress(): Promise<ApiResult<string>> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<string>('/student-details/permanent-address');
    if (res.ok) {
      const cleaned = res.text.trim().replace(/^"+|"+$/g, '');
      if (cleaned) return { data: cleaned, source: 'live' };
    }
  }
  return {
    data: MOCK_PERMANENT_ADDRESS,
    source: 'mock',
    offlineReason: 'Демо-адрес',
  };
}

export async function createOrviOmission(
  payload: OrviOmissionPayload,
): Promise<OrviOmissionResult> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<Record<string, unknown>>('/omissions/create', {
      method: 'POST',
      body: payload,
    });

    if (res.status === 409) {
      return {
        ok: false,
        conflictLimitExceeded: true,
        message: 'Вы превысили лимит дней на заявление студента в текущем месяце',
        source: 'live',
      };
    }

    if (res.ok) {
      return {
        ok: true,
        message: 'Заявление успешно отправлено',
        source: 'live',
      };
    }

    if (res.status >= 400 && res.status < 500) {
      const serverMsg =
        res.data && typeof res.data === 'object' && typeof res.data.message === 'string'
          ? res.data.message
          : 'Не удалось отправить заявление';
      return { ok: false, message: serverMsg, source: 'live' };
    }
  }

  const result = mockCreateOrviOmission(payload);
  if (result.ok) {
    setCachedOmissions(getMockOmissions());
  }
  return result;
}

// ==================== Group Roster, Curator & Headman Detection ====================

const STUDENT_ARRAY_KEYS = [
  'students',
  'rating',
  'items',
  'groupStudents',
  'grades',
  'list',
  'omissions',
  'studentGroups',
  'markPages',
] as const;

function extractStudentFio(obj: Record<string, unknown>): string {
  const direct =
    (typeof obj.fio === 'string' && obj.fio) ||
    (typeof obj.fullName === 'string' && obj.fullName) ||
    (typeof obj.studentFio === 'string' && obj.studentFio) ||
    (typeof obj.name === 'string' && obj.name);
  if (direct && direct.trim()) return direct.trim();

  if (obj.student && typeof obj.student === 'object') {
    const st = obj.student as Record<string, unknown>;
    const nested = extractStudentFio(st);
    if (nested) return nested;
  }

  return buildFioFromObj(obj);
}

function parseGroupStudentsFromAnySource(
  raw: unknown,
  currentUserFio?: string,
): GroupStudentDto[] {
  let rawItems: unknown[] = [];
  if (Array.isArray(raw)) {
    rawItems = raw;
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.groupInfoStudentDto)) {
      rawItems = obj.groupInfoStudentDto;
    } else {
      for (const key of STUDENT_ARRAY_KEYS) {
        if (Array.isArray(obj[key])) {
          rawItems = obj[key] as unknown[];
          break;
        }
      }
      if (rawItems.length === 0) {
        for (const val of Object.values(obj)) {
          if (Array.isArray(val) && val.length > 0) {
            rawItems = val;
            break;
          }
        }
      }
    }
  }

  const normalizedCurrent = (currentUserFio ?? '').trim().toLowerCase();
  const seen = new Set<string>();
  const students: GroupStudentDto[] = [];

  rawItems.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const obj = item as Record<string, unknown>;
    const fio = extractStudentFio(obj);
    if (!fio || seen.has(fio.toLowerCase())) return;
    seen.add(fio.toLowerCase());

    const role =
      typeof obj.position === 'string' && obj.position.trim()
        ? obj.position.trim()
        : typeof obj.role === 'string' && obj.role.trim()
          ? obj.role.trim()
          : null;

    const posNum =
      typeof obj.position === 'number'
        ? obj.position
        : typeof obj.place === 'number'
          ? obj.place
          : idx + 1;

    const nestedStudent =
      obj.student && typeof obj.student === 'object'
        ? (obj.student as Record<string, unknown>)
        : null;

    const averageMark =
      typeof obj.averageMark === 'number'
        ? obj.averageMark
        : nestedStudent && typeof nestedStudent.averageMark === 'number'
          ? nestedStudent.averageMark
          : null;
    const rating =
      typeof obj.rating === 'number'
        ? obj.rating
        : nestedStudent && typeof nestedStudent.rating === 'number'
          ? nestedStudent.rating
          : averageMark;

    students.push({
      fio,
      position: posNum,
      role,
      averageMark,
      rating,
      isCurrentUser: Boolean(
        normalizedCurrent && fio.toLowerCase() === normalizedCurrent,
      ),
    });
  });

  return students;
}

export function isHeadmanRole(role?: string | null): boolean {
  const lower = (role ?? '').trim().toLowerCase();
  return lower.includes('староста') && !lower.includes('зам');
}

export async function fetchGroupInfo(
  group: string,
  currentUserFio?: string,
): Promise<ApiResult<GroupInfoNormalized>> {
  const grp = sanitizeGroupNumber(group, '310101');

  if (!isOfflineMode() && !guestModeActive) {
    const endpoints = [
      '/student-groups/user-group-info',
      `/student-groups/user-group-info?studentGroup=${encodeURIComponent(grp)}`,
      '/grade-book/group-students',
      '/omissions',
      `/rating/group?studentGroup=${encodeURIComponent(grp)}`,
      `/rating/last?studentGroup=${encodeURIComponent(grp)}`,
    ];

    let curator: CuratorDto | null = null;
    let students: GroupStudentDto[] = [];
    let lastNetworkError: string | undefined;

    for (const ep of endpoints) {
      const res = await performFetch<Record<string, unknown>>(ep);
      if (res.networkError) {
        lastNetworkError = res.networkError;
        break;
      }
      if (!res.ok || !res.data) continue;

      if (!curator && res.data.studentGroupCuratorDto && typeof res.data.studentGroupCuratorDto === 'object') {
        const c = res.data.studentGroupCuratorDto as Record<string, unknown>;
        curator = {
          fio: String(c.fio ?? '').trim(),
          position: String(c.position ?? '').trim(),
          phone: String(c.phone ?? '').trim(),
          email: String(c.email ?? '').trim(),
          urlId: String(c.urlId ?? '').trim(),
        };
      }

      if (students.length === 0) {
        students = parseGroupStudentsFromAnySource(res.data, currentUserFio);
      }
      if (curator && students.length > 0) break;
    }

    if (curator || students.length > 0) {
      const me = students.find((s) => s.isCurrentUser);
      const isHeadman = Boolean(me && isHeadmanRole(me.role));
      setCachedGroupInfo({ curator, students });
      return {
        data: { curator, students, isHeadman },
        source: 'live',
      };
    }

    const cached = getCachedGroupInfo();
    if (cached) {
      const me = cached.students.find((s) => s.isCurrentUser);
      return {
        data: {
          curator: cached.curator,
          students: cached.students,
          isHeadman: Boolean(me && isHeadmanRole(me.role)),
        },
        source: 'cache',
        offlineReason: lastNetworkError || 'Состав группы из кэша',
      };
    }

    if (lastNetworkError) {
      return {
        data: getMockGroupInfo(grp),
        source: 'mock',
        offlineReason: lastNetworkError,
      };
    }
  }

  return {
    data: getMockGroupInfo(grp),
    source: 'mock',
    offlineReason: 'Демо-состав группы',
  };
}

// ==================== Notifications ====================

export async function fetchNotifications(): Promise<ApiResult<DeanNotification[]>> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<unknown>('/notifications?pageNumber=0&pageSize=50');
    if (res.ok && res.data) {
      let rawArr: unknown[] = [];
      if (Array.isArray(res.data)) {
        rawArr = res.data;
      } else if (typeof res.data === 'object') {
        const obj = res.data as Record<string, unknown>;
        if (Array.isArray(obj.notifications)) rawArr = obj.notifications;
        else if (Array.isArray(obj.items)) rawArr = obj.items;
        else if (Array.isArray(obj.content)) rawArr = obj.content;
      }

      const items: DeanNotification[] = rawArr
        .filter((n): n is Record<string, unknown> => Boolean(n && typeof n === 'object'))
        .map((n) => ({
          id: Number(n.id ?? 0),
          message: String(n.message ?? ''),
          date: String(n.date ?? ''),
          type: String(n.type ?? 'INFO'),
          isViewed: Boolean(n.isViewed),
        }));

      setCachedNotifications(items);
      return { data: items, source: 'live' };
    }
    const cached = getCachedNotifications();
    if (cached) {
      return { data: cached, source: 'cache', offlineReason: res.networkError };
    }
  }

  return {
    data: getMockNotifications(),
    source: 'mock',
    offlineReason: 'Демо-уведомления',
  };
}

export async function fetchUnreadNotificationsCount(): Promise<ApiResult<number>> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<number | string>('/notifications/notViewed/count');
    if (res.ok) {
      const count = Number.parseInt(res.text.trim(), 10);
      if (Number.isFinite(count) && count >= 0) {
        return { data: count, source: 'live' };
      }
    }
  }
  const notifs = getMockNotifications();
  return {
    data: notifs.filter((n) => !n.isViewed).length,
    source: 'mock',
  };
}

export async function markNotificationsRead(
  ids: number[],
): Promise<ApiResult<DeanNotification[]>> {
  if (ids.length === 0) {
    const cached = !guestModeActive ? getCachedNotifications() : null;
    if (cached) {
      return { data: cached, source: isOfflineMode() ? 'cache' : 'live' };
    }
    if (!isOfflineMode() && !guestModeActive) {
      return fetchNotifications();
    }
    return { data: getMockNotifications(), source: 'mock' };
  }

  if (!isOfflineMode() && !guestModeActive) {
    const payload = ids.map((id) => ({ id, isViewed: true }));
    const res = await performFetch<unknown>('/notifications', {
      method: 'PATCH',
      body: payload,
    });
    if (res.ok) {
      const idSet = new Set(ids);
      let baseNotifications = getCachedNotifications();
      if (baseNotifications === null) {
        const fetched = await fetchNotifications();
        baseNotifications = fetched.source === 'live' ? fetched.data : [];
      }
      const updated = baseNotifications.map((n) =>
        idSet.has(n.id) ? { ...n, isViewed: true } : n,
      );
      setCachedNotifications(updated);
      return { data: updated, source: 'live' };
    }
  }

  const updated = mockMarkNotificationsRead(ids);
  setCachedNotifications(updated);
  return {
    data: updated,
    source: 'mock',
    offlineReason: 'Прочитано локально',
  };
}

// ==================== Certificates & Mark Sheets ====================

function normalizeCertificate(raw: Record<string, unknown>): CertificateDto {
  return {
    id: Number(raw.id ?? 0),
    number: Number(raw.number ?? 0),
    certificateType: String(raw.certificateType ?? 'Обычная'),
    provisionPlace: String(
      raw.provisionPlace ?? raw.placeOfSubmission ?? raw.place ?? '',
    ),
    dateOrder: String(raw.dateOrder ?? ''),
    issueDate:
      typeof raw.issueDate === 'string'
        ? raw.issueDate
        : typeof raw.dateIssue === 'string'
          ? raw.dateIssue
          : null,
    status: Number(raw.status ?? 2),
    rejectionReason:
      typeof raw.rejectionReason === 'string' ? raw.rejectionReason : null,
  };
}

export async function fetchCertificates(): Promise<ApiResult<CertificateDto[]>> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<unknown[]>('/certificate');
    if (res.ok && Array.isArray(res.data)) {
      const list = res.data
        .filter((c): c is Record<string, unknown> => Boolean(c && typeof c === 'object'))
        .map(normalizeCertificate);
      setCachedCertificates(list);
      return { data: list, source: 'live' };
    }
    const cached = getCachedCertificates();
    if (cached) {
      return { data: cached, source: 'cache', offlineReason: res.networkError };
    }
  }
  return {
    data: getMockCertificates(),
    source: 'mock',
    offlineReason: 'Демо-справки',
  };
}

export async function fetchCertificatePlaces(): Promise<
  ApiResult<CertificatePlaceGroup[]>
> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<unknown[]>('/certificate/places');
    if (res.ok && Array.isArray(res.data)) {
      const groups: CertificatePlaceGroup[] = res.data
        .filter((g): g is Record<string, unknown> => Boolean(g && typeof g === 'object'))
        .map((g) => ({
          categoryTitle: String(g.type ?? g.categoryTitle ?? 'Места подачи'),
          places: Array.isArray(g.places)
            ? g.places
                .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === 'object'))
                .map((p) => ({
                  name: String(p.name ?? ''),
                  type: (Number(p.type) === 1 ? 1 : 0) as 0 | 1,
                }))
            : [],
        }));
      setCachedCertificatePlaces(groups);
      return { data: groups, source: 'live' };
    }
    const cached = getCachedCertificatePlaces();
    if (cached) {
      return { data: cached, source: 'cache', offlineReason: res.networkError };
    }
  }
  return {
    data: MOCK_CERTIFICATE_PLACES,
    source: 'mock',
    offlineReason: 'Демо-справочник мест',
  };
}

export async function registerCertificate(
  payload: CertificateRegisterPayload,
): Promise<ApiResult<CertificateDto[]>> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<unknown>('/certificate/register', {
      method: 'POST',
      body: payload,
    });
    if (res.ok) {
      const listRes = await fetchCertificates();
      if (listRes.source === 'live') return listRes;
    }
  }

  const updated = mockRegisterCertificate(payload);
  setCachedCertificates(updated);
  return {
    data: updated,
    source: 'mock',
    offlineReason: 'Справка оформлена в оффлайн-режиме',
  };
}

export async function closeCertificate(
  id: number,
): Promise<ApiResult<CertificateDto[]>> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<unknown>(`/certificate/close?id=${id}`);
    if (res.ok) {
      const listRes = await fetchCertificates();
      if (listRes.source === 'live') return listRes;
    }
  }

  const updated = mockCloseCertificate(id);
  setCachedCertificates(updated);
  return {
    data: updated,
    source: 'mock',
    offlineReason: 'Заявка отменена локально',
  };
}

function normalizeMarkSheet(raw: Record<string, unknown>): MarkSheetDto {
  const subj = (raw.subject && typeof raw.subject === 'object'
    ? raw.subject
    : {}) as Record<string, unknown>;
  const emp = (raw.employee && typeof raw.employee === 'object'
    ? raw.employee
    : {}) as Record<string, unknown>;

  return {
    id: Number(raw.id ?? 0),
    number: String(raw.number ?? ''),
    subjectName: String(raw.subjectName ?? subj.abbrev ?? subj.name ?? 'Дисциплина'),
    subjectType: String(raw.subjectType ?? subj.lessonTypeAbbrev ?? 'ЛР'),
    employeeFio: String(raw.employeeFio ?? emp.fio ?? ''),
    absentDate: String(raw.absentDate ?? ''),
    createDate: String(raw.createDate ?? ''),
    expireDate: String(raw.expireDate ?? ''),
    hours: Number(raw.hours ?? 0),
    price: Number(raw.price ?? 0),
    isGoodReason: Boolean(raw.isGoodReason ?? raw.reason ?? false),
    status: String(raw.status ?? 'В обработке'),
    rejectionReason: String(raw.rejectionReason ?? ''),
    term: Number(raw.term ?? subj.term ?? 0),
  };
}

export async function fetchMarkSheets(): Promise<ApiResult<MarkSheetDto[]>> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<unknown[]>('/mark-sheet');
    if (res.ok && Array.isArray(res.data)) {
      const list = res.data
        .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === 'object'))
        .map(normalizeMarkSheet);
      setCachedMarkSheets(list);
      return { data: list, source: 'live' };
    }
    const cached = getCachedMarkSheets();
    if (cached) {
      return { data: cached, source: 'cache', offlineReason: res.networkError };
    }
  }

  return {
    data: getMockMarkSheets(),
    source: 'mock',
    offlineReason: 'Демо-ведомости',
  };
}

export async function fetchMarkSheetSubjects(): Promise<
  ApiResult<MarkSheetSubjectDto[]>
> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<MarkSheetSubjectDto[]>('/mark-sheet/subjects');
    if (res.ok && Array.isArray(res.data)) {
      setCachedMarkSheetSubjects(res.data);
      return { data: res.data, source: 'live' };
    }
    const cached = getCachedMarkSheetSubjects();
    if (cached) {
      return { data: cached, source: 'cache', offlineReason: res.networkError };
    }
  }

  return {
    data: MOCK_MARK_SHEET_SUBJECTS,
    source: 'mock',
    offlineReason: 'Демо-предметы для ведомостей',
  };
}

export async function createMarkSheet(
  payload: MarkSheetCreatePayload,
): Promise<ApiResult<MarkSheetDto[]>> {
  const hoursNum = Number.parseFloat(payload.hours) || 0;
  const enforcedPayload: MarkSheetCreatePayload = {
    ...payload,
    price: calculateMarkSheetCost(hoursNum, payload.reason),
  };

  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<unknown>('/mark-sheet', {
      method: 'POST',
      body: enforcedPayload,
    });
    if (res.ok) {
      const listRes = await fetchMarkSheets();
      if (listRes.source === 'live') return listRes;
    }
  }

  const updated = mockCreateMarkSheet(enforcedPayload);
  setCachedMarkSheets(updated);
  return {
    data: updated,
    source: 'mock',
    offlineReason: 'Ведомость создана в оффлайн-режиме',
  };
}

export async function closeMarkSheet(
  id: number,
): Promise<ApiResult<MarkSheetDto[]>> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<unknown>(`/mark-sheet/close?id=${id}`);
    if (res.ok) {
      const listRes = await fetchMarkSheets();
      if (listRes.source === 'live') return listRes;
    }
  }

  const updated = mockCloseMarkSheet(id);
  setCachedMarkSheets(updated);
  return {
    data: updated,
    source: 'mock',
    offlineReason: 'Ведомость отозвана локально',
  };
}

// ==================== Dormitory, Privileges & Penalties ====================

export async function fetchDormitoryQueue(): Promise<
  ApiResult<DormitoryApplicationDto[]>
> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<DormitoryApplicationDto[]>(
      '/dormitory-queue-application',
    );
    if (res.ok && Array.isArray(res.data)) {
      setCachedDormitoryApps(res.data);
      return { data: res.data, source: 'live' };
    }
    const cached = getCachedDormitoryApps();
    if (cached) {
      return { data: cached, source: 'cache', offlineReason: res.networkError };
    }
  }

  return {
    data: MOCK_DORMITORY_APPLICATIONS,
    source: 'mock',
    offlineReason: 'Демо-данные общежития',
  };
}

export async function fetchDormitoryPrivileges(): Promise<
  ApiResult<DormitoryPrivilegeDto[]>
> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<unknown[]>(
      '/dormitory-queue-application/privileges',
    );
    if (res.ok && Array.isArray(res.data)) {
      const list: DormitoryPrivilegeDto[] = res.data
        .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === 'object'))
        .map((p) => ({
          id: Number(p.id ?? 0),
          year: typeof p.year === 'number' ? p.year : null,
          categoryName: String(
            p.categoryName ?? p.dormitoryPrivilegeCategoryName ?? '',
          ),
          privilegeName: String(
            p.privilegeName ?? p.dormitoryPrivilegeName ?? '',
          ),
          note: typeof p.note === 'string' ? p.note : null,
        }));
      setCachedDormitoryPrivileges(list);
      return { data: list, source: 'live' };
    }
    const cached = getCachedDormitoryPrivileges();
    if (cached) {
      return { data: cached, source: 'cache', offlineReason: res.networkError };
    }
  }

  return {
    data: MOCK_DORMITORY_PRIVILEGES,
    source: 'mock',
    offlineReason: 'Демо-льготы общежития',
  };
}

export async function fetchPenalties(): Promise<
  ApiResult<PenaltyDirectiveDto[]>
> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<unknown[]>(
      '/dormitory-queue-application/premium-penalty',
    );
    if (res.ok && Array.isArray(res.data)) {
      const list: PenaltyDirectiveDto[] = res.data
        .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === 'object'))
        .map((p) => {
          const dir = (p.directiveDto && typeof p.directiveDto === 'object'
            ? p.directiveDto
            : {}) as Record<string, unknown>;
          return {
            id: Number(p.id ?? 0),
            type: String(p.type ?? dir.typeName ?? dir.type ?? ''),
            reason: String(p.reason ?? ''),
            status: String(p.status ?? ''),
            date: String(p.date ?? dir.date ?? ''),
            directiveNumber: String(p.directiveNumber ?? dir.number ?? ''),
            note: String(p.note ?? ''),
          };
        });
      setCachedPenalties(list);
      return { data: list, source: 'live' };
    }
    const cached = getCachedPenalties();
    if (cached) {
      return { data: cached, source: 'cache', offlineReason: res.networkError };
    }
  }

  return {
    data: MOCK_PENALTIES,
    source: 'mock',
    offlineReason: 'Демо-приказы и взыскания',
  };
}

// ==================== Headman Journal ====================

export async function fetchHeadmanSubjects(): Promise<
  ApiResult<{ hasAccess: boolean; subjects: HeadmanSubject[] }>
> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<Record<string, Array<{ id: number; lessonTypeAbbrev: string }>>>(
      '/headman/subjects',
    );
    if (res.status === 403 || res.status === 404) {
      return {
        data: { hasAccess: false, subjects: [] },
        source: 'live',
        httpStatus: res.status,
      };
    }
    if (res.ok && res.data && typeof res.data === 'object') {
      const subjects: HeadmanSubject[] = [];
      for (const [subjectAbbrev, types] of Object.entries(res.data)) {
        if (!Array.isArray(types)) continue;
        for (const t of types) {
          subjects.push({
            subjectAbbrev,
            termHoursId: Number(t.id),
            lessonTypeAbbrev: String(t.lessonTypeAbbrev ?? 'ЛР'),
          });
        }
      }
      return { data: { hasAccess: true, subjects }, source: 'live' };
    }
    const cached = getCachedHeadman();
    if (cached?.subjects) {
      return {
        data: { hasAccess: true, subjects: cached.subjects },
        source: 'cache',
        offlineReason: res.networkError,
      };
    }
  }

  const mock = getMockHeadmanJournal();
  return {
    data: { hasAccess: mock.hasAccess, subjects: mock.subjects },
    source: 'mock',
    offlineReason: 'Демо-журнал старосты',
  };
}

export async function fetchHeadmanStudents(): Promise<ApiResult<HeadmanStudent[]>> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<Array<Record<string, unknown>>>('/headman/students');
    if (res.ok && Array.isArray(res.data)) {
      const students: HeadmanStudent[] = res.data.map((s) => ({
        studentId: Number(s.studentId ?? s.id ?? 0),
        fio: String(s.fio ?? s.fullName ?? '').trim(),
        subgroup: Number(s.subgroup ?? 0),
      }));
      return { data: students, source: 'live' };
    }
    const cached = getCachedHeadman();
    if (cached?.students) {
      return {
        data: cached.students,
        source: 'cache',
        offlineReason: res.networkError,
      };
    }
  }

  return {
    data: getMockHeadmanJournal().students,
    source: 'mock',
    offlineReason: 'Демо-список студентов',
  };
}

export async function fetchHeadmanData(
  termHoursId: number,
): Promise<ApiResult<HeadmanDataResponse>> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<HeadmanDataResponse>(
      `/headman/data?termHoursId=${encodeURIComponent(String(termHoursId))}`,
    );
    if (res.ok && res.data && typeof res.data === 'object') {
      const prev = getCachedHeadman() ?? {
        subjects: [],
        students: [],
        dataByTermHoursId: {},
      };
      setCachedHeadman({
        ...prev,
        dataByTermHoursId: {
          ...prev.dataByTermHoursId,
          [termHoursId]: res.data,
        },
      });
      return { data: res.data, source: 'live' };
    }
    const cached = getCachedHeadman()?.dataByTermHoursId[termHoursId];
    if (cached) {
      return { data: cached, source: 'cache', offlineReason: res.networkError };
    }
  }

  const mock = getMockHeadmanJournal();
  return {
    data: {
      lessons: mock.lessons.map((l) => ({
        id: l.id,
        date: l.date,
        subgroup: l.subgroup,
        numberOfHours: l.maxHours,
      })),
      attendance: mock.students.map((st) => {
        const lessonRecords: Record<string, { missedHours?: number }> = {};
        for (const l of mock.lessons) {
          lessonRecords[String(l.id)] = {
            missedHours: mock.attendance[l.id]?.[st.studentId] ?? 0,
          };
        }
        return {
          studentId: st.studentId,
          lessonRecords,
        };
      }),
    },
    source: 'mock',
    offlineReason: 'Демо-данные посещаемости',
  };
}

export async function saveHeadmanAttendance(
  payload: HeadmanCreatePayload,
): Promise<ApiResult<HeadmanJournalData>> {
  if (!isOfflineMode() && !guestModeActive) {
    const res = await performFetch<unknown>('/headman/create', {
      method: 'POST',
      body: payload,
    });
    if (res.ok) {
      const updated = mockSaveHeadmanAttendance(payload);
      return { data: updated, source: 'live' };
    }
  }

  const updated = mockSaveHeadmanAttendance(payload);
  return {
    data: updated,
    source: 'mock',
    offlineReason: 'Посещаемость сохранена локально',
  };
}
