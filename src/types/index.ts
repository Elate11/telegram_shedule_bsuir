// ==================== BSUIR Schedule DTOs (BsuirApi.kt:8-114) ====================

export interface BsuirStudentGroup {
  name?: string | null;
  facultyAbbrev?: string | null;
  specialityAbbrev?: string | null;
  course?: number | null;
  id?: number | null;
}

export interface BsuirEmployee {
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
  photoLink?: string | null;
  degree?: string | null;
  rank?: string | null;
  id?: number | null;
  urlId?: string | null;
  fio?: string | null;
  fullName?: string | null;
  academicDepartment?: string[] | null;
}

export interface BsuirLesson {
  subject?: string | null;
  subjectFullName?: string | null;
  lessonTypeAbbrev?: string | null;
  startLessonTime?: string | null;
  endLessonTime?: string | null;
  numSubgroup?: number | null;
  weekNumber?: number[] | null;
  auditories?: string[] | null;
  employees?: BsuirEmployee[] | null;
  studentGroups?: BsuirStudentGroup[] | null;
  dateLesson?: string | null;
  startLessonDate?: string | null;
  endLessonDate?: string | null;
  note?: string | null;
  announcement?: boolean | null;
}

export interface BsuirScheduleResponse {
  schedules?: Record<string, BsuirLesson[]> | null;
  nextSchedules?: Record<string, BsuirLesson[]> | null;
  exams?: BsuirLesson[] | null;
  currentWeekNumber?: number | null;
  studentGroupDto?: BsuirStudentGroup | null;
  employeeDto?: BsuirEmployee | null;
  startDate?: string | null;
  endDate?: string | null;
  startExamsDate?: string | null;
  endExamsDate?: string | null;
  currentTerm?: string | null;
  nextTerm?: string | null;
}

// ==================== Domain Models (DataManager.kt & MainActivity.kt) ====================

export interface Lesson {
  startTime: string;
  endTime: string;
  title: string;
  details: string;
  isActive?: boolean;
  progress?: number | null;
  subjectFullName: string;
  lessonType: string;
  teacherName: string;
  teacherFullName: string;
  teacherPhoto: string;
  teacherUrlId: string;
  auditory: string;
  subgroup: number; // 0 = all, 1, 2
  weeks: number[];
  dayOfWeek: number; // 1 (Mon) .. 7 (Sun)
  dateLesson?: string | null;
  note?: string | null;
  studentGroups: string[];
}

export interface ActiveLessonStatus {
  isActive: boolean;
  progress: number; // 0..1
  phase: 1 | 2 | 3; // 1: 1st 40m half, 2: 5m break, 3: 2nd 40m half
  isBreak: boolean;
  remainingMinutes: number;
  remainingSeconds: number;
  secondsToBreak: number;
  breakProgressNotch: number; // normalized notch position (~40/85 = 0.4706)
  statusText: string;
}

export interface NextLessonTarget {
  day: number;
  month0Based: number;
  year: number;
  hour: number;
  minute: number;
  dateFormatted: string;
  timeFormatted: string;
  lessonType: string;
}

export interface NoteAttachment {
  id: string;
  uri: string; // data URL or object/remote URL
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export interface Note {
  id: string;
  subject: string;
  text: string;
  date: string; // DD.MM.YYYY
  time?: string | null; // HH:mm
  isEvent: boolean;
  isPinned: boolean;
  lessonType: string; // 'ЛР' | 'ЛК' | 'ПЗ' | ''
  attachments: NoteAttachment[];
  calendarEventId?: number | null;
}

export interface AcademicMarkInfo {
  mark: number;
  taskNumber?: number | null;
  lessonType?: string | null;
  dateString?: string | null;
  controlPoint?: string | null;
}

export interface AcademicSubjectProgress {
  id?: number | null;
  name: string;
  abbrev: string;
  totalLabs: number;
  submittedLabs: number;
  marks: AcademicMarkInfo[];
  averageMark?: number | null;
  hasLabs: boolean;
}

export interface SubjectMarks {
  name: string;
  marks: number[];
}

// ==================== IIS Cabinet DTOs ====================

export interface CvSkill {
  id: number;
  name: string;
}

export interface CvReference {
  id: number;
  name: string;
  reference: string;
}

export interface PersonalCvDto {
  id?: number;
  fio?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  birthDate?: string | null;
  studentGroup?: string | { name?: string };
  group?: string;
  faculty?: string;
  facultyAbbrev?: string;
  course?: number;
  photoUrl?: string | null;
  photoLink?: string | null;
  summary: string;
  published: boolean;
  showRating: boolean;
  searchJob: boolean;
  officeEmail?: string;
  officePassword?: string;
  skills: CvSkill[];
  references: CvReference[];
  rating?: number | null;
  place?: number | null;
}

export interface BsuirRatingMark {
  mark?: number | null;
  taskNumber?: number | null;
}

export interface BsuirRatingLesson {
  id?: number | null;
  controlPoint?: string | null;
  dateString?: string | null;
  gradebookOmissions?: number | null;
  marks?: BsuirRatingMark[] | null;
  subGroup?: number | null;
}

export interface BsuirRatingLessonType {
  id?: number | null;
  abbrev?: string | null;
  termHoursId?: number | null;
  lessons?: BsuirRatingLesson[] | null;
}

export interface BsuirRatingSubject {
  id?: number | null;
  name?: string | null;
  abbrev?: string | null;
  lessonTypes?: BsuirRatingLessonType[] | null;
}

export interface BsuirRatingDeadline {
  lessonId?: number | null;
  taskNumber?: number | null;
}

export interface BsuirRatingDeadlineGroup {
  termHoursId?: number | null;
  labCount?: number | null;
  taskCount?: number | null;
  deadlines?: BsuirRatingDeadline[] | null;
}

export interface BsuirRatingPercentageMark {
  discipline?: string | null;
  date?: string | null;
  number?: number | null;
}

export interface BsuirRatingResponse {
  subjects?: BsuirRatingSubject[] | null;
  deadlines?: BsuirRatingDeadlineGroup[] | null;
  percentageMarks?: BsuirRatingPercentageMark[] | null;
}

export interface MarkbookSubjectMark {
  subject: string;
  mark?: string | number | null;
  formOfControl?: string | null;
  date?: string | null;
  teacher?: string | null;
  hours?: number | null;
}

export interface MarkbookPage {
  marks: MarkbookSubjectMark[];
  averageMark?: number | null;
}

export interface MarkbookResponse {
  averageMark?: number | null;
  rating?: number | null;
  place?: number | null;
  studentGroup?: string | null;
  student?: {
    fio?: string;
    firstName?: string;
    lastName?: string;
    middleName?: string;
    group?: string;
    studentGroup?: string;
    facultyAbbrev?: string | null;
    course?: number | null;
  };
  markBookGroupDto?: {
    studentGroup?: string;
  };
  markPages: Record<string, MarkbookPage>;
}

export interface GroupRatingEntry {
  fio?: string;
  fullName?: string;
  studentFio?: string;
  averageMark?: number | null;
  rating?: number | null;
  place?: number | null;
  position?: number | null;
  student?: {
    fio?: string;
    fullName?: string;
    averageMark?: number | null;
    rating?: number | null;
  };
}

export interface OmissionLesson {
  subject: string;
  lessonType: string;
  dateString: string;
  hours: number;
  isRespectful: boolean;
  note: string;
  teacher: string;
  monthName: string;
}

export interface ExcuseDocument {
  title: string;
  note: string;
  hoursClosed: number;
  dates: string[];
  subjects: string[];
}

export interface RawOmissionLesson {
  gradeBookOmissions?: number;
  missedHours?: number;
  omissions?: number;
  isRespectfulOmission?: boolean;
  respectful?: boolean;
  dateString?: string;
  date?: string;
  nameLesson?: string;
  subject?: string;
  lessonName?: string;
  lessonType?: string;
  type?: string;
  note?: string;
  reason?: string;
  comment?: string;
  teacher?: string;
  employee?: string;
}

export interface OmissionStudentRecord {
  student?: {
    fio?: string;
    lessons?: RawOmissionLesson[];
  };
  lessons?: RawOmissionLesson[];
  gradeBookOmissions?: number;
  missedHours?: number;
  nameLesson?: string;
  subject?: string;
}

export interface DisrespectfulOmission {
  omissionCount?: number;
  hours?: number;
  month?: number;
  date?: string | null;
}

export interface CuratorDto {
  fio: string;
  position: string;
  phone: string;
  email: string;
  urlId: string;
}

export interface GroupStudentDto {
  fio: string;
  position: number;
  role?: string | null;
  averageMark?: number | null;
  rating?: number | null;
  isCurrentUser: boolean;
}

export interface GroupInfoResponse {
  studentGroupCuratorDto?: Partial<CuratorDto> | null;
  groupInfoStudentDto?: Array<{
    fio?: string;
    position?: string;
    averageMark?: number;
    rating?: number;
  }> | null;
}

export interface DeanNotification {
  id: number;
  message: string;
  date: string;
  type: 'INFO' | 'SUCCESS' | 'FAILURE' | string;
  isViewed: boolean;
}

export interface CertificateDto {
  id: number;
  number: number;
  certificateType: string;
  provisionPlace: string;
  dateOrder: string;
  issueDate?: string | null;
  status: number; // 1=Напечатана, 2=В обработке, 3=Отклонена
  rejectionReason?: string | null;
}

export interface CertificatePlaceOption {
  name: string;
  type: 0 | 1; // 0 = обычная, 1 = гербовая
}

export interface CertificatePlaceGroup {
  categoryTitle: string;
  places: CertificatePlaceOption[];
}

export interface MarkSheetDto {
  id: number;
  number: string;
  subjectName: string;
  subjectType: string;
  employeeFio: string;
  absentDate: string;
  createDate: string;
  expireDate: string;
  hours: number;
  price: number;
  isGoodReason: boolean;
  status: string;
  rejectionReason: string;
  term: number;
}

export interface MarkSheetLessonTypeDto {
  abbrev: string;
  thId?: number | null;
  focsId?: number | null;
}

export interface MarkSheetSubjectDto {
  abbrev: string;
  term: number;
  lessonTypes: MarkSheetLessonTypeDto[];
}

export interface DormitoryApplicationDto {
  id: number;
  number?: number | null;
  numberInQueue?: string | null;
  status: string;
  roomInfo?: string | null;
  applicationDate: string;
  acceptedDate?: string | null;
  settledDate?: string | null;
  rejectionReason?: string | null;
}

export interface DormitoryPrivilegeDto {
  id: number;
  year?: number | null;
  categoryName: string;
  privilegeName: string;
  note?: string | null;
}

export interface PenaltyDirectiveDto {
  id: number;
  type: string;
  reason: string;
  status: string;
  date: string;
  directiveNumber: string;
  note: string;
}

export interface HeadmanSubject {
  subjectAbbrev: string;
  termHoursId: number;
  lessonTypeAbbrev: string;
}

export interface HeadmanLessonSession {
  id: number;
  date: string;
  subgroup: number;
  maxHours: number;
}

export interface HeadmanStudent {
  studentId: number;
  fio: string;
  subgroup: number;
}

export interface HeadmanDataResponse {
  lessons: Array<{
    id: number;
    date: string;
    subgroup?: number;
    numberOfHours?: number;
  }>;
  attendance: Array<{
    studentId: number;
    lessonRecords: Record<string, { missedHours?: number }>;
  }>;
}

export interface AnnouncementItem {
  id?: number | string;
  title?: string;
  name?: string;
  type?: string;
  content?: string;
  date?: string;
  createdAt?: string;
  url?: string;
  [key: string]: unknown;
}

// ==================== Theme & Customization Types (Dark & Light) ====================

export type ThemeMode = 'dark' | 'light';
export type NavMode = 'Hold' | 'Swipe' | 'Buttons';
export type TransitionType = 'Slide' | 'Fade' | 'Scale' | 'Cube' | 'Flip';
export type BgMode = 'Solid' | 'Gradient' | 'Gallery';
export type ReminderTiming =
  | '15_min_before'
  | '1_hour_before'
  | '2_hours_before'
  | '1_day_before_18'
  | 'custom_hours';

export interface ColorPalette {
  id: string;
  name?: string;
  primary: string;
  background: string;
}

export interface ThemeTokens {
  bg: string;
  actualBg: string;
  card: string;
  cardLesson: string;
  text: string;
  textSecondary: string;
  accent: string;
  accentFg: string;
  accentFocus: string;
  border: string;
  divider: string;
  glassBg: string;
  glassBorder: string;
}

// ==================== Telegram WebApp SDK Types ====================

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramInitDataUnsafe {
  query_id?: string;
  user?: TelegramUser;
  receiver?: TelegramUser;
  chat_type?: string;
  chat_instance?: string;
  start_param?: string;
  auth_date?: number;
  hash?: string;
}

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
}

export interface TelegramCloudStorage {
  setItem(key: string, value: string, callback?: (error: string | null, stored?: boolean) => void): void;
  getItem(key: string, callback: (error: string | null, value?: string) => void): void;
  getItems(keys: string[], callback: (error: string | null, values?: Record<string, string>) => void): void;
  removeItem(key: string, callback?: (error: string | null, removed?: boolean) => void): void;
  removeItems(keys: string[], callback?: (error: string | null, removed?: boolean) => void): void;
  getKeys(callback: (error: string | null, keys?: string[]) => void): void;
}

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface MainButtonConfig {
  visible: boolean;
  text?: string;
  color?: string;
  textColor?: string;
  isActive?: boolean;
  onClick?: () => void;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: TelegramInitDataUnsafe;
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: TelegramThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  safeAreaInset?: SafeAreaInsets;
  contentSafeAreaInset?: SafeAreaInsets;
  BackButton: {
    isVisible: boolean;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
    show(): void;
    hide(): void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    setText(text: string): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
    show(): void;
    hide(): void;
    enable(): void;
    disable(): void;
    setParams(params: {
      text?: string;
      color?: string;
      text_color?: string;
      is_active?: boolean;
      is_visible?: boolean;
    }): void;
  };
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
  CloudStorage?: TelegramCloudStorage;
  ready(): void;
  expand(): void;
  close(): void;
  disableVerticalSwipes?(): void;
  enableVerticalSwipes?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  onEvent?(eventType: string, cb: () => void): void;
  offEvent?(eventType: string, cb: () => void): void;
}

export interface TelegramContextInfo {
  isTelegram: boolean;
  platform: string;
  version: string;
  colorScheme: ThemeMode;
  themeParams: TelegramThemeParams;
  initData: string;
  initDataUnsafe: TelegramInitDataUnsafe;
  user: TelegramUser | null;
  safeAreaInsets: SafeAreaInsets;
  contentSafeAreaInsets: SafeAreaInsets;
  hasCloudStorage: boolean;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

// ==================== M2 Shared Contracts (API, Storage & AppDataContext) ====================

export type AuthMode = 'authenticated' | 'guest' | 'logged_out';

export type ApiDataSource = 'live' | 'cache' | 'mock';
export type DataSource = ApiDataSource;

export interface ApiResult<T> {
  data: T;
  source: ApiDataSource;
  offlineReason?: string;
  httpStatus?: number;
}

export type ScheduleTargetKind = 'group' | 'employee';

export interface SearchHistoryEntry {
  id: string;
  label: string;
  kind: ScheduleTargetKind;
  subtitle?: string;
}

export interface SchedulePrefs {
  selectedGroup: string;
  selectedEmployee: { urlId: string; fullName: string } | null;
  subgroup: 0 | 1 | 2;
  dateRailVisible: boolean;
}

export interface AuthSessionState {
  authMode: AuthMode;
  username: string | null;
  loginGroup: string | null;
}

export interface NetworkPrefs {
  apiBaseUrl: string;
  forceOffline: boolean;
}

export interface UserProfileSummary {
  fio: string;
  desc: string;
  group: string;
  photo: string;
  birthDate: string;
  isHeadman: boolean;
  unreadNotifCount: number;
  unexcusedHours: number;
}

export interface AuthSession {
  authenticated: boolean;
  isGuest: boolean;
  username: string;
  fio: string;
  group: string;
  desc: string;
  photoUrl: string;
  isHeadman: boolean;
}

export interface LoginResult {
  ok: boolean;
  error?: string;
  status?: number;
  session?: AuthSession;
  source: ApiDataSource;
  offlineReason?: string;
}

export interface OmissionsSummary {
  totalHours: number;
  unexcusedHours: number;
  lessons: OmissionLesson[];
  excuseDocuments: ExcuseDocument[];
  monthlyHours: Record<string, number>;
  monthlyUnexcusedHours: Record<string, number>;
  monthlyData?: Record<string, number>;
  monthlyUnexcusedData?: Record<string, number>;
}

export interface OrviOmissionPayload {
  file: null;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  placeOfStay: string;
  signature: string; // data:image/png;base64,...
}

export interface OrviOmissionResult {
  ok: boolean;
  conflictLimitExceeded?: boolean;
  message: string;
  source: ApiDataSource;
}

export interface CertificateRegisterPayload {
  certificateCount: number;
  certificateRequestDto: {
    certificateType: string;
    provisionPlace: string;
  };
}

export interface MarkSheetCreatePayload {
  price: number;
  reason: boolean;
  hours: string;
  absentDate: string; // DD.MM.YYYY
  subject: {
    focsId?: number | null;
    thId?: number | null;
  };
}

export interface HeadmanCreatePayload {
  idLesson: number;
  studentOmissionsHoursDtoList: Array<{
    student: number;
    hours: number;
  }>;
}

export interface HeadmanJournalData {
  hasAccess: boolean;
  subjects: HeadmanSubject[];
  students: HeadmanStudent[];
  lessons: HeadmanLessonSession[];
  attendance: Record<number, Record<number, number>>;
}

export interface GroupInfoNormalized {
  curator: CuratorDto | null;
  students: GroupStudentDto[];
  isHeadman: boolean;
}

export interface MarkbookParsedSemester {
  semesterNumber: number;
  title: string;
  marks: MarkbookSubjectMark[];
  averageMark: number | null;
}

export type ProfileCvSectionEndpoint =
  | 'personal-cv-published'
  | 'personal-cv-rating'
  | 'personal-cv-searching-job'
  | 'summary';
