import type {
  ActiveLessonStatus,
  BsuirLesson,
  BsuirScheduleResponse,
  Lesson,
  NextLessonTarget,
  Note,
  ReminderTiming,
} from '../types';
import { formatDateDDMMYYYY, formatDateShortDDMM } from './formatters';

export interface CalendarDayItem {
  index: number; // 0..90
  date: Date; // local 12:00:00
  dayOfMonth: number; // 1..31
  weekDayShort: string; // 'Пн'..'Вс'
  dateFormatted: string; // 'DD.MM.YYYY'
  dayOfWeek: number; // 1 (Mon)..7 (Sun)
  weekNumber: 1 | 2 | 3 | 4;
  isToday: boolean; // index === 7
}

export interface BsuirWeekInfo {
  dayOfWeek: number; // 1..7
  weekNumber: 1 | 2 | 3 | 4;
}

const WEEKDAY_NAMES_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] as const;
const RUSSIAN_DAY_NAMES_BY_DOW: Record<number, string> = {
  1: 'Понедельник',
  2: 'Вторник',
  3: 'Среда',
  4: 'Четверг',
  5: 'Пятница',
  6: 'Суббота',
  7: 'Воскресенье',
};

const STANDARD_PAIR_MIN_SECONDS = 70 * 60; // 4200s
const FIRST_HALF_SECONDS = 40 * 60; // 2400s
const BREAK_SECONDS = 5 * 60; // 300s
const BREAK_PROGRESS_NOTCH = 40 / 85;

export function getCalendarDayDate(today: Date, dayIndex: number): Date {
  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + (dayIndex - 7),
    12,
    0,
    0,
    0,
  );
}

export function getBsuirWeekInfo(date: Date): BsuirWeekInfo {
  const jsDay = date.getDay();
  const dayOfWeek = jsDay === 0 ? 7 : jsDay;

  const targetMon = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - (dayOfWeek - 1),
    12,
    0,
    0,
    0,
  );

  // Java Calendar.AUGUST is 7 (0-based): months Jan..Jul (< 7) anchor to prev year's Sept 1
  const sep1Year = date.getMonth() < 7 ? date.getFullYear() - 1 : date.getFullYear();
  const sep1 = new Date(sep1Year, 8, 1, 12, 0, 0, 0);
  const sep1JsDay = sep1.getDay();
  const sep1Dow = sep1JsDay === 0 ? 7 : sep1JsDay;
  const sep1Mon = new Date(
    sep1.getFullYear(),
    sep1.getMonth(),
    sep1.getDate() - (sep1Dow - 1),
    12,
    0,
    0,
    0,
  );

  // Compute Monday-to-Monday delta in UTC to avoid DST 1h shift off-by-one errors
  const utcTarget = Date.UTC(
    targetMon.getFullYear(),
    targetMon.getMonth(),
    targetMon.getDate(),
  );
  const utcSep1 = Date.UTC(
    sep1Mon.getFullYear(),
    sep1Mon.getMonth(),
    sep1Mon.getDate(),
  );
  const diffWeeks = Math.round((utcTarget - utcSep1) / (7 * 86_400_000));
  const weekNumber = ((((diffWeeks % 4) + 4) % 4) + 1) as 1 | 2 | 3 | 4;

  return { dayOfWeek, weekNumber };
}

export function getBsuirWeekForCalendarDay(today: Date, dayIndex: number): 1 | 2 | 3 | 4 {
  return getBsuirWeekInfo(getCalendarDayDate(today, dayIndex)).weekNumber;
}

export function buildCalendarCarousel(
  today: Date = new Date(),
  totalDays = 91,
  todayIndex = 7,
): CalendarDayItem[] {
  const items: CalendarDayItem[] = [];
  for (let i = 0; i < totalDays; i += 1) {
    const date = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + (i - todayIndex),
      12,
      0,
      0,
      0,
    );
    const { dayOfWeek, weekNumber } = getBsuirWeekInfo(date);
    items.push({
      index: i,
      date,
      dayOfMonth: date.getDate(),
      weekDayShort: WEEKDAY_NAMES_SHORT[date.getDay()],
      dateFormatted: formatDateDDMMYYYY(date),
      dayOfWeek,
      weekNumber,
      isToday: i === todayIndex,
    });
  }
  return items;
}

function mapScheduleDayNameToInt(dayName: string): number {
  const lower = dayName.trim().toLowerCase();
  if (lower.includes('пон') || lower.includes('mon')) return 1;
  if (lower.includes('вто') || lower.includes('tue')) return 2;
  if (lower.includes('сре') || lower.includes('wed')) return 3;
  if (lower.includes('чет') || lower.includes('thu')) return 4;
  if (lower.includes('пят') || lower.includes('fri')) return 5;
  if (lower.includes('суб') || lower.includes('sat')) return 6;
  if (lower.includes('вос') || lower.includes('sun')) return 7;
  return 0;
}

function mapBsuirLesson(bl: BsuirLesson, dayOfWeek: number, isExam: boolean): Lesson {
  const teacher = bl.employees?.[0];
  const ln = (teacher?.lastName ?? '').trim();
  const fnInitial = teacher?.firstName?.trim() ? `${teacher.firstName.trim()[0]}.` : '';
  const mnInitial = teacher?.middleName?.trim() ? `${teacher.middleName.trim()[0]}.` : '';
  const initials = `${fnInitial}${mnInitial}`;
  const teacherShort =
    [ln, initials].filter(Boolean).join(' ').trim() || (teacher?.fio ?? '').trim();

  const teacherFull =
    [teacher?.lastName, teacher?.firstName, teacher?.middleName]
      .map((p) => (p ?? '').trim())
      .filter(Boolean)
      .join(' ') ||
    (teacher?.fullName ?? '').trim() ||
    (teacher?.fio ?? '').trim();

  const photoLink = (teacher?.photoLink ?? '').trim();
  const teacherPhoto =
    photoLink ||
    (teacher?.id ? `https://iis.bsuir.by/api/v1/employees/photo/${teacher.id}` : '');

  const teacherUrlId = (teacher?.urlId ?? '').trim();
  const auditory = (bl.auditories ?? [])
    .map((a) => a.trim())
    .filter(Boolean)
    .join(', ');

  const subjShort = (bl.subject ?? '').trim();
  const subjFull = (bl.subjectFullName ?? '').trim();
  const note = (bl.note ?? '').trim();
  const title =
    subjShort || note || subjFull || (bl.announcement ? 'Объявление' : 'Занятие');

  const lessonType = isExam
    ? (bl.lessonTypeAbbrev ?? '').trim() || 'Экзамен'
    : (bl.lessonTypeAbbrev ?? '').trim() || (bl.announcement ? 'Инфо' : '');

  const noteIfDistinct = note && note !== title ? note : '';
  const details = [lessonType, teacherShort, auditory, noteIfDistinct]
    .filter(Boolean)
    .join(' • ');

  const weeks = isExam
    ? bl.weekNumber && bl.weekNumber.length > 0
      ? [...bl.weekNumber]
      : [1, 2, 3, 4]
    : bl.weekNumber
      ? [...bl.weekNumber]
      : [];

  const studentGroups = (bl.studentGroups ?? [])
    .map((g) => (g.name ?? '').trim())
    .filter(Boolean);

  return {
    startTime: (bl.startLessonTime ?? '').trim(),
    endTime: (bl.endLessonTime ?? '').trim(),
    title,
    details,
    subjectFullName: subjFull || title,
    lessonType,
    teacherName: teacherShort,
    teacherFullName: teacherFull,
    teacherPhoto,
    teacherUrlId,
    auditory,
    subgroup: bl.numSubgroup ?? 0,
    weeks,
    dayOfWeek,
    dateLesson: bl.dateLesson?.trim() || null,
    note: note || null,
    studentGroups,
  };
}

export function parseScheduleResponse(
  resp: BsuirScheduleResponse | null | undefined,
): { lessons: Lesson[]; exams: Lesson[] } {
  if (!resp) {
    return { lessons: [], exams: [] };
  }

  const schedMap =
    resp.schedules && Object.keys(resp.schedules).length > 0
      ? resp.schedules
      : resp.nextSchedules ?? {};

  const lessons: Lesson[] = [];
  for (const [dayName, dayLessons] of Object.entries(schedMap)) {
    const dow = mapScheduleDayNameToInt(dayName);
    if (dow === 0 || !Array.isArray(dayLessons)) continue;
    for (const bl of dayLessons) {
      lessons.push(mapBsuirLesson(bl, dow, false));
    }
  }

  const exams: Lesson[] = Array.isArray(resp.exams)
    ? resp.exams.map((ex) => mapBsuirLesson(ex, 0, true))
    : [];

  return { lessons, exams };
}

export function parseTimeToSeconds(timeStr: string): number | null {
  const trimmed = timeStr.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const seconds = match[3] ? Number.parseInt(match[3], 10) : 0;
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }
  return hours * 3600 + minutes * 60 + seconds;
}

export function filterLessons(
  lessons: Lesson[],
  dayOfWeek: number,
  week: number,
  subgroup: 0 | 1 | 2,
): Lesson[] {
  return lessons
    .filter(
      (l) =>
        (subgroup === 0 || l.subgroup === 0 || l.subgroup === subgroup) &&
        l.dayOfWeek === dayOfWeek &&
        (l.weeks.length === 0 || l.weeks.includes(week)),
    )
    .sort((a, b) => {
      const aSec = parseTimeToSeconds(a.startTime) ?? 0;
      const bSec = parseTimeToSeconds(b.startTime) ?? 0;
      return aSec - bSec;
    });
}

function dateToSortableYyyymmdd(dateStr?: string | null): string {
  const raw = (dateStr ?? '').trim();
  const dmy = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmy) {
    return `${dmy[3]}${dmy[2].padStart(2, '0')}${dmy[1].padStart(2, '0')}`;
  }
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    return `${ymd[1]}${ymd[2]}${ymd[3]}`;
  }
  return '99999999';
}

export function filterAndSortExams(exams: Lesson[], subgroup: 0 | 1 | 2): Lesson[] {
  return exams
    .filter((ex) => subgroup === 0 || ex.subgroup === 0 || ex.subgroup === subgroup)
    .sort((a, b) => {
      const dA = dateToSortableYyyymmdd(a.dateLesson);
      const dB = dateToSortableYyyymmdd(b.dateLesson);
      if (dA !== dB) return dA.localeCompare(dB);
      return (parseTimeToSeconds(a.startTime) ?? 0) - (parseTimeToSeconds(b.startTime) ?? 0);
    });
}

export function computeActiveLessonStatus(
  lesson: Pick<Lesson, 'startTime' | 'endTime'>,
  now: Date,
  isToday: boolean,
): ActiveLessonStatus {
  const inactive: ActiveLessonStatus = {
    isActive: false,
    progress: 0,
    phase: 1,
    isBreak: false,
    remainingMinutes: 0,
    remainingSeconds: 0,
    secondsToBreak: 0,
    breakProgressNotch: BREAK_PROGRESS_NOTCH,
    statusText: '',
  };

  if (!isToday) return inactive;

  const startSec = parseTimeToSeconds(lesson.startTime);
  const endSec = parseTimeToSeconds(lesson.endTime);
  if (startSec === null || endSec === null || endSec <= startSec) {
    return inactive;
  }

  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  if (nowSec < startSec || nowSec >= endSec) {
    return inactive;
  }

  const totalSec = Math.max(60, endSec - startSec);
  const elapsedSec = nowSec - startSec;
  const remainingSeconds = Math.max(0, endSec - nowSec);
  const remainingMinutes = Math.floor((remainingSeconds + 59) / 60);
  const progress = Math.min(1, Math.max(0, elapsedSec / totalSec));
  const isStandardPair = totalSec >= STANDARD_PAIR_MIN_SECONDS;

  if (!isStandardPair) {
    return {
      isActive: true,
      progress,
      phase: 1,
      isBreak: false,
      remainingMinutes,
      remainingSeconds,
      secondsToBreak: 0,
      breakProgressNotch: BREAK_PROGRESS_NOTCH,
      statusText: `До конца пары: ${remainingMinutes} мин`,
    };
  }

  const breakStartSec = FIRST_HALF_SECONDS;
  const breakEndSec = breakStartSec + BREAK_SECONDS;

  if (elapsedSec < breakStartSec) {
    const toBreakSec = breakStartSec - elapsedSec;
    const toBreakMin = Math.floor((toBreakSec + 59) / 60);
    const statusText =
      toBreakSec < 60
        ? `До конца пары: ${remainingMinutes} мин (перерыв через ${toBreakSec} сек)`
        : `До конца пары: ${remainingMinutes} мин (перерыв через ${toBreakMin} мин)`;
    return {
      isActive: true,
      progress,
      phase: 1,
      isBreak: false,
      remainingMinutes,
      remainingSeconds,
      secondsToBreak: toBreakSec,
      breakProgressNotch: BREAK_PROGRESS_NOTCH,
      statusText,
    };
  }

  if (elapsedSec < breakEndSec) {
    const breakRemSec = breakEndSec - elapsedSec;
    const bMin = Math.floor(breakRemSec / 60);
    const bSec = breakRemSec % 60;
    const statusText =
      bMin === 0
        ? `Перерыв ${bSec} сек · До конца пары: ${remainingMinutes} мин`
        : `Перерыв ${bMin} мин ${bSec} сек · До конца пары: ${remainingMinutes} мин`;
    return {
      isActive: true,
      progress,
      phase: 2,
      isBreak: true,
      remainingMinutes,
      remainingSeconds,
      secondsToBreak: 0,
      breakProgressNotch: BREAK_PROGRESS_NOTCH,
      statusText,
    };
  }

  const statusText =
    remainingMinutes <= 3
      ? `2-я часть • До конца пары: ${remainingMinutes} мин (${remainingSeconds % 60} сек)`
      : `2-я часть • До конца пары: ${remainingMinutes} мин`;

  return {
    isActive: true,
    progress,
    phase: 3,
    isBreak: false,
    remainingMinutes,
    remainingSeconds,
    secondsToBreak: 0,
    breakProgressNotch: BREAK_PROGRESS_NOTCH,
    statusText,
  };
}

export function getUpcomingLessonDates(
  lesson: Pick<Lesson, 'dayOfWeek' | 'weeks'>,
  today: Date,
  limit = 3,
): Array<{ dayIndex: number; dateFormatted: string }> {
  if (limit <= 0) return [];
  const results: Array<{ dayIndex: number; dateFormatted: string }> = [];
  for (let offset = 1; offset <= 75; offset += 1) {
    const dayIndex = 7 + offset;
    const date = getCalendarDayDate(today, dayIndex);
    const info = getBsuirWeekInfo(date);
    if (
      info.dayOfWeek === lesson.dayOfWeek &&
      (lesson.weeks.length === 0 || lesson.weeks.includes(info.weekNumber))
    ) {
      results.push({
        dayIndex,
        dateFormatted: formatDateShortDDMM(date),
      });
      if (results.length >= limit) break;
    }
  }
  return results;
}

function getLessonTypePriority(lessonType: string): number {
  const upper = lessonType.trim().toUpperCase();
  if (upper.includes('ЛР') || upper.includes('ПЗ')) return 0;
  return 1;
}

function sortCandidateLessons(candidates: Lesson[]): Lesson[] {
  return [...candidates].sort((a, b) => {
    const pDiff = getLessonTypePriority(a.lessonType) - getLessonTypePriority(b.lessonType);
    if (pDiff !== 0) return pDiff;
    const tA = parseTimeToSeconds(a.startTime) ?? 0;
    const tB = parseTimeToSeconds(b.startTime) ?? 0;
    return tA - tB;
  });
}

function buildNextLessonTarget(lesson: Lesson, date: Date): NextLessonTarget {
  const parts = lesson.startTime.trim().split(':');
  const parsedHour = Number.parseInt(parts[0] ?? '9', 10);
  const parsedMinute = Number.parseInt(parts[1] ?? '0', 10);
  const hour = Number.isFinite(parsedHour) ? parsedHour : 9;
  const minute = Number.isFinite(parsedMinute) ? parsedMinute : 0;

  return {
    day: date.getDate(),
    month0Based: date.getMonth(),
    year: date.getFullYear(),
    hour,
    minute,
    dateFormatted: formatDateDDMMYYYY(date),
    timeFormatted: lesson.startTime.trim() || '09:00',
    lessonType: lesson.lessonType,
  };
}

export function findNextLessonForSubject(
  lessons: Lesson[],
  subject: string,
  fromDate: Date,
  options?: { subgroup?: 0 | 1 | 2; afterTime?: string | null },
): NextLessonTarget | null {
  const cleanSubj = subject.trim();
  if (!cleanSubj || cleanSubj === 'Общее' || cleanSubj === 'Все') {
    return null;
  }

  const subgroup = options?.subgroup ?? 0;
  const targetLower = cleanSubj.toLowerCase();
  const matching = lessons.filter(
    (l) =>
      l.title.trim().toLowerCase() === targetLower &&
      (subgroup === 0 || l.subgroup === 0 || l.subgroup === subgroup),
  );
  if (matching.length === 0) return null;

  const afterTime = options?.afterTime?.trim() ?? '';
  if (afterTime) {
    const afterSec = parseTimeToSeconds(afterTime);
    const todayInfo = getBsuirWeekInfo(fromDate);
    const sameDayCandidates = matching.filter((l) => {
      if (l.dayOfWeek !== todayInfo.dayOfWeek) return false;
      if (l.weeks.length > 0 && !l.weeks.includes(todayInfo.weekNumber)) return false;
      const startSec = parseTimeToSeconds(l.startTime);
      if (afterSec !== null && startSec !== null) {
        return startSec > afterSec;
      }
      return l.startTime.trim() > afterTime;
    });
    if (sameDayCandidates.length > 0) {
      const sorted = sortCandidateLessons(sameDayCandidates);
      return buildNextLessonTarget(sorted[0], fromDate);
    }
  }

  for (let offset = 1; offset <= 60; offset += 1) {
    const d = new Date(
      fromDate.getFullYear(),
      fromDate.getMonth(),
      fromDate.getDate() + offset,
      12,
      0,
      0,
      0,
    );
    const info = getBsuirWeekInfo(d);
    const dayCandidates = matching.filter(
      (l) =>
        l.dayOfWeek === info.dayOfWeek &&
        (l.weeks.length === 0 || l.weeks.includes(info.weekNumber)),
    );
    if (dayCandidates.length > 0) {
      const sorted = sortCandidateLessons(dayCandidates);
      return buildNextLessonTarget(sorted[0], d);
    }
  }

  return null;
}

export function resolveAllGroupsForLesson(
  lesson: Pick<
    Lesson,
    'teacherUrlId' | 'dayOfWeek' | 'startTime' | 'title' | 'lessonType' | 'studentGroups' | 'dateLesson'
  >,
  employeeSchedules: Record<string, BsuirScheduleResponse>,
  currentGroup?: string,
): string[] {
  const fallback = lesson.studentGroups;
  const urlId = lesson.teacherUrlId.trim();
  if (!urlId) return fallback;

  const teacherSched = employeeSchedules[urlId];
  if (!teacherSched) return fallback;

  const extractGroups = (bl: BsuirLesson): string[] =>
    (bl.studentGroups ?? [])
      .map((g) => (g.name ?? '').trim())
      .filter(Boolean);

  if (lesson.dateLesson) {
    const exams = teacherSched.exams ?? [];
    const cleanCurrent = currentGroup?.trim();
    let bestExamGroups: string[] = [];
    for (const ex of exams) {
      if (
        (ex.dateLesson ?? '').trim() === lesson.dateLesson &&
        (!ex.startLessonTime || ex.startLessonTime.trim() === lesson.startTime)
      ) {
        const grps = extractGroups(ex);
        if (cleanCurrent && grps.includes(cleanCurrent)) {
          return grps;
        }
        if (grps.length > bestExamGroups.length) {
          bestExamGroups = grps;
        }
      }
    }
    if (bestExamGroups.length > 0) return bestExamGroups;
  }

  const dayName = RUSSIAN_DAY_NAMES_BY_DOW[lesson.dayOfWeek] ?? '';
  const schedMap =
    teacherSched.schedules && Object.keys(teacherSched.schedules).length > 0
      ? teacherSched.schedules
      : teacherSched.nextSchedules ?? {};

  let dayLessons: BsuirLesson[] | undefined = dayName ? schedMap[dayName] : undefined;
  if (!dayLessons && dayName) {
    const dayLower = dayName.toLowerCase();
    for (const [key, list] of Object.entries(schedMap)) {
      if (key.trim().toLowerCase() === dayLower) {
        dayLessons = list;
        break;
      }
    }
  }

  const searchList = dayLessons ?? Object.values(schedMap).flat();
  const lTitleLower = lesson.title.trim().toLowerCase();
  const lTypeLower = lesson.lessonType.trim().toLowerCase();

  let bestGroups: string[] = [];
  for (const tl of searchList) {
    if ((tl.startLessonTime ?? '').trim() !== lesson.startTime) continue;

    const tlSubjLower = (tl.subject ?? '').trim().toLowerCase();
    const subjMatches = Boolean(
      tlSubjLower &&
        lTitleLower &&
        (tlSubjLower.includes(lTitleLower) || lTitleLower.includes(tlSubjLower)),
    );
    const typeMatches =
      (tl.lessonTypeAbbrev ?? '').trim().toLowerCase() === lTypeLower;

    if (subjMatches || typeMatches) {
      const grps = extractGroups(tl);
      if (grps.length > 0) {
        if (currentGroup && grps.includes(currentGroup)) {
          return grps;
        }
        if (grps.length > bestGroups.length) {
          bestGroups = grps;
        }
      }
    }
  }

  return bestGroups.length > 0 ? bestGroups : fallback;
}

function parseDdMmYyyyStartOfDay(dateStr?: string | null): number | null {
  const raw = (dateStr ?? '').trim();
  if (!raw) return null;
  const dmy = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!dmy) return null;
  const day = Number.parseInt(dmy[1], 10);
  const month = Number.parseInt(dmy[2], 10);
  const year = Number.parseInt(dmy[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return null;
  }
  return dt.getTime();
}

export function isSessionPeriodActive(
  startExamsDate?: string | null,
  endExamsDate?: string | null,
  exams?: Lesson[],
  today: Date = new Date(),
): boolean {
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    0,
    0,
    0,
    0,
  ).getTime();

  let startMillis = parseDdMmYyyyStartOfDay(startExamsDate);
  let endMillis = parseDdMmYyyyStartOfDay(endExamsDate);

  if (startMillis === null && exams && exams.length > 0) {
    const validTimes = exams
      .map((ex) => parseDdMmYyyyStartOfDay(ex.dateLesson))
      .filter((t): t is number => t !== null);
    if (validTimes.length > 0) {
      startMillis = Math.min(...validTimes);
      if (endMillis === null) {
        endMillis = Math.max(...validTimes);
      }
    }
  }

  if (startMillis === null) return false;
  if (endMillis !== null) {
    return todayStart >= startMillis && todayStart <= endMillis;
  }
  return todayStart >= startMillis;
}

export function inferNoteLessonType(
  note: Pick<Note, 'lessonType' | 'text'>,
): 'ЛР' | 'ЛК' | 'ПЗ' | '' {
  const explicit = (note.lessonType ?? '').trim().toUpperCase();
  if (explicit) {
    if (explicit.includes('ЛР') || explicit.includes('ЛАБ')) return 'ЛР';
    if (explicit.includes('ЛК') || explicit.includes('ЛЕК')) return 'ЛК';
    if (explicit.includes('ПЗ') || explicit.includes('ПРАК')) return 'ПЗ';
  }

  const upper = (note.text ?? '').toUpperCase();
  if (upper.includes('ЛР') || upper.includes('ЛАБ') || upper.includes('ЛАБОРАТОР')) {
    return 'ЛР';
  }
  if (upper.includes('ПЗ') || upper.includes('ПРАКТ') || upper.includes('СЕМИНАР')) {
    return 'ПЗ';
  }
  if (upper.includes('ЛК') || upper.includes('ЛЕКЦ')) {
    return 'ЛК';
  }
  return '';
}

export function parseNoteDateMillis(dateStr: string): number {
  const match = dateStr.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return 0;
  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return 0;
  const dt = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return 0;
  }
  return dt.getTime();
}

export function calculateReminderTime(
  timing: ReminderTiming | string,
  day: number,
  month0Based: number,
  year: number,
  hour = 9,
  minute = 0,
  customHours = 3,
): number {
  if (timing === 'custom_hours') {
    const base = new Date(year, month0Based, day, hour, minute, 0, 0);
    return base.getTime() - customHours * 3_600_000;
  }
  if (timing.startsWith('custom_hours_')) {
    const parsed = Number.parseInt(timing.slice('custom_hours_'.length), 10);
    const hrs = Number.isFinite(parsed) && parsed > 0 ? parsed : customHours;
    const base = new Date(year, month0Based, day, hour, minute, 0, 0);
    return base.getTime() - hrs * 3_600_000;
  }

  switch (timing) {
    case '1_day_before_18':
      return new Date(year, month0Based, day - 1, 18, 0, 0, 0).getTime();
    case '1_day_before_21':
      return new Date(year, month0Based, day - 1, 21, 0, 0, 0).getTime();
    case 'same_day_08':
      return new Date(year, month0Based, day, 8, 0, 0, 0).getTime();
    case 'same_day_09':
      return new Date(year, month0Based, day, 9, 0, 0, 0).getTime();
    case '2_hours_before':
      return new Date(year, month0Based, day, hour, minute, 0, 0).getTime() - 2 * 3_600_000;
    case '1_hour_before':
      return new Date(year, month0Based, day, hour, minute, 0, 0).getTime() - 3_600_000;
    case '15_min_before':
      return new Date(year, month0Based, day, hour, minute, 0, 0).getTime() - 15 * 60_000;
    default:
      return new Date(year, month0Based, day - 1, 18, 0, 0, 0).getTime();
  }
}
