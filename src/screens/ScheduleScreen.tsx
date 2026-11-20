import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  GraduationCap,
  History,
  Search,
  User,
  X,
} from 'lucide-react';
import type { Lesson } from '../types';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/ThemeContext';
import { triggerHaptic } from '../services/telegram';
import { formatExamDateHeader } from '../utils/formatters';
import {
  buildCalendarCarousel,
  computeActiveLessonStatus,
  filterAndSortExams,
  filterLessons,
} from '../utils/scheduleMath';
import { AppleButtonUtility } from '../components/ui/AppleButtons';
import { ApplePullToRefresh } from '../components/ui/ApplePullToRefresh';
import { AppleSearchInput } from '../components/ui/AppleSearchInput';
import { AppleSegmentedControl } from '../components/ui/AppleSegmentedControl';
import { AppleVerticalDateRail } from '../components/ui/AppleVerticalDateRail';
import { LessonCard } from '../components/schedule/LessonCard';
import { LessonDetailModal } from '../components/schedule/LessonDetailModal';
import { QuickNoteModal } from '../components/schedule/QuickNoteModal';
import { SessionExamCard } from '../components/schedule/SessionExamCard';
import { colorWithAlpha } from '../components/ui/LiquidGlassSurface';

const SUBGROUP_ITEMS = ['Все', '1 подгр.', '2 подгр.'];

export function ScheduleScreen(props: {
  onOpenNotesForSubject?: (subject: string) => void;
}): React.JSX.Element {
  const { onOpenNotesForSubject } = props;
  const {
    selectedGroup,
    selectedEmployee,
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
    notes,
    isScheduleRefreshing,
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
  } = useAppData();

  const { tokens, isDarkTheme } = useTheme();

  const [now, setNow] = useState<Date>(() => new Date());
  const [expanded, setExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLessonForSheet, setSelectedLessonForSheet] = useState<Lesson | null>(null);
  const [noteLessonToAdd, setNoteLessonToAdd] = useState<Lesson | null>(null);

  const dismissLessonDetail = useCallback(() => setSelectedLessonForSheet(null), []);
  const dismissQuickNote = useCallback(() => setNoteLessonToAdd(null), []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const calendarItems = useMemo(() => buildCalendarCarousel(now, 91, 7), [
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ]);

  const railDays = useMemo(() => calendarItems.map((c) => c.dayOfMonth), [calendarItems]);
  const railWeekDays = useMemo(() => calendarItems.map((c) => c.weekDayShort), [calendarItems]);

  const selectedDay = calendarItems[selectedDayIndex] ?? calendarItems[7];

  const matchingGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allGroups
      .filter((g) => (g.name ?? '').toLowerCase().includes(q))
      .slice(0, 5);
  }, [allGroups, searchQuery]);

  const matchingEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return allEmployees
      .filter((emp) => {
        const hay = `${emp.fullName ?? ''} ${emp.lastName ?? ''} ${emp.fio ?? ''} ${emp.urlId ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 5);
  }, [allEmployees, searchQuery]);

  const dayLessons = useMemo(() => {
    if (!selectedDay) return [];
    return filterLessons(lessons, selectedDay.dayOfWeek, selectedDay.weekNumber, subgroup);
  }, [lessons, selectedDay, subgroup]);

  const filteredExams = useMemo(
    () => filterAndSortExams(exams, subgroup),
    [exams, subgroup],
  );

  const groupedExams = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    for (const ex of filteredExams) {
      const key = ex.dateLesson?.trim() || 'Без даты';
      const arr = map.get(key) ?? [];
      arr.push(ex);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [filteredExams]);

  const isModalOpen = selectedLessonForSheet !== null || noteLessonToAdd !== null;
  const weekEyebrow = isSessionMode
    ? 'Сессия'
    : (currentWeek as number) === 0
      ? 'Каникулы'
      : `${selectedDay?.weekNumber ?? currentWeek} учебная неделя`;

  const findNotePreviewForLesson = (title: string): string | null => {
    const cleanTitle = title.trim().toLowerCase();
    const dateKey = selectedDay?.dateFormatted ?? '';
    const dateMatched = notes.find(
      (n) => n.subject.trim().toLowerCase() === cleanTitle && n.date === dateKey,
    );
    if (dateMatched) return dateMatched.text;
    const pinnedMatched = notes.find(
      (n) => n.subject.trim().toLowerCase() === cleanTitle && n.isPinned,
    );
    return pinnedMatched ? pinnedMatched.text : null;
  };

  return (
    <div className="h-full w-full relative flex overflow-hidden">
      {/* Main Scroll Content */}
      <div
        className="flex-1 min-w-0 h-full transition-all duration-300"
        style={{
          filter: isModalOpen ? 'blur(16px)' : 'none',
          transform: isModalOpen ? 'scale(0.95)' : 'scale(1)',
        }}
      >
        <ApplePullToRefresh
          isRefreshing={isScheduleRefreshing}
          onRefresh={() => void refreshSchedule(true)}
          accentColor={tokens.accent}
          className="h-full overflow-y-auto"
        >
          <div
            className="pt-[24px] pb-[96px] flex flex-col gap-[14px]"
            style={{
              paddingLeft: '20px',
              paddingRight: isSessionMode || !dateRailVisible ? '16px' : '8px',
            }}
          >
            {/* Header Block */}
            <div className="flex flex-col items-center gap-[8px]">
              <span
                className="text-s-15 font-medium text-center"
                style={{ color: tokens.textSecondary }}
              >
                {weekEyebrow}
              </span>

              {selectedEmployee ? (
                <div className="w-full flex items-center justify-center gap-2">
                  <button
                    type="button"
                    aria-label="Назад к группе"
                    onClick={() => {
                      triggerHaptic('impact', 'light');
                      void selectEmployee(null);
                    }}
                    className="w-[34px] h-[34px] rounded-full flex items-center justify-center bg-transparent border-0 cursor-pointer shrink-0"
                    style={{ color: tokens.accent }}
                  >
                    <ChevronLeft size={28} aria-hidden="true" />
                  </button>
                  <h1
                    className="font-semibold truncate text-center"
                    style={{
                      fontSize: 'calc(24px * var(--text-scale, 1))',
                      color: tokens.text,
                    }}
                  >
                    {selectedEmployee.fullName}
                  </h1>
                </div>
              ) : (
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => {
                    triggerHaptic('selection');
                    setExpanded((prev) => !prev);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 bg-transparent border-0 cursor-pointer px-2 py-0.5"
                >
                  <span
                    className="font-semibold leading-[1.1]"
                    style={{
                      fontSize: 'calc(33px * var(--text-scale, 1))',
                      color: tokens.text,
                    }}
                  >
                    {selectedGroup}
                  </span>
                  {expanded ? (
                    <ChevronUp size={26} style={{ color: tokens.textSecondary }} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={26} style={{ color: tokens.textSecondary }} aria-hidden="true" />
                  )}
                </button>
              )}

              {/* Expandable Search & History Drawer */}
              {expanded && !selectedEmployee && (
                <div
                  className="w-full rounded-[18px] p-[14px] border flex flex-col gap-[12px] mt-1"
                  style={{
                    backgroundColor: tokens.card,
                    borderColor: tokens.border,
                  }}
                >
                  <AppleSearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Введите номер группы или преподавателя"
                    isDarkTheme={isDarkTheme}
                    inputBg={isDarkTheme ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
                    inputBorder={tokens.border}
                    inputTextColor={tokens.text}
                    inputIconColor={tokens.textSecondary}
                    onDone={() => {
                      const trimmed = searchQuery.trim();
                      if (trimmed) {
                        void selectGroup(trimmed, true);
                        setSearchQuery('');
                        setExpanded(false);
                      }
                    }}
                  />

                  {/* Autocomplete */}
                  {(matchingGroups.length > 0 || matchingEmployees.length > 0) && (
                    <div className="flex flex-col gap-1.5">
                      <span
                        className="text-s-12 font-bold px-1"
                        style={{ color: tokens.accent }}
                      >
                        Подсказки
                      </span>
                      {matchingGroups.map((grp) => {
                        const grpName = grp.name ?? '';
                        return (
                          <button
                            key={`grp-${grpName}`}
                            type="button"
                            onClick={() => {
                              triggerHaptic('selection');
                              void selectGroup(grpName, true);
                              setSearchQuery('');
                              setExpanded(false);
                            }}
                            className="w-full rounded-[12px] px-3 py-2 flex items-center gap-2.5 bg-transparent hover:bg-black/5 border-0 cursor-pointer text-left"
                          >
                            <Search size={15} style={{ color: tokens.accent }} aria-hidden="true" />
                            <span className="text-s-15 font-bold" style={{ color: tokens.text }}>
                              {grpName}
                            </span>
                            <span className="text-s-12 truncate" style={{ color: tokens.textSecondary }}>
                              ({grp.facultyAbbrev ?? 'БГУИР'} • {grp.course ?? 1} курс)
                            </span>
                          </button>
                        );
                      })}
                      {matchingEmployees.map((emp) => {
                        const urlId = emp.urlId ?? '';
                        const fullName = emp.fullName ?? emp.fio ?? urlId;
                        return (
                          <button
                            key={`emp-${urlId}-${fullName}`}
                            type="button"
                            onClick={() => {
                              triggerHaptic('selection');
                              void selectEmployee({ urlId, fullName }, true);
                              setSearchQuery('');
                              setExpanded(false);
                            }}
                            className="w-full rounded-[12px] px-3 py-2 flex items-center gap-2.5 bg-transparent hover:bg-black/5 border-0 cursor-pointer text-left"
                          >
                            <User size={15} style={{ color: tokens.accent }} aria-hidden="true" />
                            <div className="flex-1 min-w-0 flex flex-col">
                              <span className="text-s-14 font-bold truncate" style={{ color: tokens.text }}>
                                {fullName}
                              </span>
                              {(emp.degree || emp.rank) && (
                                <span className="text-s-11 truncate" style={{ color: tokens.textSecondary }}>
                                  {[emp.degree, emp.rank].filter(Boolean).join(', ')}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Recent History */}
                  {searchHistory.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span
                        className="text-s-12 font-bold px-1"
                        style={{ color: colorWithAlpha(tokens.textSecondary, 0.75) }}
                      >
                        Недавние
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {searchHistory.slice(0, 5).map((item) => (
                          <div
                            key={`${item.kind}-${item.id}`}
                            className="rounded-full pl-3 pr-1.5 py-1 border inline-flex items-center gap-1.5"
                            style={{
                              backgroundColor: isDarkTheme
                                ? 'rgba(255,255,255,0.06)'
                                : 'rgba(0,0,0,0.04)',
                              borderColor: tokens.border,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('selection');
                                if (item.kind === 'employee') {
                                  void selectEmployee({ urlId: item.id, fullName: item.label }, true);
                                } else {
                                  void selectGroup(item.id, true);
                                }
                                setExpanded(false);
                              }}
                              className="inline-flex items-center gap-1.5 bg-transparent border-0 p-0 cursor-pointer text-s-13 font-medium"
                              style={{ color: tokens.text }}
                            >
                              <History size={13} style={{ color: tokens.textSecondary }} aria-hidden="true" />
                              <span>{item.label}</span>
                            </button>
                            <button
                              type="button"
                              aria-label={`Удалить ${item.label}`}
                              onClick={() => {
                                triggerHaptic('selection');
                                void removeFromSearchHistory(item.id, item.kind);
                              }}
                              className="w-[20px] h-[20px] rounded-full flex items-center justify-center bg-transparent border-0 cursor-pointer"
                              style={{ color: tokens.textSecondary }}
                            >
                              <X size={12} aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Subgroup Segmented Control + Reset to Today */}
              <div className="w-full flex items-center gap-2 mt-1">
                <AppleSegmentedControl
                  items={SUBGROUP_ITEMS}
                  selectedIndex={subgroup}
                  onSelectIndex={(idx) => void setSubgroup(idx as 0 | 1 | 2)}
                  isDarkTheme={isDarkTheme}
                  accentColor={tokens.accent}
                  className="flex-1"
                />
                {selectedDayIndex !== 7 && !isSessionMode && (
                  <AppleButtonUtility
                    isDarkTheme={isDarkTheme}
                    onClick={resetToToday}
                    className="shrink-0"
                  >
                    Сегодня
                  </AppleButtonUtility>
                )}
              </div>
            </div>

            {/* Main Content */}
            {isSessionMode ? (
              <div className="flex flex-col gap-[12px]">
                {(sessionPeriod.startExamsDate || sessionPeriod.endExamsDate) && (
                  <div
                    className="rounded-[11px] px-3.5 py-2.5 border flex items-center gap-2"
                    style={{
                      backgroundColor: isDarkTheme ? '#272729' : '#FFFFFF',
                      borderColor: tokens.border,
                    }}
                  >
                    <Calendar size={16} style={{ color: tokens.accent }} aria-hidden="true" />
                    <span
                      className="font-semibold"
                      style={{
                        fontSize: 'calc(13.5px * var(--text-scale, 1))',
                        color: tokens.text,
                      }}
                    >
                      Период сессии: {sessionPeriod.startExamsDate || '?'} – {sessionPeriod.endExamsDate || '?'}
                    </span>
                  </div>
                )}

                {filteredExams.length === 0 ? (
                  <div className="pt-[60px] flex flex-col items-center text-center gap-2">
                    <span
                      className="font-semibold"
                      style={{ fontSize: 'calc(24px * var(--text-scale, 1))', color: tokens.text }}
                    >
                      Экзамены не найдены
                    </span>
                    <span
                      className="text-s-15 whitespace-pre-line"
                      style={{ color: tokens.textSecondary }}
                    >
                      {sessionPeriod.startExamsDate || sessionPeriod.endExamsDate
                        ? `Сессия: с ${sessionPeriod.startExamsDate || '?'} по ${sessionPeriod.endExamsDate || '?'}\nРасписание ещё не опубликовано деканатом`
                        : 'Для выбранной группы нет назначенных экзаменов'}
                    </span>
                  </div>
                ) : (
                  groupedExams.map(([dateKey, items]) => (
                    <div key={dateKey} className="flex flex-col gap-[8px]">
                      <h2
                        className="font-bold px-1 mt-1"
                        style={{
                          fontSize: 'calc(17px * var(--text-scale, 1))',
                          color: tokens.text,
                        }}
                      >
                        {formatExamDateHeader(dateKey)}
                      </h2>
                      {items.map((ex, idx) => (
                        <SessionExamCard
                          key={`${ex.title}-${ex.startTime}-${idx}`}
                          exam={ex}
                          onClick={() => setSelectedLessonForSheet(ex)}
                          onTeacherClick={(urlId, fullName) =>
                            void selectEmployee({ urlId, fullName }, true)
                          }
                        />
                      ))}
                    </div>
                  ))
                )}
              </div>
            ) : dayLessons.length === 0 ? (
              <div className="pt-[60px] flex flex-col items-center text-center gap-1.5">
                <span
                  className="font-semibold"
                  style={{ fontSize: 'calc(24px * var(--text-scale, 1))', color: tokens.text }}
                >
                  Отличный день
                </span>
                <span
                  className="text-s-15 font-medium"
                  style={{ color: tokens.textSecondary }}
                >
                  Пар не найдено
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-[6px]">
                {dayLessons.map((lesson, idx) => {
                  const status = computeActiveLessonStatus(lesson, now, selectedDayIndex === 7);
                  const preview = findNotePreviewForLesson(lesson.title);
                  return (
                    <LessonCard
                      key={`${lesson.title}-${lesson.startTime}-${lesson.subgroup}-${idx}`}
                      lesson={lesson}
                      isActive={status.isActive}
                      notePreview={preview}
                      onClick={() => setSelectedLessonForSheet(lesson)}
                      onLongClick={() => setNoteLessonToAdd(lesson)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </ApplePullToRefresh>
      </div>

      {/* Right Vertical Date Rail (hidden in Session Mode) */}
      {!isSessionMode && (
        <AppleVerticalDateRail
          days={railDays}
          weekDays={railWeekDays}
          selectedDayIndex={selectedDayIndex}
          onDaySelected={setSelectedDayIndex}
          todayIndex={7}
          isDarkTheme={isDarkTheme}
          selectedColor={tokens.accent}
          isVisible={dateRailVisible}
          onVisibilityChange={setDateRailVisible}
        />
      )}

      {/* Session / Schedule Floating Pill Toggle */}
      {(isSessionMode || isSessionAutoActive) && (
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            setSessionMode(!isSessionMode);
          }}
          className={`absolute bottom-[20px] ${!isSessionMode && dateRailVisible ? 'right-[64px]' : 'right-[20px]'} z-30 rounded-full px-4 py-2.5 border shadow-lg inline-flex items-center gap-2 text-s-14 font-semibold cursor-pointer`}
          style={{
            backgroundColor: isSessionMode ? tokens.card : tokens.accent,
            borderColor: isSessionMode ? tokens.border : 'transparent',
            color: isSessionMode ? tokens.text : tokens.accentFg,
          }}
        >
          {isSessionMode ? (
            <>
              <Calendar size={16} style={{ color: tokens.accent }} aria-hidden="true" />
              <span>Расписание</span>
            </>
          ) : (
            <>
              <GraduationCap size={16} aria-hidden="true" />
              <span>Сессия</span>
            </>
          )}
        </button>
      )}

      {/* Modals */}
      <LessonDetailModal
        lesson={selectedLessonForSheet}
        isToday={selectedDayIndex === 7}
        currentGroup={selectedGroup}
        employeeSchedules={employeeSchedules}
        onDismiss={dismissLessonDetail}
        onTeacherClick={(urlId, fullName) => void selectEmployee({ urlId, fullName }, true)}
        onGroupClick={(grpName) => void selectGroup(grpName, true)}
        onUpcomingDateClick={(idx) => setSelectedDayIndex(idx)}
        onAddNoteClick={(lesson) => setNoteLessonToAdd(lesson)}
        onOpenNotesForSubject={onOpenNotesForSubject}
      />

      <QuickNoteModal
        lesson={noteLessonToAdd}
        allLessons={lessons}
        selectedDate={selectedDay?.date ?? now}
        subgroup={subgroup}
        onDismiss={dismissQuickNote}
        onSave={async (input) => {
          await addNote(input);
        }}
      />
    </div>
  );
}
