import { describe, expect, it } from 'vitest';
import type { BsuirScheduleResponse, Lesson } from '../../src/types';
import {
  buildCalendarCarousel,
  calculateReminderTime,
  computeActiveLessonStatus,
  filterAndSortExams,
  filterLessons,
  findNextLessonForSubject,
  getBsuirWeekForCalendarDay,
  getBsuirWeekInfo,
  getCalendarDayDate,
  getUpcomingLessonDates,
  inferNoteLessonType,
  isSessionPeriodActive,
  parseNoteDateMillis,
  parseScheduleResponse,
  parseTimeToSeconds,
  resolveAllGroupsForLesson,
} from '../../src/utils/scheduleMath';

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    startTime: '09:00',
    endTime: '10:25',
    title: 'РПМ',
    details: 'ЛК • Смирнов А.В. • 312-4',
    subjectFullName: 'Разработка программных модулей',
    lessonType: 'ЛК',
    teacherName: 'Смирнов А.В.',
    teacherFullName: 'Смирнов Алексей Владимирович',
    teacherPhoto: '',
    teacherUrlId: 'a-smirnov',
    auditory: '312-4',
    subgroup: 0,
    weeks: [1, 2, 3, 4],
    dayOfWeek: 1,
    dateLesson: null,
    note: null,
    studentGroups: ['310101'],
    ...overrides,
  };
}

describe('scheduleMath', () => {
  it('computes Sept-1 Monday-aligned BSUIR week numbers across Jan-Jul, Aug, and 4-week wraps', () => {
    // Mon 01.09.2025 -> Week 1, dow 1
    const sep1 = new Date(2025, 8, 1, 12, 0, 0);
    expect(getBsuirWeekInfo(sep1)).toEqual({ dayOfWeek: 1, weekNumber: 1 });
    expect(getBsuirWeekForCalendarDay(sep1, 7)).toBe(1);

    // Mon 08.09.2025 -> Week 2
    expect(getBsuirWeekForCalendarDay(new Date(2025, 8, 8, 12, 0, 0), 7)).toBe(2);

    // Mon 29.09.2025 (4 weeks later) -> Week 1
    expect(getBsuirWeekForCalendarDay(new Date(2025, 8, 29, 12, 0, 0), 7)).toBe(1);

    // Jan-Jul (month < 7): Mon 05.01.2026 anchors to 01.09.2025 (18 weeks -> (18%4)+1 = 3)
    expect(getBsuirWeekInfo(new Date(2026, 0, 5, 12, 0, 0))).toEqual({
      dayOfWeek: 1,
      weekNumber: 3,
    });

    // August (month === 7, Calendar.AUGUST): 31.08.2026 -> sep1Year=2026 (01.09.2026 is Tue, its Mon is 31.08.2026) -> Week 1
    expect(getBsuirWeekInfo(new Date(2026, 7, 31, 12, 0, 0))).toEqual({
      dayOfWeek: 1,
      weekNumber: 1,
    });
    // One week prior in August: 24.08.2026 -> diffWeeks = -1 -> Week 4
    expect(getBsuirWeekInfo(new Date(2026, 7, 24, 12, 0, 0))).toEqual({
      dayOfWeek: 1,
      weekNumber: 4,
    });
  });

  it('keeps week calculation consistent across DST-transition months (March / October)', () => {
    const preOctDst = new Date(2025, 9, 20, 12, 0, 0); // Mon 20.10.2025 (week 4)
    const postOctDst = new Date(2025, 9, 27, 12, 0, 0); // Mon 27.10.2025 (week 1)
    const preMarDst = new Date(2026, 2, 23, 12, 0, 0);
    const postMarDst = new Date(2026, 2, 30, 12, 0, 0);

    expect(getBsuirWeekInfo(preOctDst).weekNumber).toBe(4);
    expect(getBsuirWeekInfo(postOctDst).weekNumber).toBe(1);
    const w1 = getBsuirWeekInfo(preMarDst).weekNumber;
    const w2 = getBsuirWeekInfo(postMarDst).weekNumber;
    expect(w2).toBe(((w1 % 4) + 1) as 1 | 2 | 3 | 4);
  });

  it('builds 91-day calendar carousel (-7..+83) with todayIndex = 7', () => {
    const today = new Date(2025, 8, 15, 9, 30, 0);
    const carousel = buildCalendarCarousel(today);
    expect(carousel).toHaveLength(91);
    expect(carousel[7].isToday).toBe(true);
    expect(carousel[7].dateFormatted).toBe('15.09.2025');
    expect(carousel[0].dateFormatted).toBe('08.09.2025');
    expect(carousel[90].dateFormatted).toBe('07.12.2025');
    expect(getCalendarDayDate(today, 0).getDate()).toBe(8);
  });

  it('parses schedule responses with nextSchedules fallback, Ru/En weekdays, and exams', () => {
    const resp: BsuirScheduleResponse = {
      schedules: null,
      nextSchedules: {
        Monday: [
          {
            subject: 'ОАиП',
            subjectFullName: 'Основы алгоритмизации',
            lessonTypeAbbrev: 'ЛК',
            startLessonTime: '09:00',
            endLessonTime: '10:25',
            numSubgroup: 0,
            weekNumber: [1, 3],
            auditories: ['ауд. 101-4'],
            employees: [
              {
                id: 42,
                firstName: 'Иван',
                lastName: 'Петров',
                middleName: 'Олегович',
                urlId: 'i-petrov',
              },
            ],
            studentGroups: [{ name: '310101' }],
          },
        ],
      },
      exams: [
        {
          subject: 'ОАиП',
          lessonTypeAbbrev: 'Экзамен',
          startLessonTime: '09:00',
          endLessonTime: '12:00',
          dateLesson: '18.01.2026',
          studentGroups: [{ name: '310101' }],
        },
      ],
    };

    const parsed = parseScheduleResponse(resp);
    expect(parsed.lessons).toHaveLength(1);
    expect(parsed.lessons[0].dayOfWeek).toBe(1);
    expect(parsed.lessons[0].teacherName).toBe('Петров И.О.');
    expect(parsed.lessons[0].teacherPhoto).toBe(
      'https://iis.bsuir.by/api/v1/employees/photo/42',
    );
    expect(parsed.exams).toHaveLength(1);
    expect(parsed.exams[0].weeks).toEqual([1, 2, 3, 4]);
  });

  it('filters lessons by subgroup (0 keeps all; 1 keeps 0 and 1, drops 2) and sorts exams', () => {
    const lessons = [
      makeLesson({ startTime: '10:35', subgroup: 2, dayOfWeek: 1, weeks: [1] }),
      makeLesson({ startTime: '09:00', subgroup: 0, dayOfWeek: 1, weeks: [1, 2] }),
      makeLesson({ startTime: '12:25', subgroup: 1, dayOfWeek: 1, weeks: [1] }),
      makeLesson({ startTime: '14:00', subgroup: 1, dayOfWeek: 2, weeks: [1] }),
    ];

    const sg1 = filterLessons(lessons, 1, 1, 1);
    expect(sg1.map((l) => l.subgroup)).toEqual([0, 1]);
    expect(filterLessons(lessons, 1, 1, 0)).toHaveLength(3);

    const exams = [
      makeLesson({ dateLesson: '20.01.2026', startTime: '09:00', subgroup: 0 }),
      makeLesson({ dateLesson: '12.01.2026', startTime: '11:00', subgroup: 2 }),
      makeLesson({ dateLesson: '12.01.2026', startTime: '09:00', subgroup: 1 }),
    ];
    const sortedSub1 = filterAndSortExams(exams, 1);
    expect(sortedSub1).toHaveLength(2);
    expect(sortedSub1[0].dateLesson).toBe('12.01.2026');
    expect(sortedSub1[1].dateLesson).toBe('20.01.2026');
  });

  it('computes 40m/5m/40m phases, <70m short pairs, and half-open window accurately', () => {
    const pair = makeLesson({ startTime: '09:00', endTime: '10:25' });

    const atStart = computeActiveLessonStatus(pair, new Date(2025, 8, 1, 9, 0, 0), true);
    expect(atStart.isActive).toBe(true);
    expect(atStart.phase).toBe(1);
    expect(atStart.isBreak).toBe(false);
    expect(atStart.remainingMinutes).toBe(85);
    expect(atStart.secondsToBreak).toBe(2400);
    expect(atStart.breakProgressNotch).toBeCloseTo(40 / 85, 4);
    expect(atStart.statusText).toBe('До конца пары: 85 мин (перерыв через 40 мин)');

    const beforeBreak = computeActiveLessonStatus(
      pair,
      new Date(2025, 8, 1, 9, 39, 15),
      true,
    );
    expect(beforeBreak.phase).toBe(1);
    expect(beforeBreak.secondsToBreak).toBe(45);
    expect(beforeBreak.statusText).toBe('До конца пары: 46 мин (перерыв через 45 сек)');

    const inBreak = computeActiveLessonStatus(
      pair,
      new Date(2025, 8, 1, 9, 40, 0),
      true,
    );
    expect(inBreak.phase).toBe(2);
    expect(inBreak.isBreak).toBe(true);
    expect(inBreak.statusText).toBe('Перерыв 5 мин 0 сек · До конца пары: 45 мин');

    const secondHalf = computeActiveLessonStatus(
      pair,
      new Date(2025, 8, 1, 9, 45, 0),
      true,
    );
    expect(secondHalf.phase).toBe(3);
    expect(secondHalf.isBreak).toBe(false);
    expect(secondHalf.statusText).toBe('2-я часть • До конца пары: 40 мин');

    const lastMinutes = computeActiveLessonStatus(
      pair,
      new Date(2025, 8, 1, 10, 22, 30),
      true,
    );
    expect(lastMinutes.phase).toBe(3);
    expect(lastMinutes.remainingMinutes).toBe(3);
    expect(lastMinutes.statusText).toBe('2-я часть • До конца пары: 3 мин (30 сек)');

    // Half-open [start, end)
    expect(
      computeActiveLessonStatus(pair, new Date(2025, 8, 1, 10, 25, 0), true).isActive,
    ).toBe(false);
    expect(
      computeActiveLessonStatus(pair, new Date(2025, 8, 1, 9, 15, 0), false).isActive,
    ).toBe(false);

    // Short (< 70m) lesson skips break UI
    const shortPair = makeLesson({ startTime: '10:00', endTime: '10:45' });
    const shortStatus = computeActiveLessonStatus(
      shortPair,
      new Date(2025, 8, 1, 10, 20, 0),
      true,
    );
    expect(shortStatus.isActive).toBe(true);
    expect(shortStatus.phase).toBe(1);
    expect(shortStatus.isBreak).toBe(false);
    expect(shortStatus.secondsToBreak).toBe(0);
    expect(shortStatus.statusText).toBe('До конца пары: 25 мин');

    expect(parseTimeToSeconds('9:05')).toBe(9 * 3600 + 5 * 60);
    expect(parseTimeToSeconds('25:00')).toBeNull();
  });

  it('finds upcoming lesson dates and next lesson for subject prioritizing ЛР/ПЗ over ЛК', () => {
    const mon = new Date(2025, 8, 1, 12, 0, 0); // Week 1 Mon
    const weeklyMonLesson = makeLesson({ dayOfWeek: 1, weeks: [1, 2, 3, 4] });
    const upcoming = getUpcomingLessonDates(weeklyMonLesson, mon, 3);
    expect(upcoming).toEqual([
      { dayIndex: 14, dateFormatted: '08.09' },
      { dayIndex: 21, dateFormatted: '15.09' },
      { dayIndex: 28, dateFormatted: '22.09' },
    ]);

    const lessons = [
      makeLesson({
        title: 'БД',
        lessonType: 'ЛК',
        startTime: '09:00',
        dayOfWeek: 1,
        weeks: [1, 2, 3, 4],
      }),
      makeLesson({
        title: 'БД',
        lessonType: 'ЛР',
        startTime: '10:35',
        dayOfWeek: 1,
        weeks: [1, 2, 3, 4],
      }),
    ];

    // Same day after 08:00 picks ЛР over ЛК
    const sameDayTarget = findNextLessonForSubject(lessons, 'БД', mon, {
      afterTime: '08:00',
    });
    expect(sameDayTarget?.dateFormatted).toBe('01.09.2025');
    expect(sameDayTarget?.timeFormatted).toBe('10:35');
    expect(sameDayTarget?.lessonType).toBe('ЛР');

    // afterTime = 10:35 skips today -> next Monday 08.09.2025
    const nextWeekTarget = findNextLessonForSubject(lessons, 'БД', mon, {
      afterTime: '10:35',
    });
    expect(nextWeekTarget?.dateFormatted).toBe('08.09.2025');
    expect(nextWeekTarget?.lessonType).toBe('ЛР');

    expect(findNextLessonForSubject(lessons, 'Общее', mon)).toBeNull();
    expect(findNextLessonForSubject(lessons, 'Все', mon)).toBeNull();
  });

  it('resolves co-attending groups from employee schedules and falls back cleanly', () => {
    const lesson = makeLesson({
      teacherUrlId: 'a-smirnov',
      dayOfWeek: 1,
      startTime: '09:00',
      title: 'РПМ',
      lessonType: 'ЛК',
      studentGroups: ['351001'],
    });

    const empSchedules: Record<string, BsuirScheduleResponse> = {
      'a-smirnov': {
        schedules: {
          Понедельник: [
            {
              subject: 'РПМ',
              lessonTypeAbbrev: 'ЛК',
              startLessonTime: '09:00',
              studentGroups: [{ name: '351001' }, { name: '351002' }],
            },
          ],
        },
      },
    };

    expect(resolveAllGroupsForLesson(lesson, empSchedules, '351001')).toEqual([
      '351001',
      '351002',
    ]);
    expect(resolveAllGroupsForLesson(lesson, {}, '351001')).toEqual(['351001']);
  });

  it('detects session period, infers note lesson type, and calculates reminder times', () => {
    expect(
      isSessionPeriodActive('10.01.2026', '25.01.2026', [], new Date(2026, 0, 25, 23, 0)),
    ).toBe(true);
    expect(
      isSessionPeriodActive('10.01.2026', '25.01.2026', [], new Date(2026, 0, 26, 0, 0)),
    ).toBe(false);
    expect(
      isSessionPeriodActive(
        null,
        null,
        [makeLesson({ dateLesson: '14.01.2026' })],
        new Date(2026, 0, 14, 10, 0),
      ),
    ).toBe(true);

    expect(inferNoteLessonType({ lessonType: '', text: 'Сдать лабу №3' })).toBe('ЛР');
    expect(inferNoteLessonType({ lessonType: '', text: 'Семинар 2' })).toBe('ПЗ');
    expect(inferNoteLessonType({ lessonType: '', text: 'Повторить лекцию' })).toBe('ЛК');
    expect(inferNoteLessonType({ lessonType: 'ПЗ', text: 'любой текст' })).toBe('ПЗ');
    expect(inferNoteLessonType({ lessonType: '', text: 'Купить тетрадь' })).toBe('');

    const parsedMs = parseNoteDateMillis('15.01.2026');
    expect(parsedMs).toBe(new Date(2026, 0, 15, 12, 0, 0, 0).getTime());
    expect(parseNoteDateMillis('bad-date')).toBe(0);

    expect(calculateReminderTime('1_day_before_18', 15, 0, 2026, 10, 30)).toBe(
      new Date(2026, 0, 14, 18, 0, 0, 0).getTime(),
    );
    expect(calculateReminderTime('15_min_before', 15, 0, 2026, 10, 30)).toBe(
      new Date(2026, 0, 15, 10, 15, 0, 0).getTime(),
    );
    expect(calculateReminderTime('custom_hours_3', 15, 0, 2026, 10, 30)).toBe(
      new Date(2026, 0, 15, 7, 30, 0, 0).getTime(),
    );
    // Default customHours = 3 matching Android MainActivity.kt:7481 & ThemeContext.tsx:156
    expect(calculateReminderTime('custom_hours', 15, 0, 2026, 10, 30)).toBe(
      new Date(2026, 0, 15, 7, 30, 0, 0).getTime(),
    );

    // Non-standard abbreviations УЛр / УПз prioritize with ЛР/ПЗ over ЛК
    const ulrLessons = [
      makeLesson({ title: 'Физика', lessonType: 'ЛК', startTime: '09:00', dayOfWeek: 1 }),
      makeLesson({ title: 'Физика', lessonType: 'УЛр', startTime: '10:35', dayOfWeek: 1 }),
    ];
    const nextUlr = findNextLessonForSubject(ulrLessons, 'Физика', new Date(2025, 8, 1, 8, 0), {
      afterTime: '08:00',
    });
    expect(nextUlr?.lessonType).toBe('УЛр');
    expect(nextUlr?.timeFormatted).toBe('10:35');

    // Exam co-attending group resolution prefers entry containing currentGroup
    const examLesson = makeLesson({
      teacherUrlId: 'a-smirnov',
      dateLesson: '18.01.2026',
      startTime: '09:00',
      studentGroups: ['310101'],
    });
    const splitExamSchedules: Record<string, BsuirScheduleResponse> = {
      'a-smirnov': {
        exams: [
          {
            subject: 'РПМ',
            startLessonTime: '09:00',
            dateLesson: '18.01.2026',
            studentGroups: [{ name: '251001' }, { name: '251002' }],
          },
          {
            subject: 'РПМ',
            startLessonTime: '09:00',
            dateLesson: '18.01.2026',
            studentGroups: [{ name: '310101' }],
          },
        ],
      },
    };
    expect(resolveAllGroupsForLesson(examLesson, splitExamSchedules, '310101')).toEqual([
      '310101',
    ]);
  });
});
