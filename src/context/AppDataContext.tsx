import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  AcademicSubjectProgress,
  AnnouncementItem,
  AuthMode,
  BsuirEmployee,
  BsuirScheduleResponse,
  BsuirStudentGroup,
  CertificateDto,
  CertificatePlaceGroup,
  CertificateRegisterPayload,
  CuratorDto,
  CvReference,
  CvSkill,
  DataSource,
  DeanNotification,
  DormitoryApplicationDto,
  DormitoryPrivilegeDto,
  GroupStudentDto,
  HeadmanCreatePayload,
  HeadmanDataResponse,
  HeadmanStudent,
  HeadmanSubject,
  Lesson,
  MarkSheetCreatePayload,
  MarkSheetDto,
  MarkSheetSubjectDto,
  MarkbookResponse,
  Note,
  OmissionsSummary,
  OrviOmissionPayload,
  OrviOmissionResult,
  PenaltyDirectiveDto,
  PersonalCvDto,
  ProfileCvSectionEndpoint,
  ScheduleTargetKind,
  SearchHistoryEntry,
  UserProfileSummary,
} from '../types';
import * as apiClient from '../services/apiClient';
import {
  DEFAULT_GROUP_NUMBER,
  addNote as storageAddNote,
  addSearchHistory as storageAddSearchHistory,
  clearPrivateIisCaches,
  deleteNote as storageDeleteNote,
  getCachedProfile,
  getCachedSchedule,
  getStorageSyncSnapshot,
  hydrateCloudState,
  logoutAndClearAuth,
  removeSearchHistoryItem as storageRemoveSearchHistoryItem,
  sanitizeGroupNumber,
  saveAuthSession,
  saveDateRailVisible,
  saveNetworkPrefs,
  saveSelectedEmployee,
  saveSelectedGroup,
  saveSubgroup,
  setCachedProfile,
  setCustomAvatar as storageSetCustomAvatar,
  togglePinNote as storageTogglePinNote,
  updateNote as storageUpdateNote,
} from '../services/storage';
import {
  getBsuirWeekForCalendarDay,
  isSessionPeriodActive,
  parseScheduleResponse,
} from '../utils/scheduleMath';

// ==================== Slice Types ====================

export interface ProfileSlice extends UserProfileSummary {
  customAvatarDataUrl: string | null;
}

export interface AcademicProgressSlice {
  subjects: AcademicSubjectProgress[];
  rating: number | null;
  place: number | null;
  loading: boolean;
}

export interface MarkbookSlice {
  data: MarkbookResponse | null;
  loading: boolean;
}

export interface GroupInfoSlice {
  curator: CuratorDto | null;
  students: GroupStudentDto[];
  loading: boolean;
}

export interface OmissionsSlice {
  data: OmissionsSummary | null;
  loading: boolean;
}

export interface NotificationsSlice {
  items: DeanNotification[];
  unreadCount: number;
  loading: boolean;
}

export interface StudySlice {
  certificates: CertificateDto[];
  certPlaces: CertificatePlaceGroup[];
  markSheets: MarkSheetDto[];
  markSheetSubjects: MarkSheetSubjectDto[];
  loading: boolean;
}

export interface DormitorySlice {
  applications: DormitoryApplicationDto[];
  privileges: DormitoryPrivilegeDto[];
  loading: boolean;
}

export interface PenaltiesSlice {
  items: PenaltyDirectiveDto[];
  loading: boolean;
}

export interface PersonalCvSlice {
  data: PersonalCvDto | null;
  loading: boolean;
}

export interface AnnouncementsSlice {
  items: AnnouncementItem[];
  loading: boolean;
}

export interface HeadmanSlice {
  hasAccess: boolean;
  subjects: HeadmanSubject[];
  students: HeadmanStudent[];
  dataByTermHoursId: Record<number, HeadmanDataResponse>;
  loading: boolean;
}

export interface AppDataContextValue {
  // Auth & Profile
  authMode: AuthMode;
  isAuthenticated: boolean;
  isLoggedIn: boolean;
  username: string | null;
  profile: ProfileSlice;

  // Connection / Data Source Banner
  dataSource: DataSource;
  isOfflineMode: boolean;
  forceOffline: boolean;
  offlineReason: string | null;
  apiBaseUrl: string;

  // Schedule State
  selectedGroup: string;
  selectedEmployee: { urlId: string; fullName: string } | null;
  effectiveTarget: string;
  subgroup: 0 | 1 | 2;
  selectedDayIndex: number;
  dateRailVisible: boolean;
  isSessionMode: boolean;
  currentWeek: 1 | 2 | 3 | 4;
  lessons: Lesson[];
  exams: Lesson[];
  sessionPeriod: { startExamsDate: string; endExamsDate: string };
  isSessionAutoActive: boolean;
  employeeSchedules: Record<string, BsuirScheduleResponse>;
  allGroups: BsuirStudentGroup[];
  allEmployees: BsuirEmployee[];
  searchHistory: SearchHistoryEntry[];
  isScheduleLoading: boolean;
  isScheduleRefreshing: boolean;

  // Notes
  notes: Note[];
  availableSubjects: string[];

  // IIS Cabinet Slices
  academicProgress: AcademicProgressSlice;
  markbook: MarkbookSlice;
  groupInfo: GroupInfoSlice;
  omissions: OmissionsSlice;
  notifications: NotificationsSlice;
  study: StudySlice;
  dormitory: DormitorySlice;
  penalties: PenaltiesSlice;
  personalCv: PersonalCvSlice;
  announcements: AnnouncementsSlice;
  headman: HeadmanSlice;

  // Auth Actions
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;

  // Schedule Actions
  selectGroup: (group: string, addToHistory?: boolean) => Promise<void>;
  selectEmployee: (
    emp: { urlId: string; fullName: string } | null,
    addToHistory?: boolean,
  ) => Promise<void>;
  setSubgroup: (sg: 0 | 1 | 2) => Promise<void>;
  setSelectedDayIndex: (idx: number) => void;
  resetToToday: () => void;
  setDateRailVisible: (visible: boolean) => Promise<void>;
  setSessionMode: (active: boolean) => void;
  refreshSchedule: (force?: boolean) => Promise<void>;
  removeFromSearchHistory: (id: string, kind?: ScheduleTargetKind) => Promise<void>;

  // Notes Actions
  addNote: (input: Omit<Note, 'id'> & { id?: string }) => Promise<Note[]>;
  updateNote: (id: string, patch: Partial<Omit<Note, 'id'>>) => Promise<Note[]>;
  deleteNote: (id: string) => Promise<Note[]>;
  togglePinNote: (id: string) => Promise<Note[]>;

  // Network / Settings Actions
  setForceOfflineMode: (force: boolean) => Promise<void>;
  setApiBaseUrl: (url: string) => Promise<void>;

  // IIS Service Actions
  refreshProfile: () => Promise<void>;
  loadMarksAndRating: (force?: boolean) => Promise<void>;
  loadMarkbook: (force?: boolean) => Promise<void>;
  loadGroupInfo: (force?: boolean) => Promise<void>;
  loadOmissions: (force?: boolean) => Promise<void>;
  submitOrviOmission: (payload: OrviOmissionPayload) => Promise<OrviOmissionResult>;
  loadNotifications: (force?: boolean) => Promise<void>;
  markNotificationsRead: (ids: number[]) => Promise<void>;
  loadStudyData: (force?: boolean) => Promise<void>;
  orderCertificate: (payload: CertificateRegisterPayload) => Promise<void>;
  cancelCertificate: (id: number) => Promise<void>;
  createMarkSheet: (payload: MarkSheetCreatePayload) => Promise<void>;
  closeMarkSheet: (id: number) => Promise<void>;
  loadDormitoryData: (force?: boolean) => Promise<void>;
  loadPenalties: (force?: boolean) => Promise<void>;
  loadPersonalCv: (force?: boolean) => Promise<void>;
  updatePersonalCvSection: (
    endpoint: ProfileCvSectionEndpoint,
    patch: Partial<PersonalCvDto>,
  ) => Promise<void>;
  updatePersonalCvSkills: (skills: Array<{ id?: number; name: string }>) => Promise<void>;
  updatePersonalCvReferences: (
    refs: Array<{ id?: number; name: string; reference: string }>,
  ) => Promise<void>;
  loadAnnouncements: (force?: boolean) => Promise<void>;
  loadHeadmanInit: () => Promise<void>;
  loadHeadmanAttendance: (termHoursId: number) => Promise<void>;
  saveHeadmanAttendance: (payload: HeadmanCreatePayload) => Promise<void>;
  setCustomAvatar: (dataUrl: string | null) => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

function emptyProfile(group: string, customAvatarDataUrl: string | null = null): ProfileSlice {
  return {
    fio: '',
    desc: '',
    group,
    photo: '',
    birthDate: '',
    isHeadman: false,
    unreadNotifCount: 0,
    unexcusedHours: 0,
    customAvatarDataUrl,
  };
}

function guestProfile(group: string): ProfileSlice {
  return {
    fio: 'Гость',
    desc: 'Вход не выполнен',
    group,
    photo: '',
    birthDate: '',
    isHeadman: false,
    unreadNotifCount: 0,
    unexcusedHours: 0,
    customAvatarDataUrl: null,
  };
}

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialSnapshot = useMemo(() => getStorageSyncSnapshot(), []);

  // Auth & Profile
  const [authMode, setAuthMode] = useState<AuthMode>(initialSnapshot.authSession.authMode);
  const [username, setUsername] = useState<string | null>(initialSnapshot.authSession.username);
  const [profile, setProfile] = useState<ProfileSlice>(() => {
    if (initialSnapshot.authSession.authMode === 'guest') {
      return guestProfile(initialSnapshot.schedulePrefs.selectedGroup);
    }
    if (initialSnapshot.profileCache) {
      return {
        ...initialSnapshot.profileCache,
        customAvatarDataUrl: initialSnapshot.customAvatar,
      };
    }
    return emptyProfile(
      initialSnapshot.schedulePrefs.selectedGroup,
      initialSnapshot.customAvatar,
    );
  });

  // Network / DataSource
  const [apiBaseUrl, setApiBaseUrlState] = useState<string>(() => {
    if (initialSnapshot.networkPrefs.apiBaseUrl) {
      apiClient.configureApiBaseUrl(initialSnapshot.networkPrefs.apiBaseUrl);
    }
    return apiClient.getApiBaseUrl();
  });
  const [forceOffline, setForceOfflineState] = useState<boolean>(() => {
    apiClient.setForceOfflineMode(initialSnapshot.networkPrefs.forceOffline);
    return initialSnapshot.networkPrefs.forceOffline;
  });
  const [dataSource, setDataSource] = useState<DataSource>(
    initialSnapshot.networkPrefs.forceOffline ? 'mock' : 'live',
  );
  const [offlineReason, setOfflineReason] = useState<string | null>(
    initialSnapshot.networkPrefs.forceOffline ? 'Автономный режим включён' : null,
  );

  // Schedule State
  const [selectedGroup, setSelectedGroupState] = useState<string>(
    initialSnapshot.schedulePrefs.selectedGroup,
  );
  const [selectedEmployee, setSelectedEmployeeState] = useState<{
    urlId: string;
    fullName: string;
  } | null>(initialSnapshot.schedulePrefs.selectedEmployee);
  const [subgroup, setSubgroupState] = useState<0 | 1 | 2>(
    initialSnapshot.schedulePrefs.subgroup,
  );
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(7);
  const [dateRailVisible, setDateRailVisibleState] = useState<boolean>(
    initialSnapshot.schedulePrefs.dateRailVisible,
  );
  const [isSessionMode, setSessionMode] = useState<boolean>(false);

  const effectiveTarget = selectedEmployee?.urlId ?? selectedGroup;

  const initialScheduleCache = useMemo(() => {
    const cacheKey = selectedEmployee
      ? `emp_${selectedEmployee.urlId}`
      : selectedGroup;
    return getCachedSchedule(cacheKey);
  }, []); // initial only

  const [lessons, setLessons] = useState<Lesson[]>(initialScheduleCache?.lessons ?? []);
  const [exams, setExams] = useState<Lesson[]>(initialScheduleCache?.exams ?? []);
  const [sessionPeriod, setSessionPeriod] = useState<{
    startExamsDate: string;
    endExamsDate: string;
  }>({
    startExamsDate: initialScheduleCache?.startExamsDate ?? '',
    endExamsDate: initialScheduleCache?.endExamsDate ?? '',
  });
  const [employeeSchedules, setEmployeeSchedules] = useState<
    Record<string, BsuirScheduleResponse>
  >({});
  const [allGroups, setAllGroups] = useState<BsuirStudentGroup[]>([]);
  const [allEmployees, setAllEmployees] = useState<BsuirEmployee[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>(
    initialSnapshot.searchHistory,
  );
  const [isScheduleLoading, setIsScheduleLoading] = useState<boolean>(false);
  const [isScheduleRefreshing, setIsScheduleRefreshing] = useState<boolean>(false);

  // Notes
  const [notes, setNotes] = useState<Note[]>(initialSnapshot.notes);

  // IIS Cabinet Slices
  const [academicProgress, setAcademicProgress] = useState<AcademicProgressSlice>({
    subjects: [],
    rating: null,
    place: null,
    loading: false,
  });
  const [markbook, setMarkbook] = useState<MarkbookSlice>({
    data: null,
    loading: false,
  });
  const [groupInfo, setGroupInfo] = useState<GroupInfoSlice>({
    curator: null,
    students: [],
    loading: false,
  });
  const [omissions, setOmissions] = useState<OmissionsSlice>({
    data: null,
    loading: false,
  });
  const [notifications, setNotifications] = useState<NotificationsSlice>({
    items: [],
    unreadCount: 0,
    loading: false,
  });
  const [study, setStudy] = useState<StudySlice>({
    certificates: [],
    certPlaces: [],
    markSheets: [],
    markSheetSubjects: [],
    loading: false,
  });
  const [dormitory, setDormitory] = useState<DormitorySlice>({
    applications: [],
    privileges: [],
    loading: false,
  });
  const [penalties, setPenalties] = useState<PenaltiesSlice>({
    items: [],
    loading: false,
  });
  const [personalCv, setPersonalCv] = useState<PersonalCvSlice>({
    data: null,
    loading: false,
  });
  const [announcements, setAnnouncements] = useState<AnnouncementsSlice>({
    items: [],
    loading: false,
  });
  const [headman, setHeadman] = useState<HeadmanSlice>({
    hasAccess: false,
    subjects: [],
    students: [],
    dataByTermHoursId: {},
    loading: false,
  });

  // Per-slice CloudStorage mutation guards (so async CloudStorage hydration never clobbers user actions)
  const hasMutatedNotesRef = useRef(false);
  const hasMutatedHistoryRef = useRef(false);
  const hasMutatedSchedulePrefsRef = useRef(false);
  const hasMutatedAuthRef = useRef(false);
  const hasMutatedNetworkRef = useRef(false);

  // Ephemeral in-memory credentials for single-flight 401 auto-relogin (never persisted)
  const ephemeralCredsRef = useRef<{ username: string; password: string } | null>(null);
  const authGenerationRef = useRef(0);
  const scheduleRequestIdRef = useRef(0);
  const prewarmedTeachersRef = useRef<Set<string>>(new Set());

  // Sync guest hint into apiClient
  useEffect(() => {
    apiClient.setGuestModeHint(authMode === 'guest');
  }, [authMode]);

  // Register ephemeral credentials provider
  useEffect(() => {
    apiClient.setReloginCredentialsProvider(() => ephemeralCredsRef.current);
    return () => {
      apiClient.setReloginCredentialsProvider(null);
    };
  }, []);

  // Reconcile async CloudStorage state once on mount
  useEffect(() => {
    let cancelled = false;
    hydrateCloudState()
      .then((hydrated) => {
        if (cancelled) return;
        if (!hasMutatedNotesRef.current) {
          setNotes(hydrated.notes);
        }
        if (!hasMutatedHistoryRef.current) {
          setSearchHistory(hydrated.searchHistory);
        }
        const hydratedGroup = !hasMutatedSchedulePrefsRef.current
          ? hydrated.schedulePrefs.selectedGroup
          : selectedGroup;
        if (!hasMutatedSchedulePrefsRef.current) {
          setSelectedGroupState(hydrated.schedulePrefs.selectedGroup);
          setSelectedEmployeeState(hydrated.schedulePrefs.selectedEmployee);
          setSubgroupState(hydrated.schedulePrefs.subgroup);
          setDateRailVisibleState(hydrated.schedulePrefs.dateRailVisible);
        }
        if (!hasMutatedAuthRef.current) {
          setAuthMode(hydrated.authSession.authMode);
          setUsername(hydrated.authSession.username);
          if (hydrated.authSession.authMode === 'guest') {
            setProfile((prev) => (prev.fio ? prev : guestProfile(hydratedGroup)));
          } else if (hydrated.authSession.authMode === 'authenticated') {
            const cachedProf = getCachedProfile();
            if (cachedProf) {
              setProfile((prev) => ({
                ...cachedProf,
                customAvatarDataUrl: prev.customAvatarDataUrl,
              }));
            } else {
              const fallbackLabel =
                (hydrated.authSession.username ?? '').trim() || 'Студент';
              const fallbackGroup = sanitizeGroupNumber(
                hydrated.authSession.loginGroup,
                hydratedGroup,
              );
              setProfile((prev) =>
                prev.fio
                  ? prev
                  : {
                      ...emptyProfile(fallbackGroup, prev.customAvatarDataUrl),
                      fio: fallbackLabel,
                      desc: `Группа ${fallbackGroup}`,
                    },
              );
            }
          }
        }
        if (!hasMutatedNetworkRef.current) {
          apiClient.configureApiBaseUrl(hydrated.networkPrefs.apiBaseUrl);
          apiClient.setForceOfflineMode(hydrated.networkPrefs.forceOffline);
          setApiBaseUrlState(apiClient.getApiBaseUrl());
          setForceOfflineState(hydrated.networkPrefs.forceOffline);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  // Load catalogs once on mount
  useEffect(() => {
    let cancelled = false;
    Promise.all([apiClient.fetchStudentGroups(), apiClient.fetchEmployees()])
      .then(([groupsRes, empsRes]) => {
        if (cancelled) return;
        setAllGroups(groupsRes.data);
        setAllEmployees(empsRes.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const applyDataSourceMeta = useCallback(
    (source: DataSource, reason?: string) => {
      setDataSource(source);
      if (source === 'live') {
        setOfflineReason(null);
      } else if (reason) {
        setOfflineReason(reason);
      }
    },
    [],
  );

  const prewarmEmployeeSchedules = useCallback((parsedLessons: Lesson[]) => {
    const uniqueIds = Array.from(
      new Set(
        parsedLessons
          .map((l) => l.teacherUrlId.trim())
          .filter((id) => Boolean(id) && !prewarmedTeachersRef.current.has(id)),
      ),
    ).slice(0, 8);

    for (const urlId of uniqueIds) {
      prewarmedTeachersRef.current.add(urlId);
      apiClient
        .fetchEmployeeSchedule(urlId)
        .then((res) => {
          setEmployeeSchedules((prev) => ({ ...prev, [urlId]: res.data }));
        })
        .catch(() => undefined);
    }
  }, []);

  const loadScheduleForTarget = useCallback(
    async (
      group: string,
      employee: { urlId: string; fullName: string } | null,
      isRefresh = false,
    ) => {
      const reqId = ++scheduleRequestIdRef.current;
      const cacheKey = employee ? `emp_${employee.urlId}` : sanitizeGroupNumber(group);
      const cached = getCachedSchedule(cacheKey);
      if (cached) {
        setLessons(cached.lessons);
        setExams(cached.exams);
        setSessionPeriod({
          startExamsDate: cached.startExamsDate,
          endExamsDate: cached.endExamsDate,
        });
      }

      if (isRefresh) {
        setIsScheduleRefreshing(true);
      } else {
        setIsScheduleLoading(true);
      }

      try {
        const res = employee
          ? await apiClient.fetchEmployeeSchedule(employee.urlId)
          : await apiClient.fetchGroupSchedule(group);

        if (scheduleRequestIdRef.current !== reqId) return;

        const parsed = parseScheduleResponse(res.data);
        setLessons(parsed.lessons);
        setExams(parsed.exams);
        setSessionPeriod({
          startExamsDate: (res.data.startExamsDate ?? '').trim(),
          endExamsDate: (res.data.endExamsDate ?? '').trim(),
        });
        applyDataSourceMeta(res.source, res.offlineReason);

        if (employee) {
          setEmployeeSchedules((prev) => ({ ...prev, [employee.urlId]: res.data }));
        } else {
          prewarmEmployeeSchedules(parsed.lessons);
        }
      } finally {
        if (scheduleRequestIdRef.current === reqId) {
          setIsScheduleLoading(false);
          setIsScheduleRefreshing(false);
        }
      }
    },
    [applyDataSourceMeta, prewarmEmployeeSchedules],
  );

  // Auto-load schedule when effectiveTarget or forceOffline changes
  useEffect(() => {
    void loadScheduleForTarget(selectedGroup, selectedEmployee, false);
  }, [selectedGroup, selectedEmployee, forceOffline, loadScheduleForTarget]);

  const resetPrivateSlices = useCallback(() => {
    setAcademicProgress({ subjects: [], rating: null, place: null, loading: false });
    setMarkbook({ data: null, loading: false });
    setGroupInfo({ curator: null, students: [], loading: false });
    setOmissions({ data: null, loading: false });
    setNotifications({ items: [], unreadCount: 0, loading: false });
    setStudy({
      certificates: [],
      certPlaces: [],
      markSheets: [],
      markSheetSubjects: [],
      loading: false,
    });
    setDormitory({ applications: [], privileges: [], loading: false });
    setPenalties({ items: [], loading: false });
    setPersonalCv({ data: null, loading: false });
    setHeadman({
      hasAccess: false,
      subjects: [],
      students: [],
      dataByTermHoursId: {},
      loading: false,
    });
  }, []);

  // ==================== Auth Actions ====================

  const refreshProfile = useCallback(async () => {
    if (authMode === 'guest') {
      setProfile(guestProfile(selectedGroup));
      return;
    }
    if (authMode === 'logged_out') return;

    const opGen = authGenerationRef.current;
    const [cvRes, grpRes, notifCountRes, omRes] = await Promise.all([
      apiClient.fetchPersonalCv(),
      apiClient.fetchGroupInfo(selectedGroup, profile.fio),
      apiClient.fetchUnreadNotificationsCount(),
      apiClient.fetchOmissions(),
    ]);

    if (authGenerationRef.current !== opGen) return;

    const cv = cvRes.data;
    const fio =
      (cv.fio ?? '').trim() ||
      [cv.lastName, cv.firstName, cv.middleName]
        .map((s) => (s ?? '').trim())
        .filter(Boolean)
        .join(' ') ||
      profile.fio;
    const resolvedGroup = sanitizeGroupNumber(
      typeof cv.studentGroup === 'string'
        ? cv.studentGroup
        : cv.studentGroup?.name ?? cv.group ?? selectedGroup,
      selectedGroup,
    );
    const fac = (cv.facultyAbbrev || cv.faculty || '').trim();
    const course = cv.course ? `${cv.course} курс` : '';
    const desc = [fac, course].filter(Boolean).join(' · ') || profile.desc;

    const nextSummary: UserProfileSummary = {
      fio,
      desc,
      group: resolvedGroup,
      photo: (cv.photoUrl ?? cv.photoLink ?? profile.photo ?? '').trim(),
      birthDate: (cv.birthDate ?? profile.birthDate ?? '').trim(),
      isHeadman: grpRes.data.isHeadman,
      unreadNotifCount: notifCountRes.data,
      unexcusedHours: omRes.data.unexcusedHours,
    };

    setCachedProfile(nextSummary);
    setProfile((prev) => ({
      ...nextSummary,
      customAvatarDataUrl: prev.customAvatarDataUrl,
    }));
    setPersonalCv({ data: cv, loading: false });
    setGroupInfo({
      curator: grpRes.data.curator,
      students: grpRes.data.students,
      loading: false,
    });
    setOmissions({ data: omRes.data, loading: false });
    applyDataSourceMeta(cvRes.source, cvRes.offlineReason);
  }, [authMode, profile.birthDate, profile.desc, profile.fio, profile.photo, selectedGroup, applyDataSourceMeta]);

  const login = useCallback(
    async (userInput: string, passwordInput: string) => {
      const loginGen = ++authGenerationRef.current;
      const res = await apiClient.login(userInput, passwordInput);
      if (authGenerationRef.current !== loginGen) {
        return { ok: false, error: 'Авторизация отменена' };
      }
      if (!res.ok || !res.session) {
        return { ok: false, error: res.error || 'Ошибка входа' };
      }

      hasMutatedAuthRef.current = true;
      ephemeralCredsRef.current = {
        username: userInput.trim(),
        password: passwordInput,
      };
      apiClient.setGuestModeHint(false);

      const resolvedGroup = sanitizeGroupNumber(res.session.group, selectedGroup);
      setAuthMode('authenticated');
      setUsername(res.session.username);

      const initialProfile: UserProfileSummary = {
        fio: res.session.fio,
        desc: res.session.desc,
        group: resolvedGroup,
        photo: res.session.photoUrl,
        birthDate: '',
        isHeadman: res.session.isHeadman,
        unreadNotifCount: 0,
        unexcusedHours: 0,
      };
      setCachedProfile(initialProfile);
      setProfile((prev) => ({
        ...initialProfile,
        customAvatarDataUrl: prev.customAvatarDataUrl,
      }));
      applyDataSourceMeta(res.source, res.offlineReason);

      await saveAuthSession({
        authMode: 'authenticated',
        username: res.session.username,
        loginGroup: resolvedGroup,
      });

      if (authGenerationRef.current !== loginGen) {
        return { ok: false, error: 'Авторизация отменена' };
      }

      if (resolvedGroup !== selectedGroup) {
        hasMutatedSchedulePrefsRef.current = true;
        setSelectedGroupState(resolvedGroup);
        setSelectedEmployeeState(null);
        await saveSelectedGroup(resolvedGroup);
      }

      // Background enrichment (unread count, omissions, headman)
      Promise.all([
        apiClient.fetchGroupInfo(resolvedGroup, res.session.fio),
        apiClient.fetchUnreadNotificationsCount(),
        apiClient.fetchOmissions(),
      ])
        .then(([grpRes, unreadRes, omRes]) => {
          if (authGenerationRef.current !== loginGen) return;
          const enriched: UserProfileSummary = {
            ...initialProfile,
            isHeadman: grpRes.data.isHeadman || res.session!.isHeadman,
            unreadNotifCount: unreadRes.data,
            unexcusedHours: omRes.data.unexcusedHours,
          };
          setCachedProfile(enriched);
          setProfile((prev) => ({
            ...enriched,
            customAvatarDataUrl: prev.customAvatarDataUrl,
          }));
        })
        .catch(() => undefined);

      return { ok: true };
    },
    [applyDataSourceMeta, selectedGroup],
  );

  const loginAsGuest = useCallback(async () => {
    authGenerationRef.current += 1;
    hasMutatedAuthRef.current = true;
    ephemeralCredsRef.current = null;
    clearPrivateIisCaches();
    resetPrivateSlices();
    apiClient.setGuestModeHint(true);

    const guestGroup = sanitizeGroupNumber(selectedGroup, '510902');
    setAuthMode('guest');
    setUsername(null);
    setProfile(guestProfile(guestGroup));
    setDataSource(forceOffline ? 'mock' : 'live');

    await saveAuthSession({
      authMode: 'guest',
      username: null,
      loginGroup: null,
    });
  }, [forceOffline, resetPrivateSlices, selectedGroup]);

  const logout = useCallback(async () => {
    authGenerationRef.current += 1;
    hasMutatedAuthRef.current = true;
    ephemeralCredsRef.current = null;
    apiClient.setGuestModeHint(false);
    await apiClient.logout();
    await logoutAndClearAuth();
    resetPrivateSlices();

    setAuthMode('logged_out');
    setUsername(null);
    setProfile(emptyProfile(selectedGroup, null));
  }, [resetPrivateSlices, selectedGroup]);

  // ==================== Schedule Actions ====================

  const selectGroup = useCallback(
    async (group: string, addToHistory = true) => {
      hasMutatedSchedulePrefsRef.current = true;
      const clean = sanitizeGroupNumber(group, DEFAULT_GROUP_NUMBER);
      setSelectedGroupState(clean);
      setSelectedEmployeeState(null);
      await saveSelectedGroup(clean);

      if (addToHistory) {
        hasMutatedHistoryRef.current = true;
        const matched = allGroups.find((g) => g.name === clean);
        const subtitle = matched
          ? [matched.facultyAbbrev, matched.specialityAbbrev].filter(Boolean).join(' · ')
          : undefined;
        const nextHistory = await storageAddSearchHistory({
          id: clean,
          label: clean,
          kind: 'group',
          ...(subtitle ? { subtitle } : {}),
        });
        setSearchHistory(nextHistory);
      }
    },
    [allGroups],
  );

  const selectEmployee = useCallback(
    async (
      emp: { urlId: string; fullName: string } | null,
      addToHistory = true,
    ) => {
      hasMutatedSchedulePrefsRef.current = true;
      setSelectedEmployeeState(emp);
      await saveSelectedEmployee(emp);

      if (emp && addToHistory) {
        hasMutatedHistoryRef.current = true;
        const nextHistory = await storageAddSearchHistory({
          id: emp.urlId,
          label: emp.fullName,
          kind: 'employee',
        });
        setSearchHistory(nextHistory);
      }
    },
    [],
  );

  const setSubgroup = useCallback(async (sg: 0 | 1 | 2) => {
    hasMutatedSchedulePrefsRef.current = true;
    setSubgroupState(sg);
    await saveSubgroup(sg);
  }, []);

  const resetToToday = useCallback(() => {
    setSelectedDayIndex(7);
  }, []);

  const setDateRailVisible = useCallback(async (visible: boolean) => {
    hasMutatedSchedulePrefsRef.current = true;
    setDateRailVisibleState(visible);
    await saveDateRailVisible(visible);
  }, []);

  const refreshSchedule = useCallback(
    async (force = true) => {
      await loadScheduleForTarget(selectedGroup, selectedEmployee, force);
    },
    [loadScheduleForTarget, selectedEmployee, selectedGroup],
  );

  const removeFromSearchHistory = useCallback(
    async (id: string, kind?: ScheduleTargetKind) => {
      hasMutatedHistoryRef.current = true;
      const next = await storageRemoveSearchHistoryItem(id, kind);
      setSearchHistory(next);
    },
    [],
  );

  // ==================== Notes Actions ====================

  const addNote = useCallback(
    async (input: Omit<Note, 'id'> & { id?: string }) => {
      hasMutatedNotesRef.current = true;
      const updated = await storageAddNote(input);
      setNotes(updated);
      return updated;
    },
    [],
  );

  const updateNote = useCallback(
    async (id: string, patch: Partial<Omit<Note, 'id'>>) => {
      hasMutatedNotesRef.current = true;
      const updated = await storageUpdateNote(id, patch);
      setNotes(updated);
      return updated;
    },
    [],
  );

  const deleteNote = useCallback(async (id: string) => {
    hasMutatedNotesRef.current = true;
    const updated = await storageDeleteNote(id);
    setNotes(updated);
    return updated;
  }, []);

  const togglePinNote = useCallback(async (id: string) => {
    hasMutatedNotesRef.current = true;
    const updated = await storageTogglePinNote(id);
    setNotes(updated);
    return updated;
  }, []);

  // ==================== Network Settings Actions ====================

  const setForceOfflineModeAction = useCallback(async (force: boolean) => {
    hasMutatedNetworkRef.current = true;
    apiClient.setForceOfflineMode(force);
    setForceOfflineState(force);
    if (force) {
      setDataSource('mock');
      setOfflineReason('Автономный режим включён');
    } else {
      setOfflineReason(null);
    }
    await saveNetworkPrefs({ forceOffline: force });
  }, []);

  const setApiBaseUrlAction = useCallback(async (url: string) => {
    hasMutatedNetworkRef.current = true;
    apiClient.configureApiBaseUrl(url);
    const normalized = apiClient.getApiBaseUrl();
    setApiBaseUrlState(normalized);
    await saveNetworkPrefs({ apiBaseUrl: normalized });
  }, []);

  // ==================== IIS Service Loaders & Mutators ====================

  const loadMarksAndRating = useCallback(
    async (force = false) => {
      if (!force && academicProgress.subjects.length > 0) return;
      setAcademicProgress((prev) => ({ ...prev, loading: true }));
      try {
        if (authMode === 'guest') {
          const fallbackSubjects = apiClient.extractSubjectsFromSchedule(lessons);
          setAcademicProgress({
            subjects: fallbackSubjects,
            rating: null,
            place: null,
            loading: false,
          });
          return;
        }
        const [ratingRes, groupRatingRes] = await Promise.all([
          apiClient.fetchPersonalRating(),
          apiClient.fetchGroupRating(selectedGroup),
        ]);
        applyDataSourceMeta(ratingRes.source, ratingRes.offlineReason);
        setAcademicProgress({
          subjects:
            ratingRes.data.subjects.length > 0
              ? ratingRes.data.subjects
              : apiClient.extractSubjectsFromSchedule(lessons),
          rating: groupRatingRes.data.rating,
          place: groupRatingRes.data.place,
          loading: false,
        });
      } catch {
        setAcademicProgress((prev) => ({ ...prev, loading: false }));
      }
    },
    [academicProgress.subjects.length, applyDataSourceMeta, authMode, lessons, selectedGroup],
  );

  const loadMarkbook = useCallback(
    async (force = false) => {
      if (!force && markbook.data) return;
      setMarkbook((prev) => ({ ...prev, loading: true }));
      try {
        const res = await apiClient.fetchMarkbook();
        applyDataSourceMeta(res.source, res.offlineReason);
        setMarkbook({ data: res.data, loading: false });
      } finally {
        setMarkbook((prev) => (prev.loading ? { ...prev, loading: false } : prev));
      }
    },
    [applyDataSourceMeta, markbook.data],
  );

  const loadGroupInfo = useCallback(
    async (force = false) => {
      if (!force && groupInfo.students.length > 0) return;
      setGroupInfo((prev) => ({ ...prev, loading: true }));
      try {
        const res = await apiClient.fetchGroupInfo(selectedGroup, profile.fio);
        applyDataSourceMeta(res.source, res.offlineReason);
        setGroupInfo({
          curator: res.data.curator,
          students: res.data.students,
          loading: false,
        });
        setProfile((prev) => ({ ...prev, isHeadman: res.data.isHeadman }));
      } finally {
        setGroupInfo((prev) => (prev.loading ? { ...prev, loading: false } : prev));
      }
    },
    [applyDataSourceMeta, groupInfo.students.length, profile.fio, selectedGroup],
  );

  const loadOmissions = useCallback(
    async (force = false) => {
      if (!force && omissions.data) return;
      setOmissions((prev) => ({ ...prev, loading: true }));
      try {
        const res = await apiClient.fetchOmissions();
        applyDataSourceMeta(res.source, res.offlineReason);
        setOmissions({ data: res.data, loading: false });
        setProfile((prev) => ({ ...prev, unexcusedHours: res.data.unexcusedHours }));
      } finally {
        setOmissions((prev) => (prev.loading ? { ...prev, loading: false } : prev));
      }
    },
    [applyDataSourceMeta, omissions.data],
  );

  const submitOrviOmission = useCallback(
    async (payload: OrviOmissionPayload) => {
      const res = await apiClient.createOrviOmission(payload);
      if (res.ok) {
        const refreshed = await apiClient.fetchOmissions();
        setOmissions({ data: refreshed.data, loading: false });
      }
      return res;
    },
    [],
  );

  const loadNotifications = useCallback(
    async (force = false) => {
      if (!force && notifications.items.length > 0) return;
      setNotifications((prev) => ({ ...prev, loading: true }));
      try {
        const res = await apiClient.fetchNotifications();
        applyDataSourceMeta(res.source, res.offlineReason);
        const unreadCount = res.data.filter((n) => !n.isViewed).length;
        setNotifications({ items: res.data, unreadCount, loading: false });
        setProfile((prev) => ({ ...prev, unreadNotifCount: unreadCount }));
      } finally {
        setNotifications((prev) => (prev.loading ? { ...prev, loading: false } : prev));
      }
    },
    [applyDataSourceMeta, notifications.items.length],
  );

  const markNotificationsRead = useCallback(async (ids: number[]) => {
    const res = await apiClient.markNotificationsRead(ids);
    const unreadCount = res.data.filter((n) => !n.isViewed).length;
    setNotifications({ items: res.data, unreadCount, loading: false });
    setProfile((prev) => ({ ...prev, unreadNotifCount: unreadCount }));
  }, []);

  const loadStudyData = useCallback(
    async (force = false) => {
      if (
        !force &&
        study.certificates.length > 0 &&
        study.markSheets.length > 0
      ) {
        return;
      }
      setStudy((prev) => ({ ...prev, loading: true }));
      try {
        const [certsRes, placesRes, msRes, msSubjRes] = await Promise.all([
          apiClient.fetchCertificates(),
          apiClient.fetchCertificatePlaces(),
          apiClient.fetchMarkSheets(),
          apiClient.fetchMarkSheetSubjects(),
        ]);
        applyDataSourceMeta(certsRes.source, certsRes.offlineReason);
        setStudy({
          certificates: certsRes.data,
          certPlaces: placesRes.data,
          markSheets: msRes.data,
          markSheetSubjects: msSubjRes.data,
          loading: false,
        });
      } finally {
        setStudy((prev) => (prev.loading ? { ...prev, loading: false } : prev));
      }
    },
    [applyDataSourceMeta, study.certificates.length, study.markSheets.length],
  );

  const orderCertificate = useCallback(
    async (payload: CertificateRegisterPayload) => {
      const res = await apiClient.registerCertificate(payload);
      applyDataSourceMeta(res.source, res.offlineReason);
      setStudy((prev) => ({ ...prev, certificates: res.data }));
    },
    [applyDataSourceMeta],
  );

  const cancelCertificate = useCallback(
    async (id: number) => {
      const res = await apiClient.closeCertificate(id);
      applyDataSourceMeta(res.source, res.offlineReason);
      setStudy((prev) => ({ ...prev, certificates: res.data }));
    },
    [applyDataSourceMeta],
  );

  const createMarkSheet = useCallback(
    async (payload: MarkSheetCreatePayload) => {
      const res = await apiClient.createMarkSheet(payload);
      applyDataSourceMeta(res.source, res.offlineReason);
      setStudy((prev) => ({ ...prev, markSheets: res.data }));
    },
    [applyDataSourceMeta],
  );

  const closeMarkSheet = useCallback(
    async (id: number) => {
      const res = await apiClient.closeMarkSheet(id);
      applyDataSourceMeta(res.source, res.offlineReason);
      setStudy((prev) => ({ ...prev, markSheets: res.data }));
    },
    [applyDataSourceMeta],
  );

  const loadDormitoryData = useCallback(
    async (force = false) => {
      if (!force && dormitory.applications.length > 0) return;
      setDormitory((prev) => ({ ...prev, loading: true }));
      try {
        const [appsRes, privRes] = await Promise.all([
          apiClient.fetchDormitoryQueue(),
          apiClient.fetchDormitoryPrivileges(),
        ]);
        applyDataSourceMeta(appsRes.source, appsRes.offlineReason);
        setDormitory({
          applications: appsRes.data,
          privileges: privRes.data,
          loading: false,
        });
      } finally {
        setDormitory((prev) => (prev.loading ? { ...prev, loading: false } : prev));
      }
    },
    [applyDataSourceMeta, dormitory.applications.length],
  );

  const loadPenalties = useCallback(
    async (force = false) => {
      if (!force && penalties.items.length > 0) return;
      setPenalties((prev) => ({ ...prev, loading: true }));
      try {
        const res = await apiClient.fetchPenalties();
        applyDataSourceMeta(res.source, res.offlineReason);
        setPenalties({ items: res.data, loading: false });
      } finally {
        setPenalties((prev) => (prev.loading ? { ...prev, loading: false } : prev));
      }
    },
    [applyDataSourceMeta, penalties.items.length],
  );

  const loadPersonalCv = useCallback(
    async (force = false) => {
      if (!force && personalCv.data) return;
      setPersonalCv((prev) => ({ ...prev, loading: true }));
      try {
        const res = await apiClient.fetchPersonalCv();
        applyDataSourceMeta(res.source, res.offlineReason);
        setPersonalCv({ data: res.data, loading: false });
      } finally {
        setPersonalCv((prev) => (prev.loading ? { ...prev, loading: false } : prev));
      }
    },
    [applyDataSourceMeta, personalCv.data],
  );

  const updatePersonalCvSection = useCallback(
    async (endpoint: ProfileCvSectionEndpoint, patch: Partial<PersonalCvDto>) => {
      const res = await apiClient.updateCvSection(endpoint, patch);
      applyDataSourceMeta(res.source, res.offlineReason);
      setPersonalCv({ data: res.data, loading: false });
    },
    [applyDataSourceMeta],
  );

  const updatePersonalCvSkills = useCallback(
    async (skills: Array<{ id?: number; name: string }>) => {
      const res = await apiClient.updateCvSkills(skills);
      applyDataSourceMeta(res.source, res.offlineReason);
      setPersonalCv((prev) => ({
        ...prev,
        data: prev.data ? { ...prev.data, skills: res.data as CvSkill[] } : prev.data,
      }));
    },
    [applyDataSourceMeta],
  );

  const updatePersonalCvReferences = useCallback(
    async (refs: Array<{ id?: number; name: string; reference: string }>) => {
      const res = await apiClient.updateCvReferences(refs);
      applyDataSourceMeta(res.source, res.offlineReason);
      setPersonalCv((prev) => ({
        ...prev,
        data: prev.data
          ? { ...prev.data, references: res.data as CvReference[] }
          : prev.data,
      }));
    },
    [applyDataSourceMeta],
  );

  const loadAnnouncements = useCallback(
    async (force = false) => {
      if (!force && announcements.items.length > 0) return;
      setAnnouncements((prev) => ({ ...prev, loading: true }));
      try {
        const res = await apiClient.fetchAnnouncements();
        applyDataSourceMeta(res.source, res.offlineReason);
        setAnnouncements({ items: res.data, loading: false });
      } finally {
        setAnnouncements((prev) => (prev.loading ? { ...prev, loading: false } : prev));
      }
    },
    [announcements.items.length, applyDataSourceMeta],
  );

  const loadHeadmanInit = useCallback(async () => {
    setHeadman((prev) => ({ ...prev, loading: true }));
    try {
      const [subjRes, studRes] = await Promise.all([
        apiClient.fetchHeadmanSubjects(),
        apiClient.fetchHeadmanStudents(),
      ]);
      applyDataSourceMeta(subjRes.source, subjRes.offlineReason);
      setHeadman((prev) => ({
        ...prev,
        hasAccess: subjRes.data.hasAccess,
        subjects: subjRes.data.subjects,
        students: studRes.data,
        loading: false,
      }));
    } finally {
      setHeadman((prev) => (prev.loading ? { ...prev, loading: false } : prev));
    }
  }, [applyDataSourceMeta]);

  const loadHeadmanAttendance = useCallback(
    async (termHoursId: number) => {
      setHeadman((prev) => ({ ...prev, loading: true }));
      try {
        const res = await apiClient.fetchHeadmanData(termHoursId);
        applyDataSourceMeta(res.source, res.offlineReason);
        setHeadman((prev) => ({
          ...prev,
          dataByTermHoursId: {
            ...prev.dataByTermHoursId,
            [termHoursId]: res.data,
          },
          loading: false,
        }));
      } finally {
        setHeadman((prev) => (prev.loading ? { ...prev, loading: false } : prev));
      }
    },
    [applyDataSourceMeta],
  );

  const saveHeadmanAttendance = useCallback(
    async (payload: HeadmanCreatePayload) => {
      const res = await apiClient.saveHeadmanAttendance(payload);
      applyDataSourceMeta(res.source, res.offlineReason);
      setHeadman((prev) => {
        const nextMap = { ...prev.dataByTermHoursId };
        for (const [termIdStr, existing] of Object.entries(nextMap)) {
          const termId = Number(termIdStr);
          if (existing.lessons.some((l) => l.id === payload.idLesson)) {
            nextMap[termId] = {
              ...existing,
              attendance: existing.attendance.map((st) => {
                const updatedEntry = payload.studentOmissionsHoursDtoList.find(
                  (u) => u.student === st.studentId,
                );
                if (!updatedEntry) return st;
                return {
                  ...st,
                  lessonRecords: {
                    ...st.lessonRecords,
                    [String(payload.idLesson)]: { missedHours: updatedEntry.hours },
                  },
                };
              }),
            };
          }
        }
        return { ...prev, dataByTermHoursId: nextMap };
      });
    },
    [applyDataSourceMeta],
  );

  const setCustomAvatar = useCallback((dataUrl: string | null) => {
    storageSetCustomAvatar(dataUrl);
    setProfile((prev) => ({ ...prev, customAvatarDataUrl: dataUrl }));
  }, []);

  // Derived Schedule Computed Values
  const currentWeek = useMemo(
    () => getBsuirWeekForCalendarDay(new Date(), selectedDayIndex),
    [selectedDayIndex],
  );

  const isSessionAutoActive = useMemo(
    () =>
      isSessionPeriodActive(
        sessionPeriod.startExamsDate,
        sessionPeriod.endExamsDate,
        exams,
      ),
    [exams, sessionPeriod.endExamsDate, sessionPeriod.startExamsDate],
  );

  const availableSubjects = useMemo(() => {
    const titles = Array.from(
      new Set(
        [...lessons, ...exams]
          .map((l) => l.title.trim())
          .filter(Boolean),
      ),
    );
    return titles.length > 0 ? titles : ['Общее'];
  }, [exams, lessons]);

  const value: AppDataContextValue = useMemo(
    () => ({
      authMode,
      isAuthenticated: authMode === 'authenticated',
      isLoggedIn: authMode !== 'logged_out',
      username,
      profile,

      dataSource,
      isOfflineMode: forceOffline || dataSource === 'mock',
      forceOffline,
      offlineReason,
      apiBaseUrl,

      selectedGroup,
      selectedEmployee,
      effectiveTarget,
      subgroup,
      selectedDayIndex,
      dateRailVisible,
      isSessionMode,
      currentWeek,
      lessons,
      exams,
      sessionPeriod,
      isSessionAutoActive,
      employeeSchedules,
      allGroups,
      allEmployees,
      searchHistory,
      isScheduleLoading,
      isScheduleRefreshing,

      notes,
      availableSubjects,

      academicProgress,
      markbook,
      groupInfo,
      omissions,
      notifications,
      study,
      dormitory,
      penalties,
      personalCv,
      announcements,
      headman,

      login,
      loginAsGuest,
      logout,

      selectGroup,
      selectEmployee,
      setSubgroup,
      setSelectedDayIndex,
      resetToToday,
      setDateRailVisible,
      setSessionMode,
      refreshSchedule,
      removeFromSearchHistory,

      addNote,
      updateNote,
      deleteNote,
      togglePinNote,

      setForceOfflineMode: setForceOfflineModeAction,
      setApiBaseUrl: setApiBaseUrlAction,

      refreshProfile,
      loadMarksAndRating,
      loadMarkbook,
      loadGroupInfo,
      loadOmissions,
      submitOrviOmission,
      loadNotifications,
      markNotificationsRead,
      loadStudyData,
      orderCertificate,
      cancelCertificate,
      createMarkSheet,
      closeMarkSheet,
      loadDormitoryData,
      loadPenalties,
      loadPersonalCv,
      updatePersonalCvSection,
      updatePersonalCvSkills,
      updatePersonalCvReferences,
      loadAnnouncements,
      loadHeadmanInit,
      loadHeadmanAttendance,
      saveHeadmanAttendance,
      setCustomAvatar,
    }),
    [
      authMode,
      username,
      profile,
      dataSource,
      forceOffline,
      offlineReason,
      apiBaseUrl,
      selectedGroup,
      selectedEmployee,
      effectiveTarget,
      subgroup,
      selectedDayIndex,
      dateRailVisible,
      isSessionMode,
      currentWeek,
      lessons,
      exams,
      sessionPeriod,
      isSessionAutoActive,
      employeeSchedules,
      allGroups,
      allEmployees,
      searchHistory,
      isScheduleLoading,
      isScheduleRefreshing,
      notes,
      availableSubjects,
      academicProgress,
      markbook,
      groupInfo,
      omissions,
      notifications,
      study,
      dormitory,
      penalties,
      personalCv,
      announcements,
      headman,
      login,
      loginAsGuest,
      logout,
      selectGroup,
      selectEmployee,
      setSubgroup,
      resetToToday,
      setDateRailVisible,
      refreshSchedule,
      removeFromSearchHistory,
      addNote,
      updateNote,
      deleteNote,
      togglePinNote,
      setForceOfflineModeAction,
      setApiBaseUrlAction,
      refreshProfile,
      loadMarksAndRating,
      loadMarkbook,
      loadGroupInfo,
      loadOmissions,
      submitOrviOmission,
      loadNotifications,
      markNotificationsRead,
      loadStudyData,
      orderCertificate,
      cancelCertificate,
      createMarkSheet,
      closeMarkSheet,
      loadDormitoryData,
      loadPenalties,
      loadPersonalCv,
      updatePersonalCvSection,
      updatePersonalCvSkills,
      updatePersonalCvReferences,
      loadAnnouncements,
      loadHeadmanInit,
      loadHeadmanAttendance,
      saveHeadmanAttendance,
      setCustomAvatar,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return ctx;
}
