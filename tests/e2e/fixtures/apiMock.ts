import type { Page, Route } from '@playwright/test';
import {
  ANNOUNCEMENTS,
  CERTIFICATE_PLACES,
  CERTIFICATES,
  DISRESPECTFUL_OMISSIONS,
  DORMITORY_APPLICATIONS,
  DORMITORY_PRIVILEGES,
  EMPLOYEE_SCHEDULES,
  EMPLOYEES,
  GROUP_INFO_HEADMAN,
  GROUP_INFO_REGULAR,
  GROUP_RATING_FALLBACK,
  GROUP_SCHEDULES,
  GROUP_STUDENTS_FALLBACK,
  HEADMAN_DATA_BY_TERM_HOURS,
  HEADMAN_STUDENTS,
  HEADMAN_SUBJECTS,
  LOGIN_RESPONSE_HEADMAN,
  LOGIN_RESPONSE_REGULAR,
  MARK_SHEET_SUBJECTS,
  MARK_SHEETS,
  MARKBOOK,
  NOTIFICATIONS,
  OMISSIONS,
  OMISSIONS_BY_STUDENT,
  PENALTIES,
  PERMANENT_ADDRESS,
  PERSONAL_CV,
  PERSONAL_RATING,
  STUDENT_GROUPS,
  type MockAnnouncement,
  type MockBsuirScheduleResponse,
  type MockCertificateItem,
  type MockCertificatePlaceGroup,
  type MockDeanNotification,
  type MockDisrespectfulOmissionItem,
  type MockDormitoryApplication,
  type MockDormitoryPrivilege,
  type MockEmployee,
  type MockGroupInfoResponse,
  type MockHeadmanData,
  type MockHeadmanStudent,
  type MockHeadmanSubjectItem,
  type MockMarkbookResponse,
  type MockMarkSheetItem,
  type MockMarkSheetSubject,
  type MockOmissionByStudentResponse,
  type MockOmissionEntry,
  type MockPenaltyDirective,
  type MockPersonalCv,
  type MockRatingResponse,
  type MockStudentGroup,
} from './testData';

export interface ApiMockStore {
  authenticated: boolean;
  isHeadman: boolean;
  currentWeek: number;
  studentGroups: MockStudentGroup[];
  employees: MockEmployee[];
  groupSchedules: Record<string, MockBsuirScheduleResponse>;
  employeeSchedules: Record<string, MockBsuirScheduleResponse>;
  personalCv: MockPersonalCv;
  personalRating: MockRatingResponse;
  markbook: MockMarkbookResponse;
  groupInfo: MockGroupInfoResponse;
  groupStudentsFallback: typeof GROUP_STUDENTS_FALLBACK;
  groupRatingFallback: typeof GROUP_RATING_FALLBACK;
  notifications: MockDeanNotification[];
  certificates: MockCertificateItem[];
  certificatePlaces: MockCertificatePlaceGroup[];
  markSheets: MockMarkSheetItem[];
  markSheetSubjects: MockMarkSheetSubject[];
  omissions: MockOmissionEntry[];
  omissionsByStudent: MockOmissionByStudentResponse;
  disrespectfulOmissions: MockDisrespectfulOmissionItem[];
  permanentAddress: string;
  dormitoryQueue: MockDormitoryApplication[];
  dormitoryPrivileges: MockDormitoryPrivilege[];
  penalties: MockPenaltyDirective[];
  announcements: MockAnnouncement[] | { content: MockAnnouncement[] };
  headmanSubjects: Record<string, MockHeadmanSubjectItem[]>;
  headmanStudents: MockHeadmanStudent[];
  headmanDataByTermHours: Record<number, MockHeadmanData>;
}

export interface ApiFaultOptions {
  abortAll?: boolean;
  abortPatterns?: Array<string | RegExp>;
  statusOverrides?: Record<string, number>;
  delayMs?: number;
  delayByPattern?: Record<string, number>;
  malformedJsonPatterns?: Array<string | RegExp>;
  emptyJsonPatterns?: Array<string | RegExp>;
  authSuccess?: boolean;
  loginStatus?: number;
  orviLimitReached?: boolean;
}

export interface ApiMockOptions extends ApiFaultOptions {
  startAuthenticated?: boolean;
  isHeadman?: boolean;
  extraUrlPatterns?: Array<string | RegExp>;
  payloadOverrides?: Partial<ApiMockStore>;
}

export interface RecordedApiRequest {
  method: string;
  url: string;
  pathname: string;
  postData: string | null;
  ts: number;
}

export interface ApiMockController {
  getRequests(): RecordedApiRequest[];
  getRequestsMatching(pattern: string | RegExp): RecordedApiRequest[];
  clearRequests(): void;
  getStore(): ApiMockStore;
  setFaults(patch: Partial<ApiFaultOptions>): void;
}

function deepClone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val)) as T;
}

function matchesAny(value: string, patterns?: Array<string | RegExp>): boolean {
  if (!patterns || patterns.length === 0) return false;
  return patterns.some((p) => (typeof p === 'string' ? value.includes(p) : p.test(value)));
}

function findStatusOverride(
  url: string,
  overrides?: Record<string, number>,
): number | undefined {
  if (!overrides) return undefined;
  for (const [pattern, status] of Object.entries(overrides)) {
    if (url.includes(pattern)) return status;
  }
  return undefined;
}

function findDelayOverride(
  url: string,
  defaultDelay?: number,
  byPattern?: Record<string, number>,
): number {
  if (byPattern) {
    for (const [pattern, ms] of Object.entries(byPattern)) {
      if (url.includes(pattern)) return ms;
    }
  }
  return defaultDelay ?? 0;
}

function parseJsonSafe(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildInitialStore(options: ApiMockOptions): ApiMockStore {
  const isHeadman = options.isHeadman ?? true;
  const base: ApiMockStore = {
    authenticated: options.startAuthenticated ?? false,
    isHeadman,
    currentWeek: 2,
    studentGroups: deepClone(STUDENT_GROUPS),
    employees: deepClone(EMPLOYEES),
    groupSchedules: deepClone(GROUP_SCHEDULES),
    employeeSchedules: deepClone(EMPLOYEE_SCHEDULES),
    personalCv: deepClone(PERSONAL_CV),
    personalRating: deepClone(PERSONAL_RATING),
    markbook: deepClone(MARKBOOK),
    groupInfo: deepClone(isHeadman ? GROUP_INFO_HEADMAN : GROUP_INFO_REGULAR),
    groupStudentsFallback: deepClone(GROUP_STUDENTS_FALLBACK),
    groupRatingFallback: deepClone(GROUP_RATING_FALLBACK),
    notifications: deepClone(NOTIFICATIONS),
    certificates: deepClone(CERTIFICATES),
    certificatePlaces: deepClone(CERTIFICATE_PLACES),
    markSheets: deepClone(MARK_SHEETS),
    markSheetSubjects: deepClone(MARK_SHEET_SUBJECTS),
    omissions: deepClone(OMISSIONS),
    omissionsByStudent: deepClone(OMISSIONS_BY_STUDENT),
    disrespectfulOmissions: deepClone(DISRESPECTFUL_OMISSIONS),
    permanentAddress: PERMANENT_ADDRESS,
    dormitoryQueue: deepClone(DORMITORY_APPLICATIONS),
    dormitoryPrivileges: deepClone(DORMITORY_PRIVILEGES),
    penalties: deepClone(PENALTIES),
    announcements: deepClone(ANNOUNCEMENTS),
    headmanSubjects: deepClone(HEADMAN_SUBJECTS),
    headmanStudents: deepClone(HEADMAN_STUDENTS),
    headmanDataByTermHours: deepClone(HEADMAN_DATA_BY_TERM_HOURS),
  };

  if (options.payloadOverrides) {
    return {
      ...base,
      ...deepClone(options.payloadOverrides),
    };
  }
  return base;
}

async function fulfillJson(
  route: Route,
  status: number,
  data: unknown,
  headers?: Record<string, string>,
): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    headers: {
      'Access-Control-Allow-Origin': '*',
      ...headers,
    },
    body: JSON.stringify(data),
  });
}

export async function installApiMock(
  page: Page,
  options: ApiMockOptions = {},
): Promise<ApiMockController> {
  const store = buildInitialStore(options);
  const requests: RecordedApiRequest[] = [];
  let nextId = 9000;
  const faults: ApiFaultOptions = {
    abortAll: options.abortAll,
    abortPatterns: options.abortPatterns,
    statusOverrides: options.statusOverrides,
    delayMs: options.delayMs,
    delayByPattern: options.delayByPattern,
    malformedJsonPatterns: options.malformedJsonPatterns,
    emptyJsonPatterns: options.emptyJsonPatterns,
    authSuccess: options.authSuccess ?? true,
    loginStatus: options.loginStatus,
    orviLimitReached: options.orviLimitReached,
  };

  const shouldIntercept = (urlObj: URL): boolean => {
    const href = urlObj.href;
    if (
      urlObj.pathname.startsWith('/api/v1') ||
      href.includes('/api/v1/') ||
      urlObj.hostname === 'iis.bsuir.by'
    ) {
      return true;
    }
    return matchesAny(href, options.extraUrlPatterns);
  };

  await page.route(shouldIntercept, async (route) => {
    const req = route.request();
    const urlObj = new URL(req.url());
    const pathname = urlObj.pathname;
    const method = req.method().toUpperCase();
    const postData = req.postData();

    requests.push({
      method,
      url: req.url(),
      pathname,
      postData,
      ts: Date.now(),
    });

    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
      return;
    }

    const delay = findDelayOverride(req.url(), faults.delayMs, faults.delayByPattern);
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (faults.abortAll || matchesAny(req.url(), faults.abortPatterns)) {
      await route.abort('failed');
      return;
    }

    if (matchesAny(req.url(), faults.malformedJsonPatterns)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: '{invalid_json:::',
      });
      return;
    }

    if (matchesAny(req.url(), faults.emptyJsonPatterns)) {
      await fulfillJson(route, 200, {});
      return;
    }

    const statusOverride = findStatusOverride(req.url(), faults.statusOverrides);
    if (statusOverride !== undefined) {
      await fulfillJson(route, statusOverride, {
        error: `Injected HTTP ${statusOverride}`,
        status: statusOverride,
      });
      return;
    }

    // ---- Auth ----
    if (pathname.endsWith('/auth/login') && method === 'POST') {
      if (faults.loginStatus && faults.loginStatus >= 400) {
        await fulfillJson(route, faults.loginStatus, {
          message: faults.loginStatus === 401 ? 'Unauthorized' : 'Server Error',
        });
        return;
      }
      if (!faults.authSuccess) {
        await fulfillJson(route, 401, { message: 'Invalid credentials' });
        return;
      }
      store.authenticated = true;
      const payload = store.isHeadman ? LOGIN_RESPONSE_HEADMAN : LOGIN_RESPONSE_REGULAR;
      await fulfillJson(route, 200, payload, {
        'Set-Cookie': 'JSESSIONID=mock_iis_session_123; Path=/',
      });
      return;
    }

    if (pathname.endsWith('/auth/logout')) {
      store.authenticated = false;
      await fulfillJson(route, 200, { ok: true });
      return;
    }

    // ---- BSUIR Schedule & Dictionaries ----
    if (pathname.endsWith('/student-groups')) {
      await fulfillJson(route, 200, store.studentGroups);
      return;
    }

    if (pathname.endsWith('/employees/all')) {
      await fulfillJson(route, 200, store.employees);
      return;
    }

    if (pathname.includes('/employees/schedule/')) {
      const urlId = decodeURIComponent(pathname.split('/employees/schedule/').pop() ?? '');
      const sched = store.employeeSchedules[urlId];
      if (!sched) {
        await fulfillJson(route, 404, { message: 'Employee schedule not found' });
        return;
      }
      await fulfillJson(route, 200, sched);
      return;
    }

    if (pathname.endsWith('/schedule/current-week')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: String(store.currentWeek),
      });
      return;
    }

    if (pathname.endsWith('/schedule') || pathname.endsWith('/schedules')) {
      const group = (urlObj.searchParams.get('studentGroup') ?? '510902').trim();
      const sched = store.groupSchedules[group];
      if (!sched) {
        await fulfillJson(route, 404, { message: `Group ${group} not found` });
        return;
      }
      await fulfillJson(route, 200, sched);
      return;
    }

    if (pathname.endsWith('/iCal/schedule')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/calendar; charset=utf-8',
        body: [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//BSUIR Schedule//TMA//RU',
          'BEGIN:VEVENT',
          'SUMMARY:ОАиП (ЛК)',
          'LOCATION:101-4',
          'END:VEVENT',
          'END:VCALENDAR',
        ].join('\r\n'),
      });
      return;
    }

    // ---- Academic Rating & Markbook ----
    if (pathname.endsWith('/personal-rating')) {
      await fulfillJson(route, 200, store.personalRating);
      return;
    }

    if (pathname.endsWith('/markbook')) {
      await fulfillJson(route, 200, store.markbook);
      return;
    }

    if (pathname.endsWith('/rating/group') || pathname.endsWith('/rating/last')) {
      await fulfillJson(route, 200, store.groupRatingFallback);
      return;
    }

    // ---- Group & Curator ----
    if (pathname.endsWith('/student-groups/user-group-info')) {
      await fulfillJson(route, 200, store.groupInfo);
      return;
    }

    if (pathname.endsWith('/grade-book/group-students')) {
      await fulfillJson(route, 200, store.groupStudentsFallback);
      return;
    }

    // ---- Notifications ----
    if (pathname.endsWith('/notifications/notViewed/count')) {
      const unread = store.notifications.filter((n) => !n.isViewed).length;
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: String(unread),
      });
      return;
    }

    if (pathname.endsWith('/notifications')) {
      if (method === 'PATCH') {
        const body = parseJsonSafe(postData);
        if (Array.isArray(body)) {
          for (const item of body) {
            if (item && typeof item === 'object' && 'id' in item) {
              const target = store.notifications.find(
                (n) => n.id === Number((item as { id: unknown }).id),
              );
              if (target) target.isViewed = true;
            }
          }
        }
        await fulfillJson(route, 200, { ok: true });
        return;
      }
      await fulfillJson(route, 200, { notifications: store.notifications });
      return;
    }

    // ---- Study: Certificates & Mark Sheets ----
    if (pathname.endsWith('/certificate/places')) {
      await fulfillJson(route, 200, store.certificatePlaces);
      return;
    }

    if (pathname.endsWith('/certificate/register') && method === 'POST') {
      const body = parseJsonSafe(postData) as {
        certificateCount?: number;
        certificateRequestDto?: {
          certificateType?: string;
          provisionPlace?: string;
        };
      } | null;
      const newCert: MockCertificateItem = {
        id: nextId++,
        number: 500 + store.certificates.length,
        certificateType: body?.certificateRequestDto?.certificateType ?? 'обычная',
        provisionPlace:
          body?.certificateRequestDto?.provisionPlace ?? 'По месту требования',
        dateOrder: '19.11.2026',
        issueDate: null,
        status: 2,
        rejectionReason: null,
      };
      store.certificates.unshift(newCert);
      await fulfillJson(route, 200, newCert);
      return;
    }

    if (pathname.endsWith('/certificate/close')) {
      const id = Number(urlObj.searchParams.get('id'));
      store.certificates = store.certificates.filter((c) => c.id !== id);
      await fulfillJson(route, 200, { closed: true, id });
      return;
    }

    if (pathname.endsWith('/certificate')) {
      await fulfillJson(route, 200, store.certificates);
      return;
    }

    if (pathname.endsWith('/mark-sheet/subjects')) {
      await fulfillJson(route, 200, store.markSheetSubjects);
      return;
    }

    if (pathname.endsWith('/mark-sheet/close')) {
      const id = Number(urlObj.searchParams.get('id'));
      store.markSheets = store.markSheets.filter((m) => m.id !== id);
      await fulfillJson(route, 200, { closed: true, id });
      return;
    }

    if (pathname.endsWith('/mark-sheet')) {
      if (method === 'POST') {
        const body = parseJsonSafe(postData) as {
          price?: number;
          reason?: boolean;
          hours?: string | number;
          absentDate?: string;
          subject?: { focsId?: number; thId?: number; abbrev?: string };
        } | null;
        const hrs = Number(body?.hours ?? 2) || 2;
        const goodReason = Boolean(body?.reason);
        const price =
          typeof body?.price === 'number'
            ? body.price
            : goodReason
              ? 0
              : hrs * 5.75;
        const created: MockMarkSheetItem = {
          id: nextId++,
          number: `В-2026-${nextId}`,
          subject: {
            name: body?.subject?.abbrev ?? 'ОАиП',
            abbrev: body?.subject?.abbrev ?? 'ОАиП',
            lessonTypeAbbrev: 'ЛР',
            term: 3,
          },
          employee: { fio: 'Азаров И. В.' },
          absentDate: body?.absentDate ?? '19.11.2026',
          createDate: '19.11.2026',
          expireDate: '03.12.2026',
          hours: hrs,
          price,
          reason: goodReason,
          status: 'В обработке',
          rejectionReason: null,
          term: 3,
        };
        store.markSheets.unshift(created);
        await fulfillJson(route, 200, created);
        return;
      }
      await fulfillJson(route, 200, store.markSheets);
      return;
    }

    // ---- Omissions & ORVI ----
    if (pathname.endsWith('/omissions/create') && method === 'POST') {
      if (faults.orviLimitReached) {
        await fulfillJson(route, 409, {
          message:
            'Вы превысили лимит дней на заявление студента в текущем месяце',
        });
        return;
      }
      const body = parseJsonSafe(postData) as {
        startDate?: string;
        endDate?: string;
        placeOfStay?: string;
      } | null;
      store.omissionsByStudent.omissionDtoList.unshift({
        name: 'Заявление по ОРВИ',
        note: body?.placeOfStay ?? 'Заявление студента',
        dateFrom: body?.startDate ?? '2026-11-19',
        dateTo: body?.endDate ?? '2026-11-23',
        term: '3',
        omissionCount: 4,
      });
      await fulfillJson(route, 200, { ok: true, id: nextId++ });
      return;
    }

    if (pathname.endsWith('/omissions-by-student')) {
      await fulfillJson(route, 200, store.omissionsByStudent);
      return;
    }

    if (pathname.endsWith('/disrespectful-omissions-by-student')) {
      await fulfillJson(route, 200, store.disrespectfulOmissions);
      return;
    }

    if (pathname.endsWith('/student-details/permanent-address')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(store.permanentAddress),
      });
      return;
    }

    if (pathname.endsWith('/omissions')) {
      await fulfillJson(route, 200, store.omissions);
      return;
    }

    // ---- Dormitory, Privileges, Penalties & Announcements ----
    if (pathname.endsWith('/dormitory-queue-application/privileges')) {
      await fulfillJson(route, 200, store.dormitoryPrivileges);
      return;
    }

    if (pathname.endsWith('/dormitory-queue-application/premium-penalty')) {
      await fulfillJson(route, 200, store.penalties);
      return;
    }

    if (pathname.endsWith('/dormitory-queue-application')) {
      await fulfillJson(route, 200, store.dormitoryQueue);
      return;
    }

    if (pathname.endsWith('/announcements')) {
      await fulfillJson(route, 200, store.announcements);
      return;
    }

    // ---- Headman Journal ----
    if (pathname.endsWith('/headman/subjects')) {
      if (!store.isHeadman) {
        await fulfillJson(route, 403, { message: 'Forbidden: not headman' });
        return;
      }
      await fulfillJson(route, 200, store.headmanSubjects);
      return;
    }

    if (pathname.endsWith('/headman/students')) {
      if (!store.isHeadman) {
        await fulfillJson(route, 403, { message: 'Forbidden: not headman' });
        return;
      }
      await fulfillJson(route, 200, store.headmanStudents);
      return;
    }

    if (pathname.endsWith('/headman/data')) {
      if (!store.isHeadman) {
        await fulfillJson(route, 403, { message: 'Forbidden: not headman' });
        return;
      }
      const thId = Number(urlObj.searchParams.get('termHoursId') ?? '1001');
      const data = store.headmanDataByTermHours[thId] ?? {
        lessons: [],
        attendance: [],
      };
      await fulfillJson(route, 200, data);
      return;
    }

    if (pathname.endsWith('/headman/create') && method === 'POST') {
      if (!store.isHeadman) {
        await fulfillJson(route, 403, { message: 'Forbidden: not headman' });
        return;
      }
      const body = parseJsonSafe(postData) as {
        idLesson?: number;
        studentOmissionsHoursDtoList?: Array<{ student: number; hours: number }>;
      } | null;
      const lessonId = Number(body?.idLesson ?? 0);
      if (lessonId > 0 && Array.isArray(body?.studentOmissionsHoursDtoList)) {
        for (const hd of Object.values(store.headmanDataByTermHours)) {
          if (hd.lessons.some((l) => l.id === lessonId)) {
            for (const entry of body.studentOmissionsHoursDtoList) {
              let rec = hd.attendance.find((a) => a.studentId === entry.student);
              if (!rec) {
                rec = { studentId: entry.student, lessonRecords: {} };
                hd.attendance.push(rec);
              }
              rec.lessonRecords[String(lessonId)] = { missedHours: entry.hours };
            }
          }
        }
      }
      await fulfillJson(route, 200, { ok: true });
      return;
    }

    // ---- Personal CV & Profile ----
    if (pathname.endsWith('/profiles/personal-cv')) {
      await fulfillJson(route, 200, store.personalCv);
      return;
    }

    if (pathname.endsWith('/profiles/personal-cv-published') && method === 'PUT') {
      const body = parseJsonSafe(postData) as { published?: boolean } | null;
      if (typeof body?.published === 'boolean') {
        store.personalCv.published = body.published;
      }
      await fulfillJson(route, 200, store.personalCv);
      return;
    }

    if (pathname.endsWith('/profiles/personal-cv-rating') && method === 'PUT') {
      const body = parseJsonSafe(postData) as { showRating?: boolean } | null;
      if (typeof body?.showRating === 'boolean') {
        store.personalCv.showRating = body.showRating;
      }
      await fulfillJson(route, 200, store.personalCv);
      return;
    }

    if (
      pathname.endsWith('/profiles/personal-cv-searching-job') &&
      method === 'PUT'
    ) {
      const body = parseJsonSafe(postData) as { searchJob?: boolean } | null;
      if (typeof body?.searchJob === 'boolean') {
        store.personalCv.searchJob = body.searchJob;
      }
      await fulfillJson(route, 200, store.personalCv);
      return;
    }

    if (pathname.endsWith('/profiles/summary') && method === 'PUT') {
      const body = parseJsonSafe(postData) as { summary?: string } | null;
      if (typeof body?.summary === 'string') {
        store.personalCv.summary = body.summary;
      }
      await fulfillJson(route, 200, store.personalCv);
      return;
    }

    if (pathname.endsWith('/profiles/my-skills') && method === 'POST') {
      const body = parseJsonSafe(postData);
      if (Array.isArray(body)) {
        store.personalCv.skills = body.map((s, idx) => ({
          id: Number((s as { id?: number }).id) || idx + 100,
          name: String((s as { name?: string }).name ?? ''),
        }));
      }
      await fulfillJson(route, 200, store.personalCv.skills);
      return;
    }

    if (pathname.endsWith('/profiles/my-references') && method === 'PUT') {
      const body = parseJsonSafe(postData);
      if (Array.isArray(body)) {
        store.personalCv.references = body.map((r, idx) => ({
          id: Number((r as { id?: number }).id) || idx + 100,
          name: String((r as { name?: string }).name ?? ''),
          reference: String((r as { reference?: string }).reference ?? ''),
        }));
      }
      await fulfillJson(route, 200, store.personalCv.references);
      return;
    }

    await fulfillJson(route, 404, {
      error: `Unmocked endpoint: ${method} ${pathname}`,
    });
  });

  return {
    getRequests() {
      return [...requests];
    },
    getRequestsMatching(pattern: string | RegExp) {
      return requests.filter((r) =>
        typeof pattern === 'string' ? r.url.includes(pattern) : pattern.test(r.url),
      );
    },
    clearRequests() {
      requests.length = 0;
    },
    getStore() {
      return store;
    },
    setFaults(patch: Partial<ApiFaultOptions>) {
      Object.assign(faults, patch);
    },
  };
}
