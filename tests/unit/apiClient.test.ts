import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TIMEOUT_MS,
  closeCertificate,
  closeMarkSheet,
  configureApiBaseUrl,
  createMarkSheet,
  createOrviOmission,
  fetchCertificates,
  fetchDormitoryPrivileges,
  fetchGroupInfo,
  fetchGroupRating,
  fetchGroupSchedule,
  fetchMarkSheets,
  fetchNotifications,
  fetchOmissions,
  fetchPenalties,
  fetchPersonalCv,
  getApiBaseUrl,
  isOfflineMode,
  login,
  markNotificationsRead,
  registerCertificate,
  saveHeadmanAttendance,
  setForceOfflineMode,
  setGuestModeHint,
  setReloginCredentialsProvider,
  updateCvSection,
  updateCvSkills,
} from '../../src/services/apiClient';
import { resetMockStore } from '../../src/services/mockData';
import {
  getCachedNotifications,
  setCachedOmissions,
} from '../../src/services/storage';

describe('apiClient & mockData (F6)', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMockStore();
    configureApiBaseUrl('');
    setForceOfflineMode(false);
    setGuestModeHint(false);
    setReloginCredentialsProvider(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('supports configurable API base URL and never injects Cookie or User-Agent headers', async () => {
    expect(getApiBaseUrl()).toBe('/api/v1');
    configureApiBaseUrl('https://proxy.example.com/api/v1/');
    expect(getApiBaseUrl()).toBe('https://proxy.example.com/api/v1');

    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          schedules: { Понедельник: [] },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const res = await fetchGroupSchedule('114001'); // normalizes to 310101
    expect(res.source).toBe('live');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://proxy.example.com/api/v1/schedule?studentGroup=310101');
    expect(init.credentials).toBe('include');
    const headers = (init.headers ?? {}) as Record<string, string>;
    const headerKeysLower = Object.keys(headers).map((k) => k.toLowerCase());
    expect(headerKeysLower).not.toContain('cookie');
    expect(headerKeysLower).not.toContain('user-agent');
  });

  it('falls back seamlessly to mock data on CORS/network TypeError without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch (CORS)')),
    );

    const res = await fetchGroupSchedule('310101');
    expect(res.source).toBe('mock');
    expect(res.offlineReason).toContain('CORS');
    expect(res.data.schedules?.Понедельник?.length).toBeGreaterThan(0);
  });

  it('aborts after 4.5s timeout and falls back to mock/cache', async () => {
    vi.useFakeTimers();

    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      }),
    );

    const pending = fetchGroupSchedule('351001');
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS + 50);
    const res = await pending;
    expect(res.source).toBe('mock');
    expect(res.offlineReason).toContain('4.5');
  });

  it('performs single-flight 401 auto-relogin once for concurrent requests', async () => {
    setReloginCredentialsProvider(() => ({ username: '31010103', password: 'secret' }));
    let authCalls = 0;
    let certCalls = 0;
    let notifCalls = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/auth/login')) {
          authCalls += 1;
          return new Response(JSON.stringify({ fio: 'Student' }), { status: 200 });
        }
        if (url.includes('/certificate')) {
          certCalls += 1;
          if (certCalls === 1) return new Response('', { status: 401 });
          return new Response(JSON.stringify([{ id: 1, number: 100, status: 1 }]), {
            status: 200,
          });
        }
        if (url.includes('/notifications')) {
          notifCalls += 1;
          if (notifCalls === 1) return new Response('', { status: 401 });
          return new Response(JSON.stringify({ notifications: [] }), { status: 200 });
        }
        return new Response('{}', { status: 200 });
      }),
    );

    const [certs, notifs] = await Promise.all([
      fetchCertificates(),
      fetchNotifications(),
    ]);

    expect(authCalls).toBe(1);
    expect(certs.source).toBe('live');
    expect(notifs.source).toBe('live');
  });

  it('returns invalid credentials error on live login 401 without faking success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 })),
    );

    const res = await login('31010103', 'wrong-pass');
    expect(res.ok).toBe(false);
    expect(res.error).toBe('Неверный логин или пароль');
    expect(res.status).toBe(401);
  });

  it('maps HTTP 409 on live ORVI and enforces monthly day cap in stateful mock mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Conflict', { status: 409 })),
    );
    const liveConflict = await createOrviOmission({
      file: null,
      startDate: '2025-10-10',
      endDate: '2025-10-14',
      placeOfStay: 'г. Минск',
      signature: 'data:image/png;base64,AAA',
    });
    expect(liveConflict.ok).toBe(false);
    expect(liveConflict.conflictLimitExceeded).toBe(true);

    // Mock mode: initial store already has 2 days in 2025-10 (limit = 5)
    setForceOfflineMode(true);
    expect(isOfflineMode()).toBe(true);

    const okRes = await createOrviOmission({
      file: null,
      startDate: '2025-10-20',
      endDate: '2025-10-21', // +2 days => total 4 <= 5
      placeOfStay: 'Общежитие №2',
      signature: 'data:image/png;base64,BBB',
    });
    expect(okRes.ok).toBe(true);

    const exceededRes = await createOrviOmission({
      file: null,
      startDate: '2025-10-25',
      endDate: '2025-10-26', // +2 days => total 6 > 5
      placeOfStay: 'Общежитие №2',
      signature: 'data:image/png;base64,CCC',
    });
    expect(exceededRes.ok).toBe(false);
    expect(exceededRes.conflictLimitExceeded).toBe(true);
  });

  it('persists stateful mock mutations (5.75 BYN/h mark sheets, certs, notifs, CV, headman) in localStorage', async () => {
    setForceOfflineMode(true);

    const msRes = await createMarkSheet({
      price: 0, // client enforces hours * 5.75 when reason=false
      reason: false,
      hours: '4',
      absentDate: '19.10.2025',
      subject: { thId: 1001 },
    });
    expect(msRes.source).toBe('mock');
    expect(msRes.data[0].price).toBe(23);
    expect(msRes.data[0].hours).toBe(4);
    const createdMsId = msRes.data[0].id;

    // Verify persistence on fresh read
    expect((await fetchMarkSheets()).data[0].price).toBe(23);
    await closeMarkSheet(createdMsId);
    expect((await fetchMarkSheets()).data.some((m) => m.id === createdMsId)).toBe(false);

    // Certificates
    const certRes = await registerCertificate({
      certificateCount: 1,
      certificateRequestDto: {
        certificateType: 'Гербовая',
        provisionPlace: 'В посольство',
      },
    });
    const newCertId = certRes.data[0].id;
    expect(certRes.data[0].status).toBe(2);
    await closeCertificate(newCertId);
    expect((await fetchCertificates()).data.some((c) => c.id === newCertId)).toBe(false);

    // Notifications read
    await markNotificationsRead([101, 102]);
    const notifs = await fetchNotifications();
    expect(notifs.data.every((n) => n.isViewed)).toBe(true);

    // CV & skills
    await updateCvSection('personal-cv-published', { published: false });
    await updateCvSkills([{ name: 'Vitest' }]);
    const cv = await fetchPersonalCv();
    expect(cv.data.published).toBe(false);
    expect(cv.data.skills.map((s) => s.name)).toEqual(['Vitest']);

    // Headman attendance
    const hm = await saveHeadmanAttendance({
      idLesson: 9001,
      studentOmissionsHoursDtoList: [{ student: 700, hours: 2 }],
    });
    expect(hm.data.attendance[9001][700]).toBe(2);
  });

  it('normalizes legacy Android fallback fields (omissions, penalties, privileges, groupInfo)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/omissions-by-student')) {
          return new Response(JSON.stringify({ omissionDtoList: [] }), { status: 200 });
        }
        if (url.includes('/disrespectful-omissions-by-student')) {
          return new Response(JSON.stringify([{ omissionCount: 4 }]), { status: 200 });
        }
        if (url.includes('/omissions')) {
          return new Response(
            JSON.stringify({
              omissions: [
                {
                  student: {
                    lessons: [
                      {
                        missedHours: 4,
                        respectful: false,
                        date: '14.10.2025',
                        lessonName: 'КС',
                        type: 'ЛР',
                        reason: 'Неявка',
                        employee: 'Смирнов А.В.',
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (url.includes('/dormitory-queue-application/privileges')) {
          return new Response(
            JSON.stringify([
              {
                id: 1,
                year: 2025,
                dormitoryPrivilegeCategoryName: 'Категория А',
                dormitoryPrivilegeName: 'Льгота 1',
              },
            ]),
            { status: 200 },
          );
        }
        if (url.includes('/dormitory-queue-application/premium-penalty')) {
          return new Response(
            JSON.stringify([
              {
                id: 5,
                directiveDto: {
                  typeName: 'Благодарность',
                  date: '01.05.2025',
                  number: '№10',
                },
                reason: 'Успехи',
                status: 'Активен',
              },
            ]),
            { status: 200 },
          );
        }
        if (url.includes('/student-groups/user-group-info')) {
          return new Response(
            JSON.stringify({
              studentGroupCuratorDto: { fio: 'Куратор К.К.' },
              groupInfoStudentDto: [
                { fio: 'Иванов Иван', position: 'Староста', averageMark: 8.8 },
                { fio: 'Петров Пётр', position: 'Зам. старосты', averageMark: 8.1 },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response('[]', { status: 200 });
      }),
    );

    const om = await fetchOmissions();
    expect(om.source).toBe('live');
    expect(om.data.unexcusedHours).toBe(4);
    expect(om.data.lessons[0].subject).toBe('КС');

    const priv = await fetchDormitoryPrivileges();
    expect(priv.data[0].categoryName).toBe('Категория А');
    expect(priv.data[0].privilegeName).toBe('Льгота 1');

    const pen = await fetchPenalties();
    expect(pen.data[0].type).toBe('Благодарность');
    expect(pen.data[0].directiveNumber).toBe('№10');

    const grp = await fetchGroupInfo('310101', 'Иванов Иван');
    expect(grp.data.isHeadman).toBe(true);
    const deputy = await fetchGroupInfo('310101', 'Петров Пётр');
    expect(deputy.data.isHeadman).toBe(false);
  });

  it('BUG-1 regression: live markNotificationsRead updates live/cached notifications without injecting mock items', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/notifications') && (!init?.method || init.method === 'GET')) {
        return new Response(
          JSON.stringify({
            notifications: [
              {
                id: 9999,
                message: 'Живое уведомление деканата',
                date: '20.10.2025',
                type: 'INFO',
                isViewed: false,
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes('/notifications') && init?.method === 'PATCH') {
        return new Response('', { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const initial = await fetchNotifications();
    expect(initial.source).toBe('live');
    expect(initial.data.map((n) => n.id)).toEqual([9999]);

    const marked = await markNotificationsRead([9999]);
    expect(marked.source).toBe('live');
    expect(marked.data.map((n) => n.id)).toEqual([9999]);
    expect(marked.data[0].isViewed).toBe(true);
    expect(getCachedNotifications()?.map((n) => n.id)).toEqual([9999]);
    expect(getCachedNotifications()?.[0].isViewed).toBe(true);

    // Also works cleanly when cache is empty prior to live PATCH
    localStorage.clear();
    const markedCold = await markNotificationsRead([9999]);
    expect(markedCold.source).toBe('live');
    expect(markedCold.data.map((n) => n.id)).toEqual([9999]);
    expect(markedCold.data[0].isViewed).toBe(true);
  });

  it('BUG-2 regression: offline createOrviOmission updates CACHE_KEY_IIS_OMISSIONS so fetchOmissions sees new hours', async () => {
    // Simulate previously cached online omissions with 10 total hours
    setCachedOmissions({
      totalHours: 10,
      unexcusedHours: 2,
      lessons: [],
      excuseDocuments: [],
      monthlyHours: { Окт: 10 },
      monthlyUnexcusedHours: { Окт: 2 },
      monthlyData: { Окт: 10 },
      monthlyUnexcusedData: { Окт: 2 },
    });

    setForceOfflineMode(true);
    const created = await createOrviOmission({
      file: null,
      startDate: '2025-10-20',
      endDate: '2025-10-20', // +1 day => +4 hours (mock base 10 -> 14)
      placeOfStay: 'г. Минск',
      signature: 'data:image/png;base64,AAA',
    });
    expect(created.ok).toBe(true);

    const refreshed = await fetchOmissions();
    expect(refreshed.data.totalHours).toBe(14);
    expect(refreshed.data.excuseDocuments[0].hoursClosed).toBe(4);
  });

  it('BUG-4 regression: fetchGroupRating and fetchGroupInfo short-circuit on networkError/timeout after 1 call', async () => {
    vi.useFakeTimers();

    const calledUrls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        calledUrls.push(url);
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      }),
    );

    const ratingPromise = fetchGroupRating('310101');
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS + 50);
    const ratingRes = await ratingPromise;
    expect(ratingRes.source).toBe('mock');
    expect(calledUrls).toHaveLength(1);

    calledUrls.length = 0;
    const groupPromise = fetchGroupInfo('310101');
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS + 50);
    const groupRes = await groupPromise;
    expect(groupRes.source).toBe('mock');
    expect(calledUrls).toHaveLength(1);

    vi.useRealTimers();

    // Non-network HTTP 404 still falls back across endpoints
    const fallbackUrls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        fallbackUrls.push(url);
        if (url.includes('/rating/last')) {
          return new Response('Not Found', { status: 404 });
        }
        return new Response(JSON.stringify({ rating: 9.1, place: 1 }), { status: 200 });
      }),
    );
    const rating404Fallback = await fetchGroupRating('310101');
    expect(rating404Fallback.source).toBe('live');
    expect(rating404Fallback.data.rating).toBe(9.1);
    expect(fallbackUrls).toHaveLength(2);
  });
});
