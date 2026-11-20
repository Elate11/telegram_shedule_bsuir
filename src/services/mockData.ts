import type {
  AnnouncementItem,
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
  DormitoryApplicationDto,
  DormitoryPrivilegeDto,
  GroupInfoNormalized,
  GroupRatingEntry,
  GroupStudentDto,
  HeadmanCreatePayload,
  HeadmanJournalData,
  MarkSheetCreatePayload,
  MarkSheetDto,
  MarkSheetSubjectDto,
  MarkbookResponse,
  OmissionsSummary,
  OrviOmissionPayload,
  OrviOmissionResult,
  PenaltyDirectiveDto,
  PersonalCvDto,
  ProfileCvSectionEndpoint,
} from '../types';
import { calculateMarkSheetCost, formatIsoToDDMMYYYY } from '../utils/formatters';
import { getBsuirWeekInfo } from '../utils/scheduleMath';

export const MOCK_STATE_STORAGE_KEY = 'bsuir_mock_state_v1';
export const MOCK_ORVI_MONTHLY_DAY_LIMIT = 5;

// ==================== Static BSUIR Catalog Fixtures ====================

export const MOCK_STUDENT_GROUPS: BsuirStudentGroup[] = [
  {
    id: 310101,
    name: '310101',
    facultyAbbrev: 'ФКП',
    specialityAbbrev: 'ИСиТ (в И)',
    course: 3,
  },
  {
    id: 510902,
    name: '510902',
    facultyAbbrev: 'ФКСиС',
    specialityAbbrev: 'ПОИТ',
    course: 1,
  },
  {
    id: 251001,
    name: '251001',
    facultyAbbrev: 'ФКСиС',
    specialityAbbrev: 'ВМСиС',
    course: 4,
  },
  {
    id: 153501,
    name: '153501',
    facultyAbbrev: 'ФКСиС',
    specialityAbbrev: 'ИиТП',
    course: 4,
  },
  {
    id: 351001,
    name: '351001',
    facultyAbbrev: 'ФКСиС',
    specialityAbbrev: 'ПОИТ',
    course: 3,
  },
  {
    id: 351002,
    name: '351002',
    facultyAbbrev: 'ФКСиС',
    specialityAbbrev: 'ПОИТ',
    course: 3,
  },
];

export const MOCK_EMPLOYEES: BsuirEmployee[] = [
  {
    id: 500101,
    urlId: 'a-smirnov',
    firstName: 'Алексей',
    lastName: 'Смирнов',
    middleName: 'Владимирович',
    fio: 'Смирнов А. В.',
    fullName: 'Смирнов Алексей Владимирович',
    degree: 'к.т.н.',
    rank: 'доцент',
    photoLink: null,
    academicDepartment: ['Кафедра ИПИ'],
  },
  {
    id: 500102,
    urlId: 'e-ivanova',
    firstName: 'Елена',
    lastName: 'Иванова',
    middleName: 'Сергеевна',
    fio: 'Иванова Е. С.',
    fullName: 'Иванова Елена Сергеевна',
    degree: 'к.т.н.',
    rank: 'доцент',
    photoLink: null,
    academicDepartment: ['Кафедра ПОИТ'],
  },
  {
    id: 500103,
    urlId: 'd-kovalev',
    firstName: 'Дмитрий',
    lastName: 'Ковалёв',
    middleName: 'Николаевич',
    fio: 'Ковалёв Д. Н.',
    fullName: 'Ковалёв Дмитрий Николаевич',
    degree: null,
    rank: 'ст. преп.',
    photoLink: null,
    academicDepartment: ['Кафедра ВМСиС'],
  },
  {
    id: 500104,
    urlId: 'o-petrova',
    firstName: 'Ольга',
    lastName: 'Петрова',
    middleName: 'Игоревна',
    fio: 'Петрова О. И.',
    fullName: 'Петрова Ольга Игоревна',
    degree: 'к.ф.-м.н.',
    rank: 'доцент',
    photoLink: null,
    academicDepartment: ['Кафедра Высшей математики'],
  },
];

function empById(urlId: string): BsuirEmployee {
  return MOCK_EMPLOYEES.find((e) => e.urlId === urlId) ?? MOCK_EMPLOYEES[0];
}

function buildGroupScheduleFixture(group: string): BsuirScheduleResponse {
  const groupObj = MOCK_STUDENT_GROUPS.find((g) => g.name === group) ?? {
    id: 310101,
    name: group,
    facultyAbbrev: 'ФКП',
    specialityAbbrev: 'ИСиТ',
    course: 3,
  };

  const coGroups =
    group === '351001'
      ? [{ name: '351001' }, { name: '351002' }]
      : [{ name: group }, { name: group === '310101' ? '310102' : '310101' }];

  const singleGroup = [{ name: group }];

  return {
    studentGroupDto: groupObj,
    currentWeekNumber: getBsuirWeekInfo(new Date()).weekNumber,
    startDate: '01.09.2025',
    endDate: '28.12.2025',
    startExamsDate: '08.01.2026',
    endExamsDate: '25.01.2026',
    schedules: {
      Понедельник: [
        {
          subject: 'РПМ',
          subjectFullName: 'Разработка программных модулей',
          lessonTypeAbbrev: 'ЛК',
          startLessonTime: '09:00',
          endLessonTime: '10:25',
          numSubgroup: 0,
          weekNumber: [1, 2, 3, 4],
          auditories: ['312-4'],
          employees: [empById('a-smirnov')],
          studentGroups: coGroups,
        },
        {
          subject: 'РПМ',
          subjectFullName: 'Разработка программных модулей',
          lessonTypeAbbrev: 'ЛР',
          startLessonTime: '10:35',
          endLessonTime: '12:00',
          numSubgroup: 1,
          weekNumber: [1, 3],
          auditories: ['404-5'],
          employees: [empById('e-ivanova')],
          studentGroups: singleGroup,
          note: 'Защита ЛР №3',
        },
        {
          subject: 'АиСД',
          subjectFullName: 'Алгоритмы и структуры данных',
          lessonTypeAbbrev: 'ЛР',
          startLessonTime: '10:35',
          endLessonTime: '12:00',
          numSubgroup: 2,
          weekNumber: [2, 4],
          auditories: ['406-5'],
          employees: [empById('d-kovalev')],
          studentGroups: singleGroup,
        },
      ],
      Вторник: [
        {
          subject: 'БД',
          subjectFullName: 'Базы данных',
          lessonTypeAbbrev: 'ЛК',
          startLessonTime: '09:00',
          endLessonTime: '10:25',
          numSubgroup: 0,
          weekNumber: [1, 2, 3, 4],
          auditories: ['105-4'],
          employees: [empById('e-ivanova')],
          studentGroups: coGroups,
        },
        {
          subject: 'БД',
          subjectFullName: 'Базы данных',
          lessonTypeAbbrev: 'ПЗ',
          startLessonTime: '12:25',
          endLessonTime: '13:50',
          numSubgroup: 0,
          weekNumber: [1, 2, 3, 4],
          auditories: ['210-4'],
          employees: [empById('e-ivanova')],
          studentGroups: singleGroup,
        },
      ],
      Среда: [
        {
          subject: 'АиСД',
          subjectFullName: 'Алгоритмы и структуры данных',
          lessonTypeAbbrev: 'ЛК',
          startLessonTime: '10:35',
          endLessonTime: '12:00',
          numSubgroup: 0,
          weekNumber: [1, 2, 3, 4],
          auditories: ['201-4'],
          employees: [empById('d-kovalev')],
          studentGroups: coGroups,
        },
        {
          subject: 'КС',
          subjectFullName: 'Компьютерные сети',
          lessonTypeAbbrev: 'ЛР',
          startLessonTime: '14:00',
          endLessonTime: '15:25',
          numSubgroup: 1,
          weekNumber: [1, 2, 3, 4],
          auditories: ['512-5'],
          employees: [empById('a-smirnov')],
          studentGroups: singleGroup,
        },
      ],
      Четверг: [
        {
          subject: 'МатАн',
          subjectFullName: 'Математический анализ',
          lessonTypeAbbrev: 'ПЗ',
          startLessonTime: '09:00',
          endLessonTime: '10:25',
          numSubgroup: 0,
          weekNumber: [1, 2, 3, 4],
          auditories: ['308-2'],
          employees: [empById('o-petrova')],
          studentGroups: singleGroup,
        },
        {
          subject: 'ФизК',
          subjectFullName: 'Физическая культура',
          lessonTypeAbbrev: 'ПЗ',
          startLessonTime: '12:25',
          endLessonTime: '13:50',
          numSubgroup: 0,
          weekNumber: [1, 2, 3, 4],
          auditories: [],
          employees: [],
          studentGroups: singleGroup,
        },
      ],
      Пятница: [
        {
          subject: 'ООП',
          subjectFullName: 'Объектно-ориентированное программирование',
          lessonTypeAbbrev: 'ЛК',
          startLessonTime: '09:00',
          endLessonTime: '10:25',
          numSubgroup: 0,
          weekNumber: [1, 3],
          auditories: ['101-4'],
          employees: [empById('a-smirnov')],
          studentGroups: coGroups,
        },
        {
          subject: 'ООП',
          subjectFullName: 'Объектно-ориентированное программирование',
          lessonTypeAbbrev: 'ЛР',
          startLessonTime: '10:35',
          endLessonTime: '12:00',
          numSubgroup: 0,
          weekNumber: [2, 4],
          auditories: ['402-5'],
          employees: [empById('a-smirnov')],
          studentGroups: singleGroup,
        },
      ],
      Суббота: [
        {
          subject: 'КС',
          subjectFullName: 'Компьютерные сети',
          lessonTypeAbbrev: 'ПЗ',
          startLessonTime: '10:35',
          endLessonTime: '12:00',
          numSubgroup: 0,
          weekNumber: [1, 3],
          auditories: ['215-4'],
          employees: [empById('d-kovalev')],
          studentGroups: singleGroup,
        },
      ],
    },
    exams: [
      {
        subject: 'РПМ',
        subjectFullName: 'Разработка программных модулей',
        lessonTypeAbbrev: 'Экзамен',
        startLessonTime: '09:00',
        endLessonTime: '12:00',
        numSubgroup: 0,
        weekNumber: [1, 2, 3, 4],
        auditories: ['312-4'],
        employees: [empById('a-smirnov')],
        studentGroups: singleGroup,
        dateLesson: '12.01.2026',
      },
      {
        subject: 'БД',
        subjectFullName: 'Базы данных',
        lessonTypeAbbrev: 'Консультация',
        startLessonTime: '11:00',
        endLessonTime: '11:45',
        numSubgroup: 0,
        weekNumber: [1, 2, 3, 4],
        auditories: ['105-4'],
        employees: [empById('e-ivanova')],
        studentGroups: singleGroup,
        dateLesson: '15.01.2026',
      },
      {
        subject: 'БД',
        subjectFullName: 'Базы данных',
        lessonTypeAbbrev: 'Экзамен',
        startLessonTime: '09:00',
        endLessonTime: '12:00',
        numSubgroup: 0,
        weekNumber: [1, 2, 3, 4],
        auditories: ['105-4'],
        employees: [empById('e-ivanova')],
        studentGroups: singleGroup,
        dateLesson: '17.01.2026',
      },
    ],
  };
}

export function getMockGroupSchedule(group: string): BsuirScheduleResponse {
  const normalized = group.trim() === '114001' || !group.trim() ? '310101' : group.trim();
  return buildGroupScheduleFixture(normalized);
}

export function getMockEmployeeSchedule(urlId: string): BsuirScheduleResponse {
  const emp = empById(urlId);
  const coGroups351 = [{ name: '351001' }, { name: '351002' }];
  const coGroups310 = [{ name: '310101' }, { name: '310102' }];

  return {
    employeeDto: emp,
    currentWeekNumber: getBsuirWeekInfo(new Date()).weekNumber,
    startDate: '01.09.2025',
    endDate: '28.12.2025',
    startExamsDate: '08.01.2026',
    endExamsDate: '25.01.2026',
    schedules: {
      Понедельник: [
        {
          subject: 'РПМ',
          subjectFullName: 'Разработка программных модулей',
          lessonTypeAbbrev: 'ЛК',
          startLessonTime: '09:00',
          endLessonTime: '10:25',
          numSubgroup: 0,
          weekNumber: [1, 2, 3, 4],
          auditories: ['312-4'],
          employees: [emp],
          studentGroups: coGroups310,
        },
        {
          subject: 'РПМ',
          subjectFullName: 'Разработка программных модулей',
          lessonTypeAbbrev: 'ЛК',
          startLessonTime: '12:25',
          endLessonTime: '13:50',
          numSubgroup: 0,
          weekNumber: [1, 2, 3, 4],
          auditories: ['101-4'],
          employees: [emp],
          studentGroups: coGroups351,
        },
      ],
      Вторник: [
        {
          subject: 'БД',
          subjectFullName: 'Базы данных',
          lessonTypeAbbrev: 'ЛК',
          startLessonTime: '09:00',
          endLessonTime: '10:25',
          numSubgroup: 0,
          weekNumber: [1, 2, 3, 4],
          auditories: ['105-4'],
          employees: [emp],
          studentGroups: coGroups310,
        },
      ],
      Среда: [
        {
          subject: 'АиСД',
          subjectFullName: 'Алгоритмы и структуры данных',
          lessonTypeAbbrev: 'ЛК',
          startLessonTime: '10:35',
          endLessonTime: '12:00',
          numSubgroup: 0,
          weekNumber: [1, 2, 3, 4],
          auditories: ['201-4'],
          employees: [emp],
          studentGroups: coGroups351,
        },
      ],
      Пятница: [
        {
          subject: 'ООП',
          subjectFullName: 'Объектно-ориентированное программирование',
          lessonTypeAbbrev: 'ЛК',
          startLessonTime: '09:00',
          endLessonTime: '10:25',
          numSubgroup: 0,
          weekNumber: [1, 3],
          auditories: ['101-4'],
          employees: [emp],
          studentGroups: coGroups310,
        },
      ],
    },
    exams: [
      {
        subject: 'РПМ',
        subjectFullName: 'Разработка программных модулей',
        lessonTypeAbbrev: 'Экзамен',
        startLessonTime: '09:00',
        endLessonTime: '12:00',
        numSubgroup: 0,
        weekNumber: [1, 2, 3, 4],
        auditories: ['312-4'],
        employees: [emp],
        studentGroups: [{ name: '310101' }],
        dateLesson: '12.01.2026',
      },
    ],
  };
}

// ==================== Static Read-Only IIS Fixtures ====================

export const MOCK_RATING_RESPONSE: BsuirRatingResponse = {
  deadlines: [
    {
      termHoursId: 1001,
      labCount: 5,
      taskCount: 5,
      deadlines: [
        { lessonId: 1, taskNumber: 1 },
        { lessonId: 2, taskNumber: 2 },
        { lessonId: 3, taskNumber: 3 },
        { lessonId: 4, taskNumber: 4 },
        { lessonId: 5, taskNumber: 5 },
      ],
    },
    {
      termHoursId: 1002,
      labCount: 4,
      taskCount: 4,
      deadlines: [
        { lessonId: 11, taskNumber: 1 },
        { lessonId: 12, taskNumber: 2 },
        { lessonId: 13, taskNumber: 3 },
        { lessonId: 14, taskNumber: 4 },
      ],
    },
    {
      termHoursId: 1003,
      labCount: 4,
      taskCount: 4,
    },
  ],
  subjects: [
    {
      id: 1,
      name: 'Разработка программных модулей',
      abbrev: 'РПМ',
      lessonTypes: [
        {
          id: 4,
          abbrev: 'ЛР',
          termHoursId: 1001,
          lessons: [
            {
              id: 1,
              controlPoint: 'ЛР 1',
              dateString: '15.09.2025',
              marks: [{ mark: 9, taskNumber: 1 }],
              subGroup: 1,
            },
            {
              id: 2,
              controlPoint: 'ЛР 2',
              dateString: '29.09.2025',
              marks: [{ mark: 8, taskNumber: 2 }],
              subGroup: 1,
            },
            {
              id: 3,
              controlPoint: 'ЛР 3',
              dateString: '13.10.2025',
              marks: [{ mark: 10, taskNumber: 3 }],
              subGroup: 1,
            },
          ],
        },
        {
          id: 1,
          abbrev: 'ЛК',
          termHoursId: 1011,
          lessons: [
            {
              id: 4,
              controlPoint: 'КР 1',
              dateString: '20.10.2025',
              marks: [{ mark: 9, taskNumber: 0 }],
            },
          ],
        },
      ],
    },
    {
      id: 2,
      name: 'Базы данных',
      abbrev: 'БД',
      lessonTypes: [
        {
          id: 4,
          abbrev: 'ЛР',
          termHoursId: 1002,
          lessons: [
            {
              id: 11,
              controlPoint: 'ЛР 1',
              dateString: '18.09.2025',
              marks: [{ mark: 8, taskNumber: 1 }],
            },
            {
              id: 12,
              controlPoint: 'ЛР 2',
              dateString: '02.10.2025',
              marks: [{ mark: 9, taskNumber: 2 }],
            },
          ],
        },
        {
          id: 2,
          abbrev: 'ПЗ',
          termHoursId: 1012,
          lessons: [
            {
              id: 15,
              controlPoint: 'Тест 1',
              dateString: '09.10.2025',
              marks: [{ mark: 8 }],
            },
          ],
        },
      ],
    },
    {
      id: 3,
      name: 'Компьютерные сети',
      abbrev: 'КС',
      lessonTypes: [
        {
          id: 4,
          abbrev: 'ЛР',
          termHoursId: 1003,
          lessons: [
            {
              id: 21,
              controlPoint: 'ЛР 1',
              dateString: '25.09.2025',
              marks: [{ mark: 10, taskNumber: 1 }],
            },
          ],
        },
      ],
    },
    {
      id: 4,
      name: 'Математический анализ',
      abbrev: 'МатАн',
      lessonTypes: [
        {
          id: 2,
          abbrev: 'ПЗ',
          termHoursId: 1004,
          lessons: [
            {
              id: 31,
              controlPoint: 'Контрольная работа',
              dateString: '10.10.2025',
              marks: [{ mark: 8 }],
            },
          ],
        },
      ],
    },
  ],
  percentageMarks: [
    { discipline: 'РПМ', date: '13.10.2025', number: 72 },
    { discipline: 'БД', date: '09.10.2025', number: 60 },
  ],
};

export const MOCK_MARKBOOK: MarkbookResponse = {
  averageMark: 8.65,
  rating: 8.65,
  place: 3,
  studentGroup: '310101',
  student: {
    fio: 'Соколов Артём Дмитриевич',
    firstName: 'Артём',
    lastName: 'Соколов',
    middleName: 'Дмитриевич',
    group: '310101',
    studentGroup: '310101',
    facultyAbbrev: 'ФКП',
    course: 3,
  },
  markBookGroupDto: {
    studentGroup: '310101',
  },
  markPages: {
    '1': {
      averageMark: 8.2,
      marks: [
        {
          subject: 'Высшая математика',
          mark: 8,
          formOfControl: 'Экзамен',
          date: '16.01.2024',
          teacher: 'Петрова О. И.',
          hours: 144,
        },
        {
          subject: 'Основы алгоритмизации и программирования',
          mark: 9,
          formOfControl: 'Экзамен',
          date: '22.01.2024',
          teacher: 'Смирнов А. В.',
          hours: 180,
        },
        {
          subject: 'Инженерная графика',
          mark: 'Зачет',
          formOfControl: 'Зачет',
          date: '29.12.2023',
          teacher: 'Ковалёв Д. Н.',
          hours: 72,
        },
      ],
    },
    '2': {
      averageMark: 8.7,
      marks: [
        {
          subject: 'Математический анализ',
          mark: 9,
          formOfControl: 'Экзамен',
          date: '14.06.2024',
          teacher: 'Петрова О. И.',
          hours: 144,
        },
        {
          subject: 'Объектно-ориентированное программирование',
          mark: 9,
          formOfControl: 'Экзамен',
          date: '20.06.2024',
          teacher: 'Смирнов А. В.',
          hours: 180,
        },
        {
          subject: 'Физическая культура',
          mark: 'Зачет',
          formOfControl: 'Зачет',
          date: '05.06.2024',
          teacher: 'Волков И. А.',
          hours: 72,
        },
      ],
    },
    '3': {
      averageMark: 9.0,
      marks: [
        {
          subject: 'Алгоритмы и структуры данных',
          mark: 9,
          formOfControl: 'Экзамен',
          date: '17.01.2025',
          teacher: 'Ковалёв Д. Н.',
          hours: 144,
        },
        {
          subject: 'Базы данных',
          mark: 9,
          formOfControl: 'Экзамен',
          date: '23.01.2025',
          teacher: 'Иванова Е. С.',
          hours: 144,
        },
        {
          subject: 'Компьютерные сети',
          mark: 'Зачет',
          formOfControl: 'Дифф. зачет',
          date: '28.12.2024',
          teacher: 'Смирнов А. В.',
          hours: 108,
        },
      ],
    },
  },
};

export const MOCK_GROUP_CURATOR: CuratorDto = {
  fio: 'Иванова Елена Сергеевна',
  position: 'Старший преподаватель кафедры ПОИТ',
  phone: '+375291234567',
  email: 'ivanova@bsuir.by',
  urlId: 'e-ivanova',
};

export const MOCK_GROUP_STUDENTS: GroupStudentDto[] = [
  { fio: 'Алексеев Максим Игоревич', position: 1, role: null, averageMark: 9.2, rating: 9.2, isCurrentUser: false },
  { fio: 'Белова Анна Сергеевна', position: 2, role: 'Профорг', averageMark: 8.9, rating: 8.9, isCurrentUser: false },
  { fio: 'Соколов Артём Дмитриевич', position: 3, role: 'Староста', averageMark: 8.65, rating: 8.65, isCurrentUser: true },
  { fio: 'Волкова Дарья Андреевна', position: 4, role: 'Зам. старосты', averageMark: 8.4, rating: 8.4, isCurrentUser: false },
  { fio: 'Громов Никита Павлович', position: 5, role: 'Спорторг', averageMark: 8.1, rating: 8.1, isCurrentUser: false },
  { fio: 'Дроздова Мария Олеговна', position: 6, role: 'Культорг', averageMark: 7.9, rating: 7.9, isCurrentUser: false },
  { fio: 'Ершов Владислав Романович', position: 7, role: 'БРСМ', averageMark: 7.7, rating: 7.7, isCurrentUser: false },
  { fio: 'Жукова Полина Викторовна', position: 8, role: null, averageMark: 7.5, rating: 7.5, isCurrentUser: false },
  { fio: 'Зайцев Кирилл Александрович', position: 9, role: null, averageMark: 7.3, rating: 7.3, isCurrentUser: false },
  { fio: 'Карпов Егор Денисович', position: 10, role: null, averageMark: 7.0, rating: 7.0, isCurrentUser: false },
  { fio: 'Лебедева Ксения Артуровна', position: 11, role: null, averageMark: 6.8, rating: 6.8, isCurrentUser: false },
  { fio: 'Морозов Тимур Сергеевич', position: 12, role: null, averageMark: 6.5, rating: 6.5, isCurrentUser: false },
];

export const MOCK_GROUP_RATING: GroupRatingEntry[] = MOCK_GROUP_STUDENTS.map((s) => ({
  fio: s.fio,
  fullName: s.fio,
  averageMark: s.averageMark,
  rating: s.rating,
  place: s.position,
}));

export const MOCK_PERMANENT_ADDRESS = 'г. Минск, ул. П. Бровки, д. 6, общ. №2, к. 412';

export const MOCK_CERTIFICATE_PLACES: CertificatePlaceGroup[] = [
  {
    categoryTitle: 'Обычные справки',
    places: [
      { name: 'По месту требования', type: 0 },
      { name: 'В военкомат', type: 0 },
      { name: 'В налоговую инспекцию', type: 0 },
      { name: 'По месту работы родителей', type: 0 },
    ],
  },
  {
    categoryTitle: 'Гербовые справки',
    places: [
      { name: 'В посольство (визовый центр)', type: 1 },
      { name: 'Для оформления загранпаспорта', type: 1 },
    ],
  },
];

export const MOCK_MARK_SHEET_SUBJECTS: MarkSheetSubjectDto[] = [
  {
    abbrev: 'РПМ',
    term: 5,
    lessonTypes: [
      { abbrev: 'ЛР', thId: 1001, focsId: null },
      { abbrev: 'ЛК', thId: 1011, focsId: null },
    ],
  },
  {
    abbrev: 'БД',
    term: 5,
    lessonTypes: [
      { abbrev: 'ЛР', thId: 1002, focsId: null },
      { abbrev: 'ПЗ', thId: 1012, focsId: null },
    ],
  },
  {
    abbrev: 'КС',
    term: 5,
    lessonTypes: [{ abbrev: 'ЛР', thId: 1003, focsId: null }],
  },
  {
    abbrev: 'МатАн',
    term: 5,
    lessonTypes: [{ abbrev: 'ПЗ', thId: 1004, focsId: null }],
  },
];

export const MOCK_DORMITORY_APPLICATIONS: DormitoryApplicationDto[] = [
  {
    id: 401,
    number: 2025114,
    numberInQueue: '18',
    status: 'Заселён',
    roomInfo: 'Общежитие №2, к. 412',
    applicationDate: '12.08.2025',
    acceptedDate: '20.08.2025',
    settledDate: '29.08.2025',
    rejectionReason: null,
  },
];

export const MOCK_DORMITORY_PRIVILEGES: DormitoryPrivilegeDto[] = [
  {
    id: 1,
    year: 2025,
    categoryName: 'Учебная и научная деятельность',
    privilegeName: 'Высокий средний балл (>= 8.5)',
    note: 'Подтверждено деканатом ФКП',
  },
];

export const MOCK_PENALTIES: PenaltyDirectiveDto[] = [
  {
    id: 1,
    type: 'Поощрение (Благодарность)',
    reason: 'Активное участие в жизни факультета и научная работа',
    status: 'Действует',
    date: '14.04.2025',
    directiveNumber: '№ 312-с',
    note: 'Приказ ректора БГУИР',
  },
];

export const MOCK_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: 1,
    title: 'График пересдач осенней промежуточной аттестации',
    type: 'Учебный процесс',
    content: 'Пересдачи лабораторных и практических работ проводятся согласно расписанию кафедр по предварительно полученным ведомостям в ИИС.',
    date: '15.10.2025',
    url: 'https://iis.bsuir.by',
  },
  {
    id: 2,
    title: 'Открыта запись на олимпиаду BSUIR Open',
    type: 'Мероприятие',
    content: 'Регистрация студенческих команд ФКП и ФКСиС открыта до конца месяца в личном кабинете.',
    date: '08.10.2025',
    url: 'https://iis.bsuir.by',
  },
  {
    id: 3,
    title: 'Обновление сервиса электронных справок',
    type: 'Сервисы ИИС',
    content: 'Заказ обычных и гербовых справок с выдачей в деканате доступен онлайн в разделе «Учёба».',
    date: '01.10.2025',
    url: 'https://iis.bsuir.by',
  },
];

// ==================== Stateful Persistent Mock Store ====================

export interface StatefulMockStore {
  authenticatedUsername: string | null;
  personalCv: PersonalCvDto;
  notifications: DeanNotification[];
  certificates: CertificateDto[];
  markSheets: MarkSheetDto[];
  omissions: OmissionsSummary;
  orviDaysByMonth: Record<string, number>;
  headman: HeadmanJournalData;
  nextId: number;
}

function createInitialMockState(): StatefulMockStore {
  return {
    authenticatedUsername: null,
    nextId: 5000,
    personalCv: {
      id: 31010103,
      fio: 'Соколов Артём Дмитриевич',
      firstName: 'Артём',
      lastName: 'Соколов',
      middleName: 'Дмитриевич',
      birthDate: '14.05.2005',
      studentGroup: '310101',
      group: '310101',
      faculty: 'Факультет компьютерного проектирования',
      facultyAbbrev: 'ФКП',
      course: 3,
      photoUrl: null,
      photoLink: null,
      summary:
        'Студент 3 курса ФКП БГУИР. Интересуюсь мобильной и веб-разработкой (TypeScript, React, Kotlin).',
      published: true,
      showRating: true,
      searchJob: false,
      officeEmail: '31010103@study.bsuir.by',
      officePassword: 'BsuirStudy#2025',
      skills: [
        { id: 1, name: 'TypeScript' },
        { id: 2, name: 'React' },
        { id: 3, name: 'Kotlin' },
      ],
      references: [
        { id: 1, name: 'GitHub', reference: 'https://github.com/bsuir-student' },
      ],
      rating: 8.65,
      place: 3,
    },
    notifications: [
      {
        id: 101,
        message: 'Справка «По месту требования» №4421 готова к получению в деканате ФКП.',
        date: '18.10.2025 14:20',
        type: 'SUCCESS',
        isViewed: false,
      },
      {
        id: 102,
        message: 'Открыта аттестация за первый учебный месяц. Проверьте оценки по ЛР.',
        date: '12.10.2025 09:05',
        type: 'INFO',
        isViewed: false,
      },
      {
        id: 103,
        message: 'Напоминание: 2 часа неуважительных пропусков за сентябрь.',
        date: '02.10.2025 16:45',
        type: 'FAILURE',
        isViewed: true,
      },
    ],
    certificates: [
      {
        id: 201,
        number: 4421,
        certificateType: 'Обычная',
        provisionPlace: 'По месту требования',
        dateOrder: '16.10.2025',
        issueDate: '18.10.2025',
        status: 1,
        rejectionReason: null,
      },
      {
        id: 202,
        number: 4488,
        certificateType: 'Обычная',
        provisionPlace: 'В военкомат',
        dateOrder: '20.10.2025',
        issueDate: null,
        status: 2,
        rejectionReason: null,
      },
    ],
    markSheets: [
      {
        id: 301,
        number: 'В-2025-881',
        subjectName: 'РПМ',
        subjectType: 'ЛР',
        employeeFio: 'Иванова Е. С.',
        absentDate: '10.10.2025',
        createDate: '12.10.2025',
        expireDate: '26.10.2025',
        hours: 2,
        price: 11.5,
        isGoodReason: false,
        status: 'В обработке',
        rejectionReason: '',
        term: 5,
      },
    ],
    omissions: {
      totalHours: 10,
      unexcusedHours: 2,
      monthlyHours: {
        Сен: 4,
        Окт: 6,
      },
      monthlyUnexcusedHours: {
        Сен: 2,
        Окт: 0,
      },
      monthlyData: {
        Сен: 4,
        Окт: 6,
      },
      monthlyUnexcusedData: {
        Сен: 2,
        Окт: 0,
      },
      lessons: [
        {
          subject: 'РПМ',
          lessonType: 'ЛР',
          dateString: '12.09.2025',
          hours: 2,
          isRespectful: false,
          note: 'Пропуск без уважительной причины',
          teacher: 'Иванова Е. С.',
          monthName: 'Сен',
        },
        {
          subject: 'МатАн',
          lessonType: 'ПЗ',
          dateString: '19.09.2025',
          hours: 2,
          isRespectful: true,
          note: 'Справка №142',
          teacher: 'Петрова О. И.',
          monthName: 'Сен',
        },
        {
          subject: 'БД',
          lessonType: 'ЛК',
          dateString: '07.10.2025',
          hours: 2,
          isRespectful: true,
          note: 'Уважительная причина (ОРВИ)',
          teacher: 'Иванова Е. С.',
          monthName: 'Окт',
        },
        {
          subject: 'КС',
          lessonType: 'ЛР',
          dateString: '08.10.2025',
          hours: 4,
          isRespectful: true,
          note: 'Уважительная причина (ОРВИ)',
          teacher: 'Смирнов А. В.',
          monthName: 'Окт',
        },
      ],
      excuseDocuments: [
        {
          title: 'Заявление по самочувствию (ОРВИ)',
          note: 'г. Минск, ул. П. Бровки, д. 6',
          hoursClosed: 6,
          dates: ['07.10.2025', '08.10.2025'],
          subjects: ['БД', 'КС'],
        },
      ],
    },
    orviDaysByMonth: {
      '2025-10': 2,
    },
    headman: {
      hasAccess: true,
      subjects: [
        { subjectAbbrev: 'РПМ', termHoursId: 1001, lessonTypeAbbrev: 'ЛР' },
        { subjectAbbrev: 'БД', termHoursId: 1002, lessonTypeAbbrev: 'ЛК' },
      ],
      students: MOCK_GROUP_STUDENTS.slice(0, 6).map((s, idx) => ({
        studentId: 700 + idx,
        fio: s.fio,
        subgroup: idx < 3 ? 1 : 2,
      })),
      lessons: [
        { id: 9001, date: '13.10.2025', subgroup: 1, maxHours: 2 },
        { id: 9002, date: '20.10.2025', subgroup: 1, maxHours: 2 },
      ],
      attendance: {
        9001: { 700: 0, 701: 2, 702: 0, 703: 0, 704: 0, 705: 0 },
        9002: { 700: 0, 701: 0, 702: 0, 703: 2, 704: 0, 705: 0 },
      },
    },
  };
}

function readMockStore(): StatefulMockStore {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(MOCK_STATE_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as StatefulMockStore;
      }
    }
  } catch {
    // fallback to fresh state
  }
  const initial = createInitialMockState();
  writeMockStore(initial);
  return initial;
}

function writeMockStore(store: StatefulMockStore): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MOCK_STATE_STORAGE_KEY, JSON.stringify(store));
    }
  } catch {
    // ignore storage errors
  }
}

export function resetMockStore(): void {
  const initial = createInitialMockState();
  writeMockStore(initial);
}

// ==================== Stateful Mock Operations ====================

export function mockLogin(username: string): AuthSession {
  const store = readMockStore();
  const cleanUser = username.trim() || '31010103';
  store.authenticatedUsername = cleanUser;
  writeMockStore(store);

  const cv = store.personalCv;
  return {
    authenticated: true,
    isGuest: false,
    username: cleanUser,
    fio: cv.fio || 'Соколов Артём Дмитриевич',
    group: typeof cv.studentGroup === 'string' ? cv.studentGroup : cv.group || '310101',
    desc: `${cv.facultyAbbrev || 'ФКП'} · ${cv.course || 3} курс`,
    photoUrl: cv.photoUrl || cv.photoLink || '',
    isHeadman: true,
  };
}

export function mockLogout(): void {
  const store = readMockStore();
  store.authenticatedUsername = null;
  writeMockStore(store);
}

export function getMockPersonalCv(): PersonalCvDto {
  return readMockStore().personalCv;
}

export function mockUpdateCvSection(
  endpoint: ProfileCvSectionEndpoint,
  patch: Partial<PersonalCvDto>,
): PersonalCvDto {
  const store = readMockStore();
  const cv = { ...store.personalCv };
  if (endpoint === 'personal-cv-published' && typeof patch.published === 'boolean') {
    cv.published = patch.published;
  } else if (endpoint === 'personal-cv-rating' && typeof patch.showRating === 'boolean') {
    cv.showRating = patch.showRating;
  } else if (
    endpoint === 'personal-cv-searching-job' &&
    typeof patch.searchJob === 'boolean'
  ) {
    cv.searchJob = patch.searchJob;
  } else if (endpoint === 'summary' && typeof patch.summary === 'string') {
    cv.summary = patch.summary;
  } else {
    Object.assign(cv, patch);
  }
  store.personalCv = cv;
  writeMockStore(store);
  return cv;
}

export function mockUpdateCvSkills(
  skills: Array<{ id?: number; name: string }>,
): CvSkill[] {
  const store = readMockStore();
  const updated: CvSkill[] = skills.map((s) => {
    const id = typeof s.id === 'number' && s.id > 0 ? s.id : ++store.nextId;
    return { id, name: s.name.trim() };
  });
  store.personalCv = { ...store.personalCv, skills: updated };
  writeMockStore(store);
  return updated;
}

export function mockUpdateCvReferences(
  refs: Array<{ id?: number; name: string; reference: string }>,
): CvReference[] {
  const store = readMockStore();
  const updated: CvReference[] = refs.map((r) => {
    const id = typeof r.id === 'number' && r.id > 0 ? r.id : ++store.nextId;
    return { id, name: r.name.trim(), reference: r.reference.trim() };
  });
  store.personalCv = { ...store.personalCv, references: updated };
  writeMockStore(store);
  return updated;
}

export function getMockNotifications(): DeanNotification[] {
  return readMockStore().notifications;
}

export function mockMarkNotificationsRead(ids: number[]): DeanNotification[] {
  const store = readMockStore();
  const idSet = new Set(ids);
  store.notifications = store.notifications.map((n) =>
    idSet.has(n.id) ? { ...n, isViewed: true } : n,
  );
  writeMockStore(store);
  return store.notifications;
}

export function getMockCertificates(): CertificateDto[] {
  return readMockStore().certificates;
}

export function mockRegisterCertificate(
  payload: CertificateRegisterPayload,
): CertificateDto[] {
  const store = readMockStore();
  const count = Math.max(1, payload.certificateCount || 1);
  const todayStr = formatDateDdMmYyyy(new Date());
  for (let i = 0; i < count; i += 1) {
    const id = ++store.nextId;
    store.certificates = [
      {
        id,
        number: 4500 + (id % 1000),
        certificateType: payload.certificateRequestDto.certificateType || 'Обычная',
        provisionPlace: payload.certificateRequestDto.provisionPlace || 'По месту требования',
        dateOrder: todayStr,
        issueDate: null,
        status: 2, // В обработке
        rejectionReason: null,
      },
      ...store.certificates,
    ];
  }
  writeMockStore(store);
  return store.certificates;
}

export function mockCloseCertificate(id: number): CertificateDto[] {
  const store = readMockStore();
  store.certificates = store.certificates.filter(
    (c) => !(c.id === id && c.status === 2),
  );
  writeMockStore(store);
  return store.certificates;
}

export function getMockMarkSheets(): MarkSheetDto[] {
  return readMockStore().markSheets;
}

export function mockCreateMarkSheet(
  payload: MarkSheetCreatePayload,
): MarkSheetDto[] {
  const store = readMockStore();
  const id = ++store.nextId;
  const hours = Number.parseFloat(payload.hours) || 2;
  const price = calculateMarkSheetCost(hours, payload.reason);

  let subjectName = 'Дисциплина';
  let subjectType = 'ЛР';
  let term = 5;
  for (const subj of MOCK_MARK_SHEET_SUBJECTS) {
    const foundType = subj.lessonTypes.find(
      (lt) =>
        (payload.subject.thId != null && lt.thId === payload.subject.thId) ||
        (payload.subject.focsId != null && lt.focsId === payload.subject.focsId),
    );
    if (foundType) {
      subjectName = subj.abbrev;
      subjectType = foundType.abbrev;
      term = subj.term;
      break;
    }
  }

  const todayStr = formatDateDdMmYyyy(new Date());
  const expire = new Date();
  expire.setDate(expire.getDate() + 14);

  const created: MarkSheetDto = {
    id,
    number: `В-2025-${id}`,
    subjectName,
    subjectType,
    employeeFio: 'Смирнов А. В.',
    absentDate: payload.absentDate || todayStr,
    createDate: todayStr,
    expireDate: formatDateDdMmYyyy(expire),
    hours,
    price,
    isGoodReason: payload.reason,
    status: 'В обработке',
    rejectionReason: '',
    term,
  };

  store.markSheets = [created, ...store.markSheets];
  writeMockStore(store);
  return store.markSheets;
}

export function mockCloseMarkSheet(id: number): MarkSheetDto[] {
  const store = readMockStore();
  store.markSheets = store.markSheets.filter(
    (ms) => !(ms.id === id && ms.status.toLowerCase().includes('обработ')),
  );
  writeMockStore(store);
  return store.markSheets;
}

export function getMockOmissions(): OmissionsSummary {
  return readMockStore().omissions;
}

const RUSSIAN_MONTH_SHORT = [
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

export function mockCreateOrviOmission(
  payload: OrviOmissionPayload,
): OrviOmissionResult {
  const store = readMockStore();
  const startMatch = payload.startDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const endMatch = payload.endDate.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!startMatch || !endMatch) {
    return {
      ok: false,
      message: 'Некорректный формат дат заявления',
      source: 'mock',
    };
  }

  const startUtc = Date.UTC(
    Number.parseInt(startMatch[1], 10),
    Number.parseInt(startMatch[2], 10) - 1,
    Number.parseInt(startMatch[3], 10),
  );
  const endUtc = Date.UTC(
    Number.parseInt(endMatch[1], 10),
    Number.parseInt(endMatch[2], 10) - 1,
    Number.parseInt(endMatch[3], 10),
  );

  if (endUtc < startUtc) {
    return {
      ok: false,
      message: 'Дата окончания не может быть раньше даты начала',
      source: 'mock',
    };
  }

  const daysRequested = Math.floor((endUtc - startUtc) / 86_400_000) + 1;
  const monthKey = `${startMatch[1]}-${startMatch[2]}`;
  const usedDays = store.orviDaysByMonth[monthKey] ?? 0;

  if (usedDays + daysRequested > MOCK_ORVI_MONTHLY_DAY_LIMIT) {
    return {
      ok: false,
      conflictLimitExceeded: true,
      message: 'Вы превысили лимит дней на заявление студента в текущем месяце',
      source: 'mock',
    };
  }

  store.orviDaysByMonth[monthKey] = usedDays + daysRequested;
  const hoursAdded = daysRequested * 4;
  const monthIdx = Math.max(0, Math.min(11, Number.parseInt(startMatch[2], 10) - 1));
  const monthShort = RUSSIAN_MONTH_SHORT[monthIdx];
  const dateDmy = formatIsoToDDMMYYYY(payload.startDate);
  const endDmy = formatIsoToDDMMYYYY(payload.endDate);

  const nextMonthly = {
    ...store.omissions.monthlyHours,
    [monthShort]: (store.omissions.monthlyHours[monthShort] ?? 0) + hoursAdded,
  };

  store.omissions = {
    ...store.omissions,
    totalHours: store.omissions.totalHours + hoursAdded,
    monthlyHours: nextMonthly,
    monthlyData: { ...nextMonthly },
    lessons: [
      {
        subject: 'Занятия по расписанию',
        lessonType: 'ПЗ',
        dateString: dateDmy,
        hours: hoursAdded,
        isRespectful: true,
        note: `Заявление студента (${payload.placeOfStay.trim() || 'г. Минск'})`,
        teacher: 'Деканат',
        monthName: monthShort,
      },
      ...store.omissions.lessons,
    ],
    excuseDocuments: [
      {
        title: 'Заявление по самочувствию (ОРВИ)',
        note: payload.placeOfStay.trim() || MOCK_PERMANENT_ADDRESS,
        hoursClosed: hoursAdded,
        dates: dateDmy === endDmy ? [dateDmy] : [dateDmy, endDmy],
        subjects: ['Все занятия'],
      },
      ...store.omissions.excuseDocuments,
    ],
  };

  writeMockStore(store);
  return {
    ok: true,
    message: 'Заявление успешно отправлено',
    source: 'mock',
  };
}

export function getMockHeadmanJournal(): HeadmanJournalData {
  return readMockStore().headman;
}

export function mockSaveHeadmanAttendance(
  payload: HeadmanCreatePayload,
): HeadmanJournalData {
  const store = readMockStore();
  const lessonAtt = { ...(store.headman.attendance[payload.idLesson] ?? {}) };
  for (const entry of payload.studentOmissionsHoursDtoList) {
    lessonAtt[entry.student] = entry.hours;
  }
  store.headman = {
    ...store.headman,
    attendance: {
      ...store.headman.attendance,
      [payload.idLesson]: lessonAtt,
    },
  };
  writeMockStore(store);
  return store.headman;
}

export function getMockGroupInfo(group: string): GroupInfoNormalized {
  const isDefaultUserGroup = !group || group === '310101';
  const students = isDefaultUserGroup
    ? MOCK_GROUP_STUDENTS
    : MOCK_GROUP_STUDENTS.map((s) => ({ ...s, isCurrentUser: false }));
  return {
    curator: MOCK_GROUP_CURATOR,
    students,
    isHeadman: isDefaultUserGroup,
  };
}

function formatDateDdMmYyyy(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}
