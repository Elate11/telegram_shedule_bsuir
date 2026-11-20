// Deterministic DTO-compliant BSUIR & IIS mock payloads, Russian UI label constants,
// and Android Dark/Light/Minimal design tokens (strict Android parity; no src/ imports).

export interface MockStudentGroup {
  id: number;
  name: string;
  facultyAbbrev: string;
  specialityAbbrev: string;
  course: number;
}

export interface MockEmployee {
  id: number;
  firstName: string;
  lastName: string;
  middleName: string;
  fio: string;
  urlId: string;
  degree: string;
  rank: string;
  photoLink: string | null;
  academicDepartment: string[];
}

export interface MockBsuirLesson {
  subject: string | null;
  subjectFullName: string | null;
  lessonTypeAbbrev: string | null;
  startLessonTime: string;
  endLessonTime: string;
  numSubgroup: number;
  weekNumber: number[];
  auditories: string[];
  employees: MockEmployee[];
  studentGroups: MockStudentGroup[];
  dateLesson: string | null;
  startLessonDate: string | null;
  endLessonDate: string | null;
  note: string | null;
  announcement: boolean;
}

export interface MockBsuirScheduleResponse {
  schedules: Record<string, MockBsuirLesson[]> | null;
  nextSchedules: Record<string, MockBsuirLesson[]> | null;
  exams: MockBsuirLesson[] | null;
  currentWeekNumber: number;
  studentGroupDto: MockStudentGroup | null;
  employeeDto: MockEmployee | null;
  startDate: string | null;
  endDate: string | null;
  startExamsDate: string | null;
  endExamsDate: string | null;
  currentTerm: string | null;
  nextTerm: string | null;
}

export interface MockLoginResponse {
  fio: string;
  group: string;
  studentGroup: { name: string };
  photoUrl: string | null;
  token?: string;
}

export interface MockPersonalCv {
  id: number;
  fio: string;
  group: string;
  faculty: string;
  course: number;
  photoUrl: string | null;
  summary: string;
  published: boolean;
  showRating: boolean;
  searchJob: boolean;
  officeEmail: string;
  officePassword: string;
  skills: Array<{ id: number; name: string }>;
  references: Array<{ id: number; name: string; reference: string }>;
  rating: number;
  place: number;
}

export interface MockRatingResponse {
  subjects: Array<{
    id: number;
    name: string;
    abbrev: string;
    lessonTypes: Array<{
      id: number;
      abbrev: string;
      termHoursId: number;
      lessons: Array<{
        id: number;
        controlPoint: string | null;
        dateString: string;
        gradebookOmissions: number;
        marks: Array<{ mark: number; taskNumber: number | null }>;
        subGroup: number;
      }>;
    }>;
  }>;
  deadlines: Array<{
    termHoursId: number;
    labCount: number;
    taskCount: number;
    deadlines: Array<{ lessonId: number; taskNumber: number }>;
  }>;
  percentageMarks: Array<{
    discipline: string;
    date: string;
    number: number;
  }>;
}

export interface MockMarkbookResponse {
  averageMark: number;
  rating: number;
  place: number;
  student: {
    fio: string;
    firstName?: string;
    lastName?: string;
    middleName?: string;
    group: string;
  };
  markPages: Record<
    string,
    {
      averageMark: number | null;
      marks: Array<{
        subject: string;
        mark: string | number | null;
        formOfControl: string;
        date: string;
        teacher: string;
        hours: number;
      }>;
    }
  >;
}

export interface MockGroupInfoResponse {
  studentGroupCuratorDto: {
    fio: string;
    position: string;
    phone: string;
    email: string;
    urlId: string;
  } | null;
  groupInfoStudentDto: Array<{
    fio: string;
    position: string;
    averageMark?: number;
    rating?: number;
  }>;
}

export interface MockDeanNotification {
  id: number;
  message: string;
  date: string;
  type: 'INFO' | 'SUCCESS' | 'FAILURE' | 'WARNING';
  isViewed: boolean;
}

export interface MockCertificateItem {
  id: number;
  number: number;
  certificateType: string;
  provisionPlace: string;
  dateOrder: string;
  issueDate: string | null;
  status: 1 | 2 | 3; // 1 = Напечатана, 2 = В обработке, 3 = Отклонена
  rejectionReason: string | null;
}

export interface MockCertificatePlaceGroup {
  type: string;
  places: Array<{ name: string; type: 0 | 1 }>;
}

export interface MockMarkSheetItem {
  id: number;
  number: string;
  subject: {
    name: string;
    abbrev: string;
    lessonTypeAbbrev: string;
    term: number;
  };
  employee: {
    fio: string;
  };
  absentDate: string;
  createDate: string;
  expireDate: string;
  hours: number;
  price: number;
  reason: boolean;
  status: string;
  rejectionReason: string | null;
  term: number;
}

export interface MockMarkSheetSubject {
  abbrev: string;
  term: number;
  lessonTypes: Array<{
    abbrev: string;
    thId: number | null;
    focsId: number | null;
  }>;
}

export interface MockOmissionEntry {
  student: {
    fio: string;
    lessons: Array<{
      nameLesson: string;
      lessonType: string;
      dateString: string;
      gradeBookOmissions: number;
      isRespectfulOmission: boolean;
      note: string;
      teacher: string;
    }>;
  };
}

export interface MockOmissionByStudentResponse {
  omissionDtoList: Array<{
    name: string;
    note: string;
    dateFrom: string;
    dateTo: string;
    term: string;
    omissionCount: number;
  }>;
}

export interface MockDisrespectfulOmissionItem {
  omissionCount: number;
  month: number;
  date: string;
}

export interface MockDormitoryApplication {
  id: number;
  number: number | null;
  numberInQueue: string | null;
  status: string;
  roomInfo: string | null;
  applicationDate: string;
  acceptedDate: string | null;
  settledDate: string | null;
  rejectionReason: string | null;
}

export interface MockDormitoryPrivilege {
  id: number;
  year: number | null;
  dormitoryPrivilegeCategoryName: string;
  dormitoryPrivilegeName: string;
  note: string | null;
}

export interface MockPenaltyDirective {
  id: number;
  reason: string;
  status: string;
  note: string;
  directiveDto: {
    typeName: string;
    date: string;
    number: string;
  };
}

export interface MockAnnouncement {
  id: number;
  title: string;
  content: string;
  date: string;
  type: string;
  url?: string;
}

export interface MockHeadmanSubjectItem {
  id: number;
  lessonTypeAbbrev: string;
}

export interface MockHeadmanStudent {
  studentId: number;
  fullName: string;
}

export interface MockHeadmanData {
  lessons: Array<{
    id: number;
    date: string;
    subgroup: number;
    numberOfHours: number;
  }>;
  attendance: Array<{
    studentId: number;
    lessonRecords: Record<string, { missedHours: number }>;
  }>;
}

export interface MockNote {
  id: string;
  subject: string;
  text: string;
  date: string;
  time: string | null;
  isEvent: boolean;
  isPinned: boolean;
  lessonType: 'ЛР' | 'ЛК' | 'ПЗ' | '';
  attachments: Array<{
    id: string;
    uri: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
  }>;
}

// ==================== Android Dark / Light / Minimal Palettes ====================
// Strict Android parity (AppleDesign.kt + MinCustomizationView Dark/Light/Minimal palettes only)

export const ANDROID_THEMES = {
  dark: {
    bg: '#272729',
    card: '#2A2A2C',
    cardLesson: '#252527',
    text: '#FFFFFF',
    textSecondary: '#CCCCCC',
    accent: '#2997FF',
    focusBlue: '#0071E3',
  },
  light: {
    bg: '#F5F5F7',
    card: '#FFFFFF',
    cardLesson: '#FAFAFC',
    text: '#1D1D1F',
    textSecondary: '#7A7A7A',
    accent: '#0066CC',
    focusBlue: '#0071E3',
  },
  splashBg: '#101116',
  splashSonar: '#38A3FF',
} as const;

export const RECOMMENDED_PALETTES = {
  redRose: { primary: '#E53935', background: '#FFEBEE' },
  greenMint: { primary: '#43A047', background: '#E8F5E9' },
  blueIce: { primary: '#1E88E5', background: '#E3F2FD' },
  amberCharcoal: { primary: '#FFB300', background: '#333333' },
  cyanBlack: { primary: '#00E5FF', background: '#111111' },
  monoBlack: { primary: '#E0E0E0', background: '#000000' },
  draculaPurple: { primary: '#BD93F9', background: '#1E1535' },
} as const;

// ==================== Russian UI Label Constants ====================

export const UI_LABELS = {
  tabs: {
    schedule: 'Расписание',
    marks: 'Оценки',
    notes: 'Заметки',
    profile: 'Профиль',
  },
  auth: {
    gradebookPlaceholder: 'Номер зачетки',
    passwordPlaceholder: 'Пароль',
    loginButton: 'Войти',
    guestButton: 'Продолжить без входа',
    emptyFieldsError: 'Пожалуйста, заполните все поля',
    invalidCredsError: 'Неверный логин или пароль',
    networkError: 'Отсутствует подключение к сети',
  },
  schedule: {
    allSubgroups: 'Все',
    subgroup1: '1 подгр.',
    subgroup2: '2 подгр.',
    sessionPill: 'Сессия',
    backToGroup: 'Назад к группе',
    untilEnd: 'До конца пары',
    breakLabel: 'Перерыв',
    secondHalf: '2-я часть',
    addNoteToLesson: '+ Добавить заметку к паре',
    gymAuditory: 'спортзал',
    emptyDay: 'Отличный день',
    announcementBadge: 'Объявление',
  },
  marks: {
    averageLabel: 'Средний балл',
    labsLabel: 'Лабораторные',
    filterAll: 'Все',
    filterLabs: 'Лабораторные',
    filterGraded: 'С оценками',
    excellent: 'Отлично',
    good: 'Хорошо',
    satisfactory: 'Удовлетвор.',
    noMarks: 'Нет оценок',
    allLabsDone: 'Все сданы (100%)',
  },
  notes: {
    pinnedSection: 'Закреплённые',
    pinToggle: 'Закрепить',
    remindToggle: 'Напомнить',
    deleteAction: 'Удалить',
    nextLessonShortcut: 'К след. паре',
    generalSubject: 'Общее',
  },
  profile: {
    notifications: 'Уведомления',
    study: 'Учёба и справки',
    gradebook: 'Зачётка',
    group: 'Группа',
    headmanJournal: 'Журнал старосты',
    absences: 'Пропуски',
    iisResume: 'Резюме и виджет ИИС',
    dormitory: 'Общежитие',
    privileges: 'Льготы',
    penalties: 'Взыскания и поощрения',
    announcements: 'Объявления',
    customization: 'Кастомизация',
    logout: 'Выйти',
    github: 'GitHub',
    headmanBadge: 'Староста',
    meBadge: 'ВЫ',
  },
  studyAndOrvi: {
    certificatesTab: 'Справки',
    markSheetsTab: 'Ведомости',
    statusPrinted: 'Напечатана',
    statusPending: 'В обработке',
    statusRejected: 'Отклонена',
    orderCertificate: 'Заказать справку',
    cancelRequest: 'Отменить заявку',
    orderMarkSheet: 'Заказать ведомость',
    withdrawMarkSheet: 'Отозвать заявку',
    applyOrvi: 'Подать заявку на ОРВИ',
    saveSignature: 'Сохранить подпись',
    clearSignature: 'Очистить',
    submitOrvi: 'Отправить заявку',
    orviLimitError: 'Вы превысили лимит дней на заявление студента в текущем месяце',
  },
  headman: {
    saveAttendance: 'Сохранить ведомость посещаемости',
  },
  emptyStates: {
    noPenalties: 'Дисциплинарных взысканий нет',
    noAnnouncements: ':( пока нет объявлений',
    noDormitory: 'Заявок на общежитие нет',
    noPrivileges: 'Зарегистрированных льгот нет',
  },
  customization: {
    bgSolid: 'Сплошной',
    bgGradient: 'Градиент',
    bgGallery: 'Фото',
    navHold: 'Зажатие',
    navSwipe: 'Свайп',
    navButtons: 'Кнопки',
    introToggle: 'Интро при входе',
    replayIntro: 'Посмотреть интро',
    testNotification: 'Проверить уведомление',
    testVibration: 'Проверить вибрацию',
    resetPalette: 'Сброс',
  },
} as const;

// ==================== Core Entities ====================

export const AUTH_CREDENTIALS = {
  validUser: '51090012',
  validPass: 'secret123',
  nonHeadmanUser: '51090099',
  defaultGroup: '510902',
  secondaryGroup: '310101',
} as const;

export const STUDENT_GROUPS: MockStudentGroup[] = [
  { id: 1001, name: '510902', facultyAbbrev: 'ФКП', specialityAbbrev: 'ПОИТ', course: 2 },
  { id: 1002, name: '310101', facultyAbbrev: 'ФИТУ', specialityAbbrev: 'ИИ', course: 3 },
  { id: 1003, name: '253501', facultyAbbrev: 'ФКСиС', specialityAbbrev: 'ИиТП', course: 4 },
  { id: 1004, name: '451001', facultyAbbrev: 'ФКСиС', specialityAbbrev: 'ПОИТ', course: 2 },
  { id: 1005, name: '151002', facultyAbbrev: 'ФКСиС', specialityAbbrev: 'ПОИТ', course: 4 },
  { id: 1006, name: '520901', facultyAbbrev: 'ФКП', specialityAbbrev: 'ЭВС', course: 1 },
  { id: 1007, name: '530101', facultyAbbrev: 'ФРЭ', specialityAbbrev: 'РЭ', course: 1 },
];

export const EMPLOYEES: MockEmployee[] = [
  {
    id: 501,
    firstName: 'Игорь',
    lastName: 'Азаров',
    middleName: 'Викторович',
    fio: 'Азаров И. В.',
    urlId: 'i-azarov',
    degree: 'к.т.н.',
    rank: 'доцент',
    photoLink: null,
    academicDepartment: ['Кафедра ПОИТ'],
  },
  {
    id: 502,
    firstName: 'Сергей',
    lastName: 'Иванов',
    middleName: 'Александрович',
    fio: 'Иванов С. А.',
    urlId: 's-ivanov',
    degree: 'к.ф.-м.н.',
    rank: 'доцент',
    photoLink: null,
    academicDepartment: ['Кафедра ВМ'],
  },
  {
    id: 503,
    firstName: 'Елена',
    lastName: 'Петрова',
    middleName: 'Николаевна',
    fio: 'Петрова Е. Н.',
    urlId: 'e-petrova',
    degree: '',
    rank: 'ст. преподаватель',
    photoLink: null,
    academicDepartment: ['Кафедра ЭВМ'],
  },
];

const G510902 = STUDENT_GROUPS[0];
const G310101 = STUDENT_GROUPS[1];
const G253501 = STUDENT_GROUPS[2];
const G451001 = STUDENT_GROUPS[3];

const EMP_AZAROV = EMPLOYEES[0];
const EMP_IVANOV = EMPLOYEES[1];
const EMP_PETROVA = EMPLOYEES[2];

function makeLesson(
  partial: Partial<MockBsuirLesson> & {
    startLessonTime: string;
    endLessonTime: string;
    subject: string | null;
    lessonTypeAbbrev: string | null;
  },
): MockBsuirLesson {
  return {
    subjectFullName: partial.subjectFullName ?? partial.subject,
    numSubgroup: 0,
    weekNumber: [1, 2, 3, 4],
    auditories: ['312-4'],
    employees: [EMP_AZAROV],
    studentGroups: [G510902],
    dateLesson: null,
    startLessonDate: '01.09.2026',
    endLessonDate: '26.12.2026',
    note: null,
    announcement: false,
    ...partial,
  };
}

const WEEKDAYS_MON_SAT = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
] as const;

function build510902Schedules(): Record<string, MockBsuirLesson[]> {
  const baseDay: MockBsuirLesson[] = [
    makeLesson({
      subject: 'ОАиП',
      subjectFullName: 'Основы алгоритмизации и программирования',
      lessonTypeAbbrev: 'ЛК',
      startLessonTime: '09:00',
      endLessonTime: '10:25',
      numSubgroup: 0,
      weekNumber: [1, 2, 3, 4],
      auditories: ['101-4'],
      employees: [EMP_AZAROV],
      studentGroups: [G510902, G310101, G253501],
    }),
    makeLesson({
      subject: 'АиСД',
      subjectFullName: 'Алгоритмы и структуры данных',
      lessonTypeAbbrev: 'ЛР',
      startLessonTime: '10:35',
      endLessonTime: '12:00',
      numSubgroup: 1,
      weekNumber: [1, 2, 3, 4],
      auditories: ['405-5'],
      employees: [EMP_PETROVA],
      studentGroups: [G510902],
    }),
    makeLesson({
      subject: 'МатАн',
      subjectFullName: 'Математический анализ',
      lessonTypeAbbrev: 'ПЗ',
      startLessonTime: '10:35',
      endLessonTime: '12:00',
      numSubgroup: 2,
      weekNumber: [1, 2, 3, 4],
      auditories: ['214-2'],
      employees: [EMP_IVANOV],
      studentGroups: [G510902],
    }),
    makeLesson({
      subject: 'Физика',
      subjectFullName: 'Физика',
      lessonTypeAbbrev: 'ЛК',
      startLessonTime: '12:25',
      endLessonTime: '13:50',
      numSubgroup: 0,
      weekNumber: [], // empty weekNumber => every week
      auditories: [], // empty auditories => "—"
      employees: [EMP_IVANOV],
      studentGroups: [G510902],
    }),
    makeLesson({
      subject: 'ФизК',
      subjectFullName: 'Физическая культура',
      lessonTypeAbbrev: 'ПЗ',
      startLessonTime: '14:00',
      endLessonTime: '15:25',
      numSubgroup: 0,
      weekNumber: [1, 2, 3, 4],
      auditories: [], // physical education without auditory => "спортзал"
      employees: [],
      studentGroups: [G510902],
    }),
  ];

  const tuesdayExtra: MockBsuirLesson[] = [
    ...baseDay.slice(0, 3),
    makeLesson({
      subject: null,
      subjectFullName: null,
      lessonTypeAbbrev: null,
      startLessonTime: '14:00',
      endLessonTime: '15:25',
      numSubgroup: 0,
      weekNumber: [1, 2, 3, 4],
      auditories: ['Актовый зал'],
      employees: [EMP_AZAROV],
      studentGroups: [G510902],
      note: 'Встреча с деканом ФКП по производственной практике',
      announcement: true,
    }),
    makeLesson({
      subject: 'Проектирование высоконагруженных распределённых систем и микросервисной архитектуры',
      subjectFullName:
        'Проектирование высоконагруженных распределённых систем и микросервисной архитектуры в корпоративной среде',
      lessonTypeAbbrev: 'ЛР',
      startLessonTime: '15:40',
      endLessonTime: '17:05',
      numSubgroup: 0,
      weekNumber: [2, 4],
      auditories: ['502-5'],
      employees: [EMP_PETROVA],
      studentGroups: [G510902],
    }),
  ];

  const schedules: Record<string, MockBsuirLesson[]> = {};
  for (const day of WEEKDAYS_MON_SAT) {
    schedules[day] = day === 'Вторник' ? tuesdayExtra : baseDay;
  }
  return schedules;
}

function build310101Schedules(): Record<string, MockBsuirLesson[]> {
  const lessons: MockBsuirLesson[] = [
    makeLesson({
      subject: 'ИИиМО',
      subjectFullName: 'Искусственный интеллект и машинное обучение',
      lessonTypeAbbrev: 'ЛК',
      startLessonTime: '09:00',
      endLessonTime: '10:25',
      numSubgroup: 0,
      weekNumber: [1, 2, 3, 4],
      auditories: ['301-4'],
      employees: [EMP_AZAROV],
      studentGroups: [G310101],
    }),
    makeLesson({
      subject: 'ТФЯ',
      subjectFullName: 'Теория формальных языков',
      lessonTypeAbbrev: 'ПЗ',
      startLessonTime: '10:35',
      endLessonTime: '12:00',
      numSubgroup: 1,
      weekNumber: [1, 2, 3, 4],
      auditories: ['410-4'],
      employees: [EMP_PETROVA],
      studentGroups: [G310101],
    }),
    makeLesson({
      subject: 'Нейросети',
      subjectFullName: 'Нейронные сети',
      lessonTypeAbbrev: 'ЛР',
      startLessonTime: '12:25',
      endLessonTime: '13:50',
      numSubgroup: 2,
      weekNumber: [1, 2, 3, 4],
      auditories: ['412-5'],
      employees: [EMP_IVANOV],
      studentGroups: [G310101],
    }),
  ];
  const schedules: Record<string, MockBsuirLesson[]> = {};
  for (const day of WEEKDAYS_MON_SAT) {
    schedules[day] = lessons;
  }
  return schedules;
}

function build253501Schedules(): Record<string, MockBsuirLesson[]> {
  const lessons: MockBsuirLesson[] = [
    makeLesson({
      subject: 'КСиС',
      subjectFullName: 'Компьютерные системы и сети',
      lessonTypeAbbrev: 'ЛК',
      startLessonTime: '09:00',
      endLessonTime: '10:25',
      numSubgroup: 0,
      weekNumber: [1, 2, 3, 4],
      auditories: ['202-5'],
      employees: [EMP_AZAROV],
      studentGroups: [G253501, G510902],
    }),
    makeLesson({
      subject: 'БД',
      subjectFullName: 'Базы данных',
      lessonTypeAbbrev: 'ЛР',
      startLessonTime: '10:35',
      endLessonTime: '12:00',
      numSubgroup: 0,
      weekNumber: [1, 2, 3, 4],
      auditories: ['508-5'],
      employees: [EMP_PETROVA],
      studentGroups: [G253501],
    }),
  ];
  const schedules: Record<string, MockBsuirLesson[]> = {};
  for (const day of WEEKDAYS_MON_SAT) {
    schedules[day] = lessons;
  }
  return schedules;
}

export const GROUP_SCHEDULES: Record<string, MockBsuirScheduleResponse> = {
  '510902': {
    schedules: build510902Schedules(),
    nextSchedules: null,
    exams: [
      makeLesson({
        subject: 'ОАиП',
        subjectFullName: 'Основы алгоритмизации и программирования',
        lessonTypeAbbrev: 'Консультация',
        startLessonTime: '10:00',
        endLessonTime: '11:30',
        auditories: ['101-4'],
        employees: [EMP_AZAROV],
        studentGroups: [G510902],
        dateLesson: '11.01.2027',
      }),
      makeLesson({
        subject: 'ОАиП',
        subjectFullName: 'Основы алгоритмизации и программирования',
        lessonTypeAbbrev: 'Экзамен',
        startLessonTime: '09:00',
        endLessonTime: '12:30',
        auditories: ['101-4'],
        employees: [EMP_AZAROV],
        studentGroups: [G510902],
        dateLesson: '12.01.2027',
      }),
      makeLesson({
        subject: 'МатАн',
        subjectFullName: 'Математический анализ',
        lessonTypeAbbrev: 'Экзамен',
        startLessonTime: '09:00',
        endLessonTime: '12:30',
        auditories: ['214-2'],
        employees: [EMP_IVANOV],
        studentGroups: [G510902],
        dateLesson: '16.01.2027',
      }),
      makeLesson({
        subject: 'Физика',
        subjectFullName: 'Физика',
        lessonTypeAbbrev: 'Зачет',
        startLessonTime: '13:00',
        endLessonTime: '15:00',
        auditories: ['305-2'],
        employees: [EMP_IVANOV],
        studentGroups: [G510902],
        dateLesson: '09.01.2027',
      }),
    ],
    currentWeekNumber: 2,
    studentGroupDto: G510902,
    employeeDto: null,
    startDate: '01.09.2026',
    endDate: '26.12.2026',
    startExamsDate: '04.01.2027',
    endExamsDate: '24.01.2027',
    currentTerm: '1 семестр',
    nextTerm: '2 семестр',
  },
  '310101': {
    schedules: build310101Schedules(),
    nextSchedules: null,
    exams: [],
    currentWeekNumber: 2,
    studentGroupDto: G310101,
    employeeDto: null,
    startDate: '01.09.2026',
    endDate: '26.12.2026',
    startExamsDate: null,
    endExamsDate: null,
    currentTerm: '1 семестр',
    nextTerm: null,
  },
  '253501': {
    schedules: build253501Schedules(),
    nextSchedules: null,
    exams: [
      makeLesson({
        subject: 'КСиС',
        subjectFullName: 'Компьютерные системы и сети',
        lessonTypeAbbrev: 'Экзамен',
        startLessonTime: '09:00',
        endLessonTime: '12:00',
        auditories: ['202-5'],
        employees: [EMP_AZAROV],
        studentGroups: [G253501],
        dateLesson: '14.01.2027',
      }),
    ],
    currentWeekNumber: 2,
    studentGroupDto: G253501,
    employeeDto: null,
    startDate: '01.09.2026',
    endDate: '26.12.2026',
    startExamsDate: '05.01.2027',
    endExamsDate: '22.01.2027',
    currentTerm: '1 семестр',
    nextTerm: '2 семестр',
  },
};

function formatRuDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function createSessionActiveSchedule(referenceDate = new Date()): MockBsuirScheduleResponse {
  const start = new Date(referenceDate);
  start.setDate(start.getDate() - 2);
  const end = new Date(referenceDate);
  end.setDate(end.getDate() + 14);
  const d1 = new Date(referenceDate);
  d1.setDate(d1.getDate() + 1);
  const d2 = new Date(referenceDate);
  d2.setDate(d2.getDate() + 3);
  const d3 = new Date(referenceDate);
  d3.setDate(d3.getDate() + 5);

  return {
    ...GROUP_SCHEDULES['510902'],
    studentGroupDto: G451001,
    startExamsDate: formatRuDate(start),
    endExamsDate: formatRuDate(end),
    exams: [
      makeLesson({
        subject: 'ОАиП',
        subjectFullName: 'Основы алгоритмизации и программирования',
        lessonTypeAbbrev: 'Консультация',
        startLessonTime: '10:00',
        endLessonTime: '11:30',
        auditories: ['101-4'],
        employees: [EMP_AZAROV],
        studentGroups: [G510902],
        dateLesson: formatRuDate(d1),
      }),
      makeLesson({
        subject: 'ОАиП',
        subjectFullName: 'Основы алгоритмизации и программирования',
        lessonTypeAbbrev: 'Экзамен',
        startLessonTime: '09:00',
        endLessonTime: '12:30',
        auditories: ['101-4'],
        employees: [EMP_AZAROV],
        studentGroups: [G510902],
        dateLesson: formatRuDate(d2),
      }),
      makeLesson({
        subject: 'АиСД',
        subjectFullName: 'Алгоритмы и структуры данных',
        lessonTypeAbbrev: 'Зачет',
        startLessonTime: '13:00',
        endLessonTime: '15:00',
        auditories: ['405-5'],
        employees: [EMP_PETROVA],
        studentGroups: [G510902],
        dateLesson: formatRuDate(d3),
      }),
    ],
  };
}

export function createNextSchedulesOnlySchedule(): MockBsuirScheduleResponse {
  return {
    schedules: {},
    nextSchedules: build310101Schedules(),
    exams: [],
    currentWeekNumber: 1,
    studentGroupDto: G310101,
    employeeDto: null,
    startDate: '09.02.2027',
    endDate: '31.05.2027',
    startExamsDate: null,
    endExamsDate: null,
    currentTerm: null,
    nextTerm: '2 семестр',
  };
}

export const EMPLOYEE_SCHEDULES: Record<string, MockBsuirScheduleResponse> = {
  'i-azarov': {
    schedules: Object.fromEntries(
      WEEKDAYS_MON_SAT.map((day) => [
        day,
        [
          makeLesson({
            subject: 'ОАиП',
            subjectFullName: 'Основы алгоритмизации и программирования',
            lessonTypeAbbrev: 'ЛК',
            startLessonTime: '09:00',
            endLessonTime: '10:25',
            numSubgroup: 0,
            weekNumber: [1, 2, 3, 4],
            auditories: ['101-4'],
            employees: [EMP_AZAROV],
            studentGroups: [G510902, G310101, G253501, G451001, STUDENT_GROUPS[4]],
          }),
          makeLesson({
            subject: 'ИИиМО',
            subjectFullName: 'Искусственный интеллект и машинное обучение',
            lessonTypeAbbrev: 'ЛК',
            startLessonTime: '12:25',
            endLessonTime: '13:50',
            numSubgroup: 0,
            weekNumber: [1, 2, 3, 4],
            auditories: ['301-4'],
            employees: [EMP_AZAROV],
            studentGroups: [G310101],
          }),
        ],
      ]),
    ),
    nextSchedules: null,
    exams: [],
    currentWeekNumber: 2,
    studentGroupDto: null,
    employeeDto: EMP_AZAROV,
    startDate: '01.09.2026',
    endDate: '26.12.2026',
    startExamsDate: null,
    endExamsDate: null,
    currentTerm: '1 семестр',
    nextTerm: null,
  },
  's-ivanov': {
    schedules: Object.fromEntries(
      WEEKDAYS_MON_SAT.map((day) => [
        day,
        [
          makeLesson({
            subject: 'МатАн',
            subjectFullName: 'Математический анализ',
            lessonTypeAbbrev: 'ПЗ',
            startLessonTime: '10:35',
            endLessonTime: '12:00',
            numSubgroup: 2,
            weekNumber: [1, 2, 3, 4],
            auditories: ['214-2'],
            employees: [EMP_IVANOV],
            studentGroups: [G510902],
          }),
        ],
      ]),
    ),
    nextSchedules: null,
    exams: [],
    currentWeekNumber: 2,
    studentGroupDto: null,
    employeeDto: EMP_IVANOV,
    startDate: '01.09.2026',
    endDate: '26.12.2026',
    startExamsDate: null,
    endExamsDate: null,
    currentTerm: '1 семестр',
    nextTerm: null,
  },
  'e-petrova': {
    schedules: Object.fromEntries(
      WEEKDAYS_MON_SAT.map((day) => [
        day,
        [
          makeLesson({
            subject: 'АиСД',
            subjectFullName: 'Алгоритмы и структуры данных',
            lessonTypeAbbrev: 'ЛР',
            startLessonTime: '10:35',
            endLessonTime: '12:00',
            numSubgroup: 1,
            weekNumber: [1, 2, 3, 4],
            auditories: ['405-5'],
            employees: [EMP_PETROVA],
            studentGroups: [G510902],
          }),
        ],
      ]),
    ),
    nextSchedules: null,
    exams: [],
    currentWeekNumber: 2,
    studentGroupDto: null,
    employeeDto: EMP_PETROVA,
    startDate: '01.09.2026',
    endDate: '26.12.2026',
    startExamsDate: null,
    endExamsDate: null,
    currentTerm: '1 семестр',
    nextTerm: null,
  },
};

// ==================== Auth & IIS Cabinet Payloads ====================

export const LOGIN_RESPONSE_HEADMAN: MockLoginResponse = {
  fio: 'Соколов Алексей Дмитриевич',
  group: '510902',
  studentGroup: { name: '510902' },
  photoUrl: null,
};

export const LOGIN_RESPONSE_REGULAR: MockLoginResponse = {
  fio: 'Морозов Никита Сергеевич',
  group: '510902',
  studentGroup: { name: '510902' },
  photoUrl: null,
};

export const PERSONAL_CV: MockPersonalCv = {
  id: 7742,
  fio: 'Соколов Алексей Дмитриевич',
  group: '510902',
  faculty: 'ФКП',
  course: 2,
  photoUrl: null,
  summary: 'Разработка веб-приложений на TypeScript и React, алгоритмы и системное программирование.',
  published: true,
  showRating: true,
  searchJob: false,
  officeEmail: 'sokolov.ad@study.bsuir.by',
  officePassword: 'OutlookPass2026!',
  skills: [
    { id: 1, name: 'TypeScript' },
    { id: 2, name: 'React' },
    { id: 3, name: 'Kotlin' },
  ],
  references: [
    { id: 1, name: 'GitHub', reference: 'https://github.com/sokolov-bsuir' },
    { id: 2, name: 'Telegram', reference: 'https://t.me/sokolov_bsuir' },
  ],
  rating: 9.12,
  place: 2,
};

export const PERSONAL_RATING: MockRatingResponse = {
  subjects: [
    {
      id: 11,
      name: 'Основы алгоритмизации и программирования',
      abbrev: 'ОАиП',
      lessonTypes: [
        {
          id: 111,
          abbrev: 'ЛР',
          termHoursId: 1001,
          lessons: [
            {
              id: 1,
              controlPoint: 'Лаба 1',
              dateString: '10.09.2026',
              gradebookOmissions: 0,
              marks: [{ mark: 9, taskNumber: 1 }],
              subGroup: 1,
            },
            {
              id: 2,
              controlPoint: 'Лаба 2',
              dateString: '24.09.2026',
              gradebookOmissions: 0,
              marks: [{ mark: 10, taskNumber: 2 }],
              subGroup: 1,
            },
            {
              id: 3,
              controlPoint: 'Лаба 3',
              dateString: '08.10.2026',
              gradebookOmissions: 0,
              marks: [{ mark: 9, taskNumber: 3 }],
              subGroup: 1,
            },
          ],
        },
        {
          id: 112,
          abbrev: 'ЛК',
          termHoursId: 1002,
          lessons: [
            {
              id: 4,
              controlPoint: 'КР 1',
              dateString: '15.10.2026',
              gradebookOmissions: 0,
              marks: [{ mark: 8, taskNumber: null }],
              subGroup: 0,
            },
          ],
        },
      ],
    },
    {
      id: 12,
      name: 'Алгоритмы и структуры данных',
      abbrev: 'АиСД',
      lessonTypes: [
        {
          id: 121,
          abbrev: 'ЛР',
          termHoursId: 1003,
          lessons: [
            {
              id: 5,
              controlPoint: 'Лаба 1',
              dateString: '18.09.2026',
              gradebookOmissions: 0,
              marks: [{ mark: 8, taskNumber: 1 }],
              subGroup: 1,
            },
          ],
        },
        {
          id: 122,
          abbrev: 'ПЗ',
          termHoursId: 1004,
          lessons: [
            {
              id: 6,
              controlPoint: 'Тест 1',
              dateString: '02.10.2026',
              gradebookOmissions: 0,
              marks: [{ mark: 7, taskNumber: null }],
              subGroup: 0,
            },
          ],
        },
      ],
    },
    {
      id: 13,
      name: 'Математический анализ',
      abbrev: 'МатАн',
      lessonTypes: [
        {
          id: 131,
          abbrev: 'ПЗ',
          termHoursId: 1005,
          lessons: [
            {
              id: 7,
              controlPoint: 'Контрольная',
              dateString: '20.10.2026',
              gradebookOmissions: 2,
              marks: [{ mark: 9, taskNumber: null }],
              subGroup: 0,
            },
          ],
        },
      ],
    },
  ],
  deadlines: [
    { termHoursId: 1001, labCount: 4, taskCount: 4, deadlines: [] },
    { termHoursId: 1003, labCount: 4, taskCount: 4, deadlines: [] },
  ],
  percentageMarks: [],
};

export const EMPTY_RATING: MockRatingResponse = {
  subjects: [
    {
      id: 21,
      name: 'Философия',
      abbrev: 'Фил',
      lessonTypes: [
        {
          id: 211,
          abbrev: 'СЕМ',
          termHoursId: 2001,
          lessons: [
            {
              id: 10,
              controlPoint: 'Доклад',
              dateString: '11.10.2026',
              gradebookOmissions: 0,
              marks: [{ mark: 0, taskNumber: null }, { mark: -1, taskNumber: null }],
              subGroup: 0,
            },
          ],
        },
      ],
    },
  ],
  deadlines: [{ termHoursId: 2001, labCount: 0, taskCount: 0, deadlines: [] }],
  percentageMarks: [],
};

export const CLAMPED_FULL_LABS_RATING: MockRatingResponse = {
  subjects: [
    {
      id: 31,
      name: 'Операционные системы',
      abbrev: 'ОС',
      lessonTypes: [
        {
          id: 311,
          abbrev: 'ЛР',
          termHoursId: 3001,
          lessons: [
            {
              id: 20,
              controlPoint: 'Лаба 1',
              dateString: '12.09.2026',
              gradebookOmissions: 0,
              marks: [
                { mark: 9, taskNumber: 1 },
                { mark: 10, taskNumber: 2 },
                { mark: 10, taskNumber: 3 },
                { mark: 9, taskNumber: 4 },
              ],
              subGroup: 0,
            },
          ],
        },
      ],
    },
  ],
  deadlines: [{ termHoursId: 3001, labCount: 2, taskCount: 2, deadlines: [] }],
  percentageMarks: [],
};

export const MARKBOOK: MockMarkbookResponse = {
  averageMark: 8.6,
  rating: 9.1,
  place: 2,
  student: {
    fio: 'Соколов Алексей Дмитриевич',
    firstName: 'Алексей',
    lastName: 'Соколов',
    middleName: 'Дмитриевич',
    group: '510902',
  },
  markPages: {
    '1': {
      averageMark: 8.75,
      marks: [
        {
          subject: 'Основы алгоритмизации и программирования',
          mark: '9',
          formOfControl: 'Экзамен',
          date: '14.01.2026',
          teacher: 'Азаров И. В.',
          hours: 144,
        },
        {
          subject: 'Математический анализ',
          mark: '8',
          formOfControl: 'Экзамен',
          date: '18.01.2026',
          teacher: 'Иванов С. А.',
          hours: 180,
        },
        {
          subject: 'Линейная алгебра и аналитическая геометрия',
          mark: '10',
          formOfControl: 'Экзамен',
          date: '22.01.2026',
          teacher: 'Иванов С. А.',
          hours: 120,
        },
        {
          subject: 'Физическая культура',
          mark: 'Зачет',
          formOfControl: 'Зачет',
          date: '28.12.2025',
          teacher: 'Сидоров П. П.',
          hours: 72,
        },
      ],
    },
    '2': {
      averageMark: 6.0,
      marks: [
        {
          subject: 'Физика',
          mark: '6',
          formOfControl: 'Экзамен',
          date: '10.06.2026',
          teacher: 'Иванов С. А.',
          hours: 144,
        },
        {
          subject: 'Дискретная математика',
          mark: '3',
          formOfControl: 'Экзамен',
          date: '15.06.2026',
          teacher: 'Петрова Е. Н.',
          hours: 108,
        },
        {
          subject: 'История Беларуси',
          mark: 'Незачет',
          formOfControl: 'Зачет',
          date: '02.06.2026',
          teacher: 'Козлова О. И.',
          hours: 68,
        },
        {
          subject: 'Алгоритмы и структуры данных',
          mark: null,
          formOfControl: 'Экзамен',
          date: '',
          teacher: 'Петрова Е. Н.',
          hours: 144,
        },
      ],
    },
  },
};

export const ZACHET_ONLY_MARKBOOK: MockMarkbookResponse = {
  averageMark: 0,
  rating: 0,
  place: 10,
  student: { fio: 'Соколов Алексей Дмитриевич', group: '510902' },
  markPages: {
    '1': {
      averageMark: null,
      marks: [
        {
          subject: 'Физическая культура',
          mark: 'Зачет',
          formOfControl: 'Зачет',
          date: '28.12.2025',
          teacher: 'Сидоров П. П.',
          hours: 72,
        },
        {
          subject: 'Инженерная графика',
          mark: 'Незачет',
          formOfControl: 'Зачет',
          date: '29.12.2025',
          teacher: 'Кравцов Д. М.',
          hours: 72,
        },
      ],
    },
  },
};

export function createMultiSemesterMarkbook(count = 8): MockMarkbookResponse {
  const markPages: MockMarkbookResponse['markPages'] = {};
  for (let i = 1; i <= count; i += 1) {
    markPages[String(i)] = {
      averageMark: 8 + (i % 2) * 0.5,
      marks: [
        {
          subject: `Дисциплина семестра ${i}А`,
          mark: String(8 + (i % 3)),
          formOfControl: 'Экзамен',
          date: `15.01.202${Math.min(9, i)}`,
          teacher: 'Азаров И. В.',
          hours: 120,
        },
        {
          subject: `Практикум семестра ${i}Б`,
          mark: 'Зачет',
          formOfControl: 'Зачет',
          date: `25.12.202${Math.min(9, i)}`,
          teacher: 'Петрова Е. Н.',
          hours: 68,
        },
      ],
    };
  }
  return {
    averageMark: 8.5,
    rating: 8.9,
    place: 3,
    student: { fio: 'Соколов Алексей Дмитриевич', group: '510902' },
    markPages,
  };
}

export const GROUP_INFO_HEADMAN: MockGroupInfoResponse = {
  studentGroupCuratorDto: {
    fio: 'Азаров Игорь Викторович',
    position: 'Доцент кафедры ПОИТ',
    phone: '375291234567',
    email: 'azarov@bsuir.by',
    urlId: 'i-azarov',
  },
  groupInfoStudentDto: [
    { fio: 'Соколов Алексей Дмитриевич', position: 'Староста', averageMark: 9.12, rating: 9.12 },
    { fio: 'Волкова Мария Андреевна', position: 'Зам. старосты', averageMark: 9.3, rating: 9.3 },
    { fio: 'Громов Артём Иванович', position: 'Спорторг', averageMark: 8.1, rating: 8.1 },
    { fio: 'Демидова Анна Сергеевна', position: 'Культорг', averageMark: 8.6, rating: 8.6 },
    { fio: 'Егоров Павел Викторович', position: 'Профорг', averageMark: 7.9, rating: 7.9 },
    { fio: 'Жукова Дарья Олеговна', position: 'БРСМ', averageMark: 8.4, rating: 8.4 },
    {
      fio: 'Константинопольский-Свердличенко Александр Владимирович',
      position: '',
      averageMark: 7.5,
      rating: 7.5,
    },
    { fio: 'Морозов Никита Сергеевич', position: '', averageMark: 8.2, rating: 8.2 },
  ],
};

export const GROUP_INFO_REGULAR: MockGroupInfoResponse = {
  ...GROUP_INFO_HEADMAN,
  groupInfoStudentDto: [
    { fio: 'Волкова Мария Андреевна', position: 'Староста', averageMark: 9.3, rating: 9.3 },
    { fio: 'Соколов Алексей Дмитриевич', position: '', averageMark: 9.12, rating: 9.12 },
    { fio: 'Морозов Никита Сергеевич', position: '', averageMark: 8.2, rating: 8.2 },
  ],
};

export const GROUP_STUDENTS_FALLBACK = {
  students: [
    { fio: 'Соколов Алексей Дмитриевич', averageMark: 9.12 },
    { fio: 'Волкова Мария Андреевна', averageMark: 9.3 },
    { fio: 'Морозов Никита Сергеевич', averageMark: 8.2 },
  ],
};

export const GROUP_RATING_FALLBACK = [
  { fio: 'Волкова Мария Андреевна', averageMark: 9.3, rating: 9.3 },
  { fio: 'Соколов Алексей Дмитриевич', averageMark: 9.12, rating: 9.12 },
  { fio: 'Громов Артём Иванович', averageMark: 8.1, rating: 8.1 },
];

export const NOTIFICATIONS: MockDeanNotification[] = [
  {
    id: 901,
    message: 'Назначена пересдача экзамена по дисциплине "Математический анализ" на 28.11.2026.',
    date: '18.11.2026',
    type: 'INFO',
    isViewed: false,
  },
  {
    id: 902,
    message: 'Справка об обучении №412 готова и ожидает выдачи в деканате ФКП.',
    date: '17.11.2026',
    type: 'SUCCESS',
    isViewed: false,
  },
  {
    id: 903,
    message: 'Внимание: истекает срок ликвидации академической задолженности по Физике.',
    date: '15.11.2026',
    type: 'FAILURE',
    isViewed: true,
  },
  {
    id: 904,
    message: 'Открыта запись на факультатив по алгоритмам <script>window.__xss=1</script> & C++.',
    date: '12.11.2026',
    type: 'INFO',
    isViewed: true,
  },
];

export const CERTIFICATES: MockCertificateItem[] = [
  {
    id: 301,
    number: 412,
    certificateType: 'обычная',
    provisionPlace: 'По месту работы родителей',
    dateOrder: '10.11.2026',
    issueDate: '12.11.2026',
    status: 1,
    rejectionReason: null,
  },
  {
    id: 302,
    number: 418,
    certificateType: 'гербовая',
    provisionPlace: 'В военный комиссариат',
    dateOrder: '18.11.2026',
    issueDate: null,
    status: 2,
    rejectionReason: null,
  },
  {
    id: 303,
    number: 399,
    certificateType: 'обычная',
    provisionPlace: 'В посольство',
    dateOrder: '05.11.2026',
    issueDate: null,
    status: 3,
    rejectionReason: 'Неверно указано наименование учреждения',
  },
];

export const CERTIFICATE_PLACES: MockCertificatePlaceGroup[] = [
  {
    type: 'Государственные органы',
    places: [
      { name: 'По месту работы родителей', type: 0 },
      { name: 'В военный комиссариат', type: 1 },
      { name: 'В ФСЗН', type: 0 },
    ],
  },
  {
    type: 'Прочие',
    places: [
      { name: 'По месту требования', type: 0 },
      { name: 'В посольство', type: 0 },
    ],
  },
];

export const MARK_SHEETS: MockMarkSheetItem[] = [
  {
    id: 401,
    number: 'В-2026-88',
    subject: { name: 'Основы алгоритмизации и программирования', abbrev: 'ОАиП', lessonTypeAbbrev: 'ЛР', term: 3 },
    employee: { fio: 'Азаров И. В.' },
    absentDate: '12.11.2026',
    createDate: '14.11.2026',
    expireDate: '28.11.2026',
    hours: 2,
    price: 0,
    reason: true,
    status: 'В обработке',
    rejectionReason: null,
    term: 3,
  },
  {
    id: 402,
    number: 'В-2026-71',
    subject: { name: 'Алгоритмы и структуры данных', abbrev: 'АиСД', lessonTypeAbbrev: 'ЛР', term: 3 },
    employee: { fio: 'Петрова Е. Н.' },
    absentDate: '04.11.2026',
    createDate: '06.11.2026',
    expireDate: '20.11.2026',
    hours: 4,
    price: 23.0,
    reason: false,
    status: 'Напечатана',
    rejectionReason: null,
    term: 3,
  },
];

export const MARK_SHEET_SUBJECTS: MockMarkSheetSubject[] = [
  {
    abbrev: 'ОАиП',
    term: 3,
    lessonTypes: [
      { abbrev: 'ЛР', thId: 1001, focsId: null },
      { abbrev: 'Экзамен', thId: null, focsId: 201 },
    ],
  },
  {
    abbrev: 'АиСД',
    term: 3,
    lessonTypes: [
      { abbrev: 'ЛР', thId: 1003, focsId: null },
      { abbrev: 'Экзамен', thId: null, focsId: 202 },
    ],
  },
  {
    abbrev: 'МатАн',
    term: 3,
    lessonTypes: [
      { abbrev: 'ПЗ', thId: 1005, focsId: null },
      { abbrev: 'Зачет', thId: null, focsId: 203 },
    ],
  },
];

export const OMISSIONS: MockOmissionEntry[] = [
  {
    student: {
      fio: 'Соколов Алексей Дмитриевич',
      lessons: [
        {
          nameLesson: 'Математический анализ',
          lessonType: 'ПЗ',
          dateString: '14.11.2026',
          gradeBookOmissions: 2,
          isRespectfulOmission: false,
          note: '',
          teacher: 'Иванов С. А.',
        },
        {
          nameLesson: 'ОАиП',
          lessonType: 'ЛР',
          dateString: '06.11.2026',
          gradeBookOmissions: 4,
          isRespectfulOmission: true,
          note: 'Медицинская справка 095/у',
          teacher: 'Азаров И. В.',
        },
        {
          nameLesson: 'Физика',
          lessonType: 'ЛК',
          dateString: '16.10.2026',
          gradeBookOmissions: 2,
          isRespectfulOmission: true,
          note: 'Заявление по семейным обстоятельствам',
          teacher: 'Иванов С. А.',
        },
      ],
    },
  },
];

export const OMISSIONS_BY_STUDENT: MockOmissionByStudentResponse = {
  omissionDtoList: [
    {
      name: 'Медицинская справка',
      note: 'Поликлиника №33',
      dateFrom: '2026-11-05',
      dateTo: '2026-11-07',
      term: '3',
      omissionCount: 4,
    },
  ],
};

export const DISRESPECTFUL_OMISSIONS: MockDisrespectfulOmissionItem[] = [
  {
    omissionCount: 2,
    month: 11,
    date: '14.11.2026',
  },
];

export const PERMANENT_ADDRESS = 'Республика Беларусь, г. Минск, ул. П. Бровки, д. 6, корп. 2';

export const DORMITORY_APPLICATIONS: MockDormitoryApplication[] = [
  {
    id: 601,
    number: 1842,
    numberInQueue: '47',
    status: 'Заселён',
    roomInfo: 'Общежитие №4, блок 512',
    applicationDate: '2026-06-15',
    acceptedDate: '2026-07-02',
    settledDate: '2026-08-29',
    rejectionReason: null,
  },
  {
    id: 602,
    number: 1995,
    numberInQueue: null,
    status: 'Отклонена',
    roomInfo: null,
    applicationDate: '2026-09-10',
    acceptedDate: null,
    settledDate: null,
    rejectionReason: 'Неполный комплект документов о доходах семьи',
  },
];

export const DORMITORY_PRIVILEGES: MockDormitoryPrivilege[] = [
  {
    id: 701,
    year: 2026,
    dormitoryPrivilegeCategoryName: 'Первоочередное заселение',
    dormitoryPrivilegeName: 'Активный участник студенческого самоуправления',
    note: 'Действует на 2026–2027 учебный год',
  },
];

export const PENALTIES: MockPenaltyDirective[] = [
  {
    id: 801,
    reason: 'Отличные успехи в учёбе и участие в олимпиаде по программированию',
    status: 'Поощрение',
    note: 'Благодарность декана ФКП',
    directiveDto: {
      typeName: 'Поощрение',
      date: '15.10.2026',
      number: '112-ст',
    },
  },
];

export const ANNOUNCEMENTS: MockAnnouncement[] = [
  {
    id: 101,
    title: 'Расписание пересдач за осенний семестр',
    content: 'График приёма задолженностей опубликован в системе ИИС и на стенде деканата.',
    date: '18.11.2026',
    type: 'Учебный процесс',
  },
  {
    id: 102,
    title: 'Хакатон БГУИР Tech Challenge 2026',
    content: 'Регистрация команд открыта до 30 ноября. Приглашаются студенты 1–4 курсов.',
    date: '14.11.2026',
    type: 'Мероприятия',
  },
];

export const HEADMAN_SUBJECTS: Record<string, MockHeadmanSubjectItem[]> = {
  ОАиП: [
    { id: 1001, lessonTypeAbbrev: 'ЛК' },
    { id: 1002, lessonTypeAbbrev: 'ЛР' },
  ],
  АиСД: [{ id: 1003, lessonTypeAbbrev: 'ЛР' }],
};

export const HEADMAN_STUDENTS: MockHeadmanStudent[] = [
  { studentId: 1, fullName: 'Волкова Мария Андреевна' },
  { studentId: 2, fullName: 'Громов Артём Иванович' },
  { studentId: 3, fullName: 'Морозов Никита Сергеевич' },
  { studentId: 4, fullName: 'Соколов Алексей Дмитриевич' },
];

export const HEADMAN_DATA_BY_TERM_HOURS: Record<number, MockHeadmanData> = {
  1001: {
    lessons: [
      { id: 5001, date: '12.11.2026', subgroup: 0, numberOfHours: 2 },
      { id: 5002, date: '19.11.2026', subgroup: 0, numberOfHours: 2 },
    ],
    attendance: [
      { studentId: 2, lessonRecords: { '5001': { missedHours: 2 } } },
      { studentId: 3, lessonRecords: { '5002': { missedHours: 1 } } },
    ],
  },
  1002: {
    lessons: [{ id: 5003, date: '14.11.2026', subgroup: 1, numberOfHours: 2 }],
    attendance: [],
  },
  1003: {
    lessons: [{ id: 5004, date: '18.11.2026', subgroup: 1, numberOfHours: 2 }],
    attendance: [{ studentId: 1, lessonRecords: { '5004': { missedHours: 2 } } }],
  },
};

export function createLargeNotesPayload(count = 25): MockNote[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `note-large-${idx + 1}`,
    subject: idx % 2 === 0 ? 'ОАиП' : 'АиСД',
    text: `Подготовка к лабораторной работе №${idx + 1}: реализовать структуру данных, покрыть граничные случаи и проверить асимптотику на больших входах (${'A'.repeat(160)}).`,
    date: `2${(idx % 9) + 1}.11.2026`,
    time: '10:35',
    isEvent: idx % 3 === 0,
    isPinned: idx === 0,
    lessonType: idx % 3 === 0 ? 'ЛР' : idx % 3 === 1 ? 'ЛК' : 'ПЗ',
    attachments: [],
  }));
}
