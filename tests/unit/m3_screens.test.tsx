import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../../src/context/ThemeContext';
import { AppDataProvider, useAppData } from '../../src/context/AppDataContext';
import { resetMockStore } from '../../src/services/mockData';
import * as apiClient from '../../src/services/apiClient';
import { _resetTelegramAdaptersForTest } from '../../src/services/telegram';
import { LoginScreen } from '../../src/screens/LoginScreen';
import { ScheduleScreen } from '../../src/screens/ScheduleScreen';
import { MarksScreen } from '../../src/screens/MarksScreen';
import { GradebookScreen } from '../../src/screens/GradebookScreen';
import { NotesScreen } from '../../src/screens/NotesScreen';
import { LessonCard } from '../../src/components/schedule/LessonCard';
import { LessonDetailModal } from '../../src/components/schedule/LessonDetailModal';
import { QuickNoteModal } from '../../src/components/schedule/QuickNoteModal';
import { SessionExamCard } from '../../src/components/schedule/SessionExamCard';
import type { BsuirScheduleResponse, Lesson, TelegramWebApp } from '../../src/types';

function ThemeModeDriver({
  mode,
  children,
}: {
  mode: 'dark' | 'light';
  children: React.ReactNode;
}) {
  const { setThemeMode } = useTheme();
  React.useEffect(() => {
    setThemeMode(mode);
  }, [mode, setThemeMode]);
  return <>{children}</>;
}

function renderWithProviders(
  ui: React.ReactNode,
  options?: { theme?: 'dark' | 'light' },
) {
  const mode = options?.theme ?? 'dark';
  return render(
    <ThemeProvider>
      <ThemeModeDriver mode={mode}>
        <AppDataProvider>{ui}</AppDataProvider>
      </ThemeModeDriver>
    </ThemeProvider>,
  );
}

function AuthHelper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, login } = useAppData();
  React.useEffect(() => {
    if (!isAuthenticated) {
      void login('31010001', 'secret123');
    }
  }, [isAuthenticated, login]);
  return <>{children}</>;
}

const SAMPLE_LESSON: Lesson = {
  startTime: '09:00',
  endTime: '10:25',
  title: 'РПМ',
  details: 'Разработка программных модулей',
  subjectFullName: 'Разработка программных модулей',
  lessonType: 'ЛК',
  teacherName: 'Смирнов А. В.',
  teacherFullName: 'Смирнов Алексей Владимирович',
  teacherPhoto: '',
  teacherUrlId: 'a-smirnov',
  auditory: 'ауд. 312-4',
  subgroup: 0,
  weeks: [1, 2, 3, 4],
  dayOfWeek: 1,
  dateLesson: null,
  note: null,
  studentGroups: ['310101'],
};

const SAMPLE_EMPLOYEE_SCHEDULES: Record<string, BsuirScheduleResponse> = {
  'a-smirnov': {
    schedules: {
      Понедельник: [
        {
          subject: 'РПМ',
          lessonTypeAbbrev: 'ЛК',
          startLessonTime: '09:00',
          endLessonTime: '10:25',
          studentGroups: [{ name: '310101' }, { name: '310102' }],
        },
      ],
    },
  },
};

describe('M3 Screens & Schedule Components', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetMockStore();
    _resetTelegramAdaptersForTest();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Offline in unit test')),
    );
    if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
      Element.prototype.scrollTo = vi.fn();
    }
    if (typeof window !== 'undefined') {
      window.scrollTo = vi.fn();
    }
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.cssText = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.Telegram;
    vi.restoreAllMocks();
  });

  // ==================== F9: LoginScreen ====================
  describe('LoginScreen (F9)', () => {
    it('validates empty fields, toggles password visibility, supports guest login and Dark/Light themes', async () => {
      let authSnapshot = '';
      function Probe() {
        const { authMode } = useAppData();
        authSnapshot = authMode;
        return <LoginScreen />;
      }

      renderWithProviders(<Probe />, { theme: 'light' });
      expect(document.documentElement.dataset.theme).toBe('light');
      expect(screen.getByText('ИИС БГУИР')).toBeInTheDocument();
      expect(screen.getByText('Личный кабинет')).toBeInTheDocument();

      // Empty submit validation
      fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Пожалуйста, заполните все поля');

      // Password show/hide toggle
      const pwdInput = screen.getByLabelText('Пароль') as HTMLInputElement;
      expect(pwdInput.type).toBe('password');
      fireEvent.click(screen.getByRole('button', { name: 'Показать пароль' }));
      expect(pwdInput.type).toBe('text');
      fireEvent.click(screen.getByRole('button', { name: 'Скрыть пароль' }));
      expect(pwdInput.type).toBe('password');

      // Guest login
      fireEvent.click(screen.getByRole('button', { name: 'Продолжить без входа' }));
      await waitFor(() => {
        expect(authSnapshot).toBe('guest');
      });
    });

    it('logs in cleanly with offline fallback in Dark theme and displays offline badge when triggered', async () => {
      let authSnapshot = '';
      function Probe() {
        const { authMode } = useAppData();
        authSnapshot = authMode;
        return <LoginScreen />;
      }

      renderWithProviders(<Probe />, { theme: 'dark' });
      expect(document.documentElement.dataset.theme).toBe('dark');

      fireEvent.change(screen.getByLabelText('Номер зачетки'), {
        target: { value: '31010001' },
      });
      fireEvent.change(screen.getByLabelText('Пароль'), {
        target: { value: 'secret123' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

      await waitFor(() => {
        expect(authSnapshot).toBe('authenticated');
      });
      expect(await screen.findByText(/Оффлайн-режим/i)).toBeInTheDocument();
    });
  });

  // ==================== F10: Schedule Components ====================
  describe('Schedule Components (LessonCard, SessionExamCard, LessonDetailModal, QuickNoteModal)', () => {
    it('renders LessonCard badges, cleanAuditory fallbacks, note preview, tap and quick-note trigger', () => {
      const onClick = vi.fn();
      const onLongClick = vi.fn();
      const fizLesson: Lesson = {
        ...SAMPLE_LESSON,
        title: 'ФизК',
        lessonType: 'ПЗ',
        auditory: '',
        subgroup: 2,
      };

      const { rerender } = renderWithProviders(
        <LessonCard
          lesson={SAMPLE_LESSON}
          isActive
          notePreview="Сдать отчёт"
          onClick={onClick}
          onLongClick={onLongClick}
        />,
      );

      expect(screen.getByText('ЛК')).toBeInTheDocument();
      expect(screen.getByText('312-4')).toBeInTheDocument();
      expect(screen.getByText('Сдать отчёт')).toBeInTheDocument();
      expect(screen.getByText('Смирнов А. В.')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'РПМ 09:00–10:25' }));
      expect(onClick).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: 'Быстрая заметка к РПМ' }));
      expect(onLongClick).toHaveBeenCalledTimes(1);

      rerender(
        <ThemeProvider>
          <AppDataProvider>
            <LessonCard lesson={fizLesson} onClick={onClick} />
          </AppDataProvider>
        </ThemeProvider>,
      );

      expect(screen.getByText('ПЗ')).toBeInTheDocument();
      expect(screen.getByText('ФизК (2 п.)')).toBeInTheDocument();
      expect(screen.getByText('спортзал')).toBeInTheDocument();
    });

    it('renders SessionExamCard with type pill, clickable teacher and auditory chip', () => {
      const onClick = vi.fn();
      const onTeacherClick = vi.fn();
      const exam: Lesson = {
        ...SAMPLE_LESSON,
        lessonType: 'Экзамен',
        dateLesson: '15.01.2026',
        note: 'Принести зачетку',
      };

      renderWithProviders(
        <SessionExamCard exam={exam} onClick={onClick} onTeacherClick={onTeacherClick} />,
        { theme: 'light' },
      );

      expect(screen.getByText('Экзамен')).toBeInTheDocument();
      expect(screen.getByText('Принести зачетку')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Смирнов А. В.' }));
      expect(onTeacherClick).toHaveBeenCalledWith('a-smirnov', 'Смирнов Алексей Владимирович');
    });

    it('renders LessonDetailModal with 1s live break timer, 47.06% notch, co-attending groups, upcoming dates & add note', () => {
      // 09:42:00 is 42m after 09:00 -> Phase 2 (5m break, orange #FF9500)
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 2, 16, 9, 42, 0));

      const onDismiss = vi.fn();
      const onTeacherClick = vi.fn();
      const onGroupClick = vi.fn();
      const onUpcomingDateClick = vi.fn();
      const onAddNoteClick = vi.fn();

      renderWithProviders(
        <LessonDetailModal
          lesson={SAMPLE_LESSON}
          isToday
          currentGroup="310101"
          employeeSchedules={SAMPLE_EMPLOYEE_SCHEDULES}
          onDismiss={onDismiss}
          onTeacherClick={onTeacherClick}
          onGroupClick={onGroupClick}
          onUpcomingDateClick={onUpcomingDateClick}
          onAddNoteClick={onAddNoteClick}
        />,
      );

      expect(screen.getByText('Разработка программных модулей')).toBeInTheDocument();
      expect(screen.getByText(/Перерыв 3 мин 0 сек/)).toBeInTheDocument();
      const notch = screen.getByTestId('break-notch');
      expect(notch.style.left).toBe('47.06%');

      // Advance 1s to confirm live timer tick
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText(/Перерыв 2 мин 59 сек/)).toBeInTheDocument();

      // Co-attending groups resolved from employeeSchedules
      expect(screen.getByRole('button', { name: '310101' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '310102' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '310102' }));
      expect(onGroupClick).toHaveBeenCalledWith('310102');

      // Add note CTA
      fireEvent.click(screen.getByRole('button', { name: '+ Добавить заметку к паре' }));
      expect(onAddNoteClick).toHaveBeenCalledWith(SAMPLE_LESSON);
    });

    it('renders QuickNoteModal with next lesson chip, pin toggle, and saves note with inferred type', async () => {
      const onDismiss = vi.fn();
      const onSave = vi.fn().mockResolvedValue(undefined);
      const selectedDate = new Date(2026, 2, 16, 12, 0, 0);

      renderWithProviders(
        <QuickNoteModal
          lesson={SAMPLE_LESSON}
          allLessons={[SAMPLE_LESSON]}
          selectedDate={selectedDate}
          subgroup={0}
          onDismiss={onDismiss}
          onSave={onSave}
        />,
      );

      expect(screen.getByText('Заметка • РПМ')).toBeInTheDocument();
      const saveBtn = screen.getByRole('button', { name: 'Сохранить' });
      expect(saveBtn).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: 'Закрепить' }));
      fireEvent.change(screen.getByPlaceholderText('Что нужно сделать к паре...'), {
        target: { value: 'Сделать лабу к паре' },
      });
      expect(saveBtn).not.toBeDisabled();

      await act(async () => {
        fireEvent.click(saveBtn);
      });

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'РПМ',
          text: 'Сделать лабу к паре',
          isPinned: true,
          lessonType: 'ЛК',
        }),
      );
      expect(onDismiss).toHaveBeenCalled();
    });

    it('QuickNoteModal preserves typed text when allLessons updates nextTarget while open', () => {
      const onDismiss = vi.fn();
      const onSave = vi.fn().mockResolvedValue(undefined);
      const selectedDate = new Date(2026, 2, 16, 12, 0, 0);

      const { rerender } = renderWithProviders(
        <QuickNoteModal
          lesson={SAMPLE_LESSON}
          allLessons={[SAMPLE_LESSON]}
          selectedDate={selectedDate}
          subgroup={0}
          onDismiss={onDismiss}
          onSave={onSave}
        />,
      );

      const textarea = screen.getByPlaceholderText('Что нужно сделать к паре...') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Подготовить отчёт' } });
      expect(textarea.value).toBe('Подготовить отчёт');

      const updatedLessons: Lesson[] = [
        SAMPLE_LESSON,
        {
          ...SAMPLE_LESSON,
          startTime: '11:40',
          endTime: '13:05',
          dayOfWeek: 1,
        },
      ];

      rerender(
        <ThemeProvider>
          <ThemeModeDriver mode="dark">
            <AppDataProvider>
              <QuickNoteModal
                lesson={SAMPLE_LESSON}
                allLessons={updatedLessons}
                selectedDate={selectedDate}
                subgroup={0}
                onDismiss={onDismiss}
                onSave={onSave}
              />
            </AppDataProvider>
          </ThemeModeDriver>
        </ThemeProvider>,
      );

      expect(
        (screen.getByPlaceholderText('Что нужно сделать к паре...') as HTMLTextAreaElement).value,
      ).toBe('Подготовить отчёт');
    });

    it('LessonCard cancels long-press timer on unmount and resets latch after modal overlay absorbs pointerUp', () => {
      vi.useFakeTimers();
      const onClick = vi.fn();
      const onLongClick = vi.fn();

      const { unmount } = renderWithProviders(
        <LessonCard lesson={SAMPLE_LESSON} onClick={onClick} onLongClick={onLongClick} />,
      );

      const card = screen.getByRole('button', { name: 'РПМ 09:00–10:25' });
      fireEvent.pointerDown(card, { clientX: 10, clientY: 10 });
      unmount();
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(onLongClick).not.toHaveBeenCalled();

      // Now verify latch reset after overlay absorbs pointerUp/click
      renderWithProviders(
        <LessonCard lesson={SAMPLE_LESSON} onClick={onClick} onLongClick={onLongClick} />,
      );
      const card2 = screen.getByRole('button', { name: 'РПМ 09:00–10:25' });
      fireEvent.pointerDown(card2, { clientX: 10, clientY: 10 });
      act(() => {
        vi.advanceTimersByTime(460);
      });
      expect(onLongClick).toHaveBeenCalledTimes(1);

      // Advance past latch auto-reset window (400ms) without pointerUp on card
      act(() => {
        vi.advanceTimersByTime(450);
      });
      fireEvent.click(card2);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('LessonDetailModal hides progressbar for past/future exam dateLesson and handles undefined runtime fields', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 2, 16, 9, 15, 0));

      const pastExam = {
        ...SAMPLE_LESSON,
        lessonType: 'Экзамен',
        dateLesson: '15.01.2026',
        weeks: undefined,
        teacherUrlId: undefined,
        studentGroups: undefined,
      } as unknown as Lesson;

      const { rerender } = renderWithProviders(
        <LessonDetailModal
          lesson={pastExam}
          isToday
          currentGroup="310101"
          employeeSchedules={{}}
          onDismiss={vi.fn()}
          onTeacherClick={vi.fn()}
          onGroupClick={vi.fn()}
          onUpcomingDateClick={vi.fn()}
          onAddNoteClick={vi.fn()}
        />,
      );

      expect(screen.getByText('Разработка программных модулей')).toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

      const malformedRegular = {
        ...SAMPLE_LESSON,
        dateLesson: null,
        weeks: undefined,
        teacherUrlId: undefined,
        studentGroups: undefined,
      } as unknown as Lesson;

      rerender(
        <ThemeProvider>
          <ThemeModeDriver mode="dark">
            <AppDataProvider>
              <LessonDetailModal
                lesson={malformedRegular}
                isToday={false}
                currentGroup="310101"
                employeeSchedules={{}}
                onDismiss={vi.fn()}
                onTeacherClick={vi.fn()}
                onGroupClick={vi.fn()}
                onUpcomingDateClick={vi.fn()}
                onAddNoteClick={vi.fn()}
              />
            </AppDataProvider>
          </ThemeModeDriver>
        </ThemeProvider>,
      );

      expect(screen.getByText('1, 2, 3, 4')).toBeInTheDocument();
    });
  });

  // ==================== F10: ScheduleScreen ====================
  describe('ScheduleScreen (F10)', () => {
    it('loads mock schedule, switches subgroups, searches lecturers into inline teacher view, resets to today, and toggles session mode', async () => {
      function Probe() {
        const { setSessionMode } = useAppData();
        return (
          <div>
            <button type="button" onClick={() => setSessionMode(true)}>
              trigger-session
            </button>
            <ScheduleScreen />
          </div>
        );
      }

      renderWithProviders(<Probe />);

      await waitFor(() => {
        expect(screen.getByText('310101')).toBeInTheDocument();
      });

      // Wait for mock lessons or empty state to settle
      await waitFor(() => {
        expect(screen.getByRole('tablist')).toBeInTheDocument();
      });

      // Subgroup switching
      fireEvent.click(screen.getByRole('tab', { name: '1 подгр.' }));
      expect(screen.getByRole('tab', { name: '1 подгр.' })).toHaveAttribute('aria-selected', 'true');

      // Open group/lecturer search drawer
      fireEvent.click(screen.getByRole('button', { name: /310101/i }));
      const searchInput = screen.getByPlaceholderText('Введите номер группы или преподавателя');
      fireEvent.change(searchInput, { target: { value: 'Смирн' } });

      await waitFor(() => {
        expect(screen.getByText('Подсказки')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/Смирнов Алексей Владимирович/i));

      // Inline teacher view with back bar
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Назад к группе' })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Назад к группе' }));
      await waitFor(() => {
        expect(screen.getByText('310101')).toBeInTheDocument();
      });

      // Date rail day selection + "Сегодня" reset button
      const railButtons = screen.getAllByRole('button', { pressed: false });
      const anotherDayBtn = railButtons.find((b) =>
        /^(ПН|ВТ|СР|ЧТ|ПТ|СБ|ВС) \d+$/i.test(b.getAttribute('aria-label') ?? ''),
      );
      expect(anotherDayBtn).toBeTruthy();
      if (anotherDayBtn) {
        fireEvent.click(anotherDayBtn);
        expect(await screen.findByRole('button', { name: 'Сегодня' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Сегодня' }));
        await waitFor(() => {
          expect(screen.queryByRole('button', { name: 'Сегодня' })).not.toBeInTheDocument();
        });
      }

      // Session mode toggle
      fireEvent.click(screen.getByRole('button', { name: 'trigger-session' }));
      expect(await screen.findByText(/Период сессии:/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Расписание' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Расписание' }));
      await waitFor(() => {
        expect(screen.queryByText(/Период сессии:/i)).not.toBeInTheDocument();
      });
    });

    it('produces 0 BackButton hide/show churn across 5s of 1s ticks while LessonDetailModal is open', async () => {
      const backBtnMock = {
        isVisible: false,
        show: vi.fn(),
        hide: vi.fn(),
        onClick: vi.fn(),
        offClick: vi.fn(),
      };
      window.Telegram = {
        WebApp: {
          ready: vi.fn(),
          expand: vi.fn(),
          BackButton: backBtnMock,
        } as unknown as TelegramWebApp,
      };

      renderWithProviders(<ScheduleScreen />);

      // Wait for mock schedule lessons to render
      const lessonButtons = await screen.findAllByRole('button', { name: /\d{2}:\d{2}–\d{2}:\d{2}/ });
      expect(lessonButtons.length).toBeGreaterThan(0);

      vi.useFakeTimers();
      fireEvent.click(lessonButtons[0]);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      backBtnMock.show.mockClear();
      backBtnMock.hide.mockClear();
      backBtnMock.onClick.mockClear();
      backBtnMock.offClick.mockClear();

      for (let i = 0; i < 5; i += 1) {
        act(() => {
          vi.advanceTimersByTime(1000);
        });
      }

      expect(backBtnMock.show).toHaveBeenCalledTimes(0);
      expect(backBtnMock.hide).toHaveBeenCalledTimes(0);
      expect(backBtnMock.onClick).toHaveBeenCalledTimes(0);
      expect(backBtnMock.offClick).toHaveBeenCalledTimes(0);
    });
  });

  // ==================== F11: MarksScreen ====================
  describe('MarksScreen (F11)', () => {
    it('renders KPI cards, unauth banner when guest, and filters subjects via search & chips', async () => {
      const onBack = vi.fn();
      renderWithProviders(<MarksScreen onBack={onBack} />, { theme: 'light' });

      expect(screen.getByText('Успеваемость')).toBeInTheDocument();
      expect(screen.getByText('Средний балл')).toBeInTheDocument();
      expect(screen.getAllByText('Лабораторные').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Синхронизация с ИИС БГУИР')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Поиск')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Лабораторные' }));
      fireEvent.click(screen.getByRole('button', { name: 'С оценками' }));
      fireEvent.click(screen.getByRole('button', { name: 'Все' }));

      fireEvent.change(screen.getByPlaceholderText('Поиск'), {
        target: { value: 'несуществующий_предмет_xyz' },
      });
      expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('renders authenticated mock marks & lab progress bars in Dark theme', async () => {
      renderWithProviders(
        <AuthHelper>
          <MarksScreen />
        </AuthHelper>,
        { theme: 'dark' },
      );

      await waitFor(() => {
        expect(screen.queryByText('Синхронизация с ИИС БГУИР')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getAllByText(/Лабораторные: \d+ из \d+ сдано/).length).toBeGreaterThan(0);
      });
    });
  });

  // ==================== F12: GradebookScreen ====================
  describe('GradebookScreen (F12)', () => {
    it('shows auth required when unauthenticated and wires onBack + Telegram BackButton', async () => {
      const backBtnMock = {
        isVisible: false,
        show: vi.fn(),
        hide: vi.fn(),
        onClick: vi.fn(),
        offClick: vi.fn(),
      };
      window.Telegram = {
        WebApp: {
          ready: vi.fn(),
          expand: vi.fn(),
          BackButton: backBtnMock,
        } as unknown as TelegramWebApp,
      };

      const onBack = vi.fn();
      renderWithProviders(<GradebookScreen onBack={onBack} />);

      expect(screen.getByText('Зачетка')).toBeInTheDocument();
      expect(screen.getByText('Необходима авторизация')).toBeInTheDocument();
      expect(backBtnMock.show).toHaveBeenCalled();

      // Remain on auth prompt after async mount effects settle (no mock data leak)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 60));
      });
      expect(screen.getByText('Необходима авторизация')).toBeInTheDocument();
      expect(screen.queryByText('Семестр 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Высшая математика')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('renders semesters, color-coded marks (including red "Не зачтено") and semester GPA when authenticated', async () => {
      vi.spyOn(apiClient, 'fetchMarkbook').mockResolvedValue({
        source: 'mock',
        data: {
          averageMark: 8.5,
          markPages: {
            '1': {
              averageMark: 8.5,
              marks: [
                {
                  subject: 'Математика',
                  mark: '9',
                  formOfControl: 'Экзамен',
                  date: '15.01.2026',
                  hours: 100,
                },
                {
                  subject: 'Физика',
                  mark: 'Не зачтено',
                  formOfControl: 'Зачет',
                  date: '12.01.2026',
                  hours: 60,
                },
                {
                  subject: 'История',
                  mark: 'Зачет',
                  formOfControl: 'Зачет',
                  date: '10.01.2026',
                  hours: 36,
                },
              ],
            },
          },
        },
      });

      renderWithProviders(
        <AuthHelper>
          <GradebookScreen />
        </AuthHelper>,
        { theme: 'dark' },
      );

      await waitFor(() => {
        expect(screen.getByText('Семестр 1')).toBeInTheDocument();
      });
      expect(screen.getAllByText('Средний балл').length).toBeGreaterThan(0);

      const notPassedEl = screen.getByText('Не зачтено');
      expect(notPassedEl.style.color).toBe('rgb(244, 67, 54)');
      const passedEl = screen.getByText('Зачет');
      expect(passedEl.style.color).toBe('rgb(76, 195, 138)');
    });
  });

  // ==================== F13: NotesScreen ====================
  describe('NotesScreen (F13)', () => {
    it('supports list/grid toggle, create/edit/delete CRUD, filters, attachments and pickers', async () => {
      renderWithProviders(<NotesScreen initialSubject="Все" />, { theme: 'dark' });

      expect(screen.getByText('Заметки')).toBeInTheDocument();
      expect(screen.getByText('Нет заметок')).toBeInTheDocument();

      // Open Create Note bottom sheet
      fireEvent.click(screen.getByRole('button', { name: 'Создать заметку' }));
      const createDialog = await screen.findByRole('dialog', { name: 'Новая заметка' });

      fireEvent.change(within(createDialog).getByPlaceholderText('Заметка'), {
        target: { value: 'Подготовить ЛР №3\nПроверить графики' },
      });
      fireEvent.click(within(createDialog).getByRole('button', { name: 'ЛР' }));
      fireEvent.click(within(createDialog).getByRole('button', { name: 'Закрепить' }));
      fireEvent.click(within(createDialog).getByRole('button', { name: 'Напомнить' }));

      // Open Date Picker & Time Picker
      fireEvent.click(within(createDialog).getByText(/^\d{2}\.\d{2}\.\d{4}$/));
      const dateDialog = await screen.findByRole('dialog', { name: 'Выберите дату' });
      fireEvent.click(within(dateDialog).getByRole('button', { name: 'Готово' }));

      fireEvent.click(within(createDialog).getByText(/^\d{2}:\d{2}$/));
      const timeDialog = await screen.findByRole('dialog', { name: 'Выберите время' });
      fireEvent.click(within(timeDialog).getByRole('button', { name: 'Готово' }));

      // Attach a mock file
      const fileInput = within(createDialog).getByLabelText('Прикрепить файлы') as HTMLInputElement;
      const sampleFile = new File(['hello'], 'lab3.pdf', { type: 'application/pdf' });
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [sampleFile] } });
      });
      expect(await within(createDialog).findByText('lab3.pdf')).toBeInTheDocument();

      // Save created note
      await act(async () => {
        fireEvent.click(within(createDialog).getByRole('button', { name: 'Сохранить' }));
      });

      expect(await screen.findByText('Подготовить ЛР №3')).toBeInTheDocument();
      expect(screen.getByText(/1 заметка • 1 событие/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'ЛР (1)' })).toBeInTheDocument();

      // Toggle Grid View
      fireEvent.click(screen.getByRole('button', { name: 'Вид' }));

      // Filter via Subject dropdown
      fireEvent.click(screen.getByText('Предмет:'));
      const listbox = await screen.findByRole('listbox', { name: 'Фильтр по предмету' });
      fireEvent.click(within(listbox).getByRole('option', { name: /Закрепленные/i }));
      expect(screen.getByText('Подготовить ЛР №3')).toBeInTheDocument();

      // Edit Note
      fireEvent.click(screen.getByText('Подготовить ЛР №3'));
      const editDialog = await screen.findByRole('dialog', { name: 'Редактировать' });
      fireEvent.change(within(editDialog).getByPlaceholderText('Введите заметку...'), {
        target: { value: 'Обновлённая ЛР №3' },
      });
      await act(async () => {
        fireEvent.click(within(editDialog).getByRole('button', { name: 'Сохранить' }));
      });
      expect(await screen.findByText('Обновлённая ЛР №3')).toBeInTheDocument();

      // Delete Note via accessible delete button + confirm modal
      fireEvent.click(screen.getByRole('button', { name: /Удалить заметку Обновлённая ЛР №3/i }));
      const deleteDialog = await screen.findByRole('dialog', { name: 'Удалить заметку?' });
      await act(async () => {
        fireEvent.click(within(deleteDialog).getByRole('button', { name: 'Удалить' }));
      });

      await waitFor(() => {
        expect(screen.queryByText('Обновлённая ЛР №3')).not.toBeInTheDocument();
      });
      expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();

      // Reset dropdown back to Все предметы -> shows empty "Нет заметок"
      fireEvent.click(screen.getByText('Предмет:'));
      const resetListbox = await screen.findByRole('listbox', { name: 'Фильтр по предмету' });
      fireEvent.click(within(resetListbox).getByRole('option', { name: /Все предметы/i }));
      expect(screen.getByText('Нет заметок')).toBeInTheDocument();
    });

    it('handles BackButton picker priority, double-submit guard, non-schedule subject filter, and pointer-move long-press cancel', async () => {
      let registeredBackHandler: (() => void) | null = null;
      const backBtnMock = {
        isVisible: false,
        show: vi.fn(),
        hide: vi.fn(),
        onClick: vi.fn((cb: () => void) => {
          registeredBackHandler = cb;
        }),
        offClick: vi.fn(),
      };
      window.Telegram = {
        WebApp: {
          ready: vi.fn(),
          expand: vi.fn(),
          BackButton: backBtnMock,
        } as unknown as TelegramWebApp,
      };

      function SeededNotes() {
        const { addNote } = useAppData();
        const seededRef = React.useRef(false);
        React.useEffect(() => {
          if (seededRef.current) return;
          seededRef.current = true;
          void addNote({
            subject: 'СпецКурсXYZ',
            text: 'Изучить конспект',
            date: '20.03.2026',
            time: '10:00',
            isEvent: false,
            isPinned: false,
            lessonType: '',
            attachments: [],
          });
        }, [addNote]);
        return <NotesScreen />;
      }

      renderWithProviders(<SeededNotes />, { theme: 'dark' });

      expect(await screen.findByText('Изучить конспект')).toBeInTheDocument();

      // Non-schedule subject appears in Subject dropdown listbox
      fireEvent.click(screen.getByText('Предмет:'));
      const listbox = await screen.findByRole('listbox', { name: 'Фильтр по предмету' });
      expect(within(listbox).getByRole('option', { name: 'СпецКурсXYZ' })).toBeInTheDocument();
      fireEvent.click(screen.getByText('Предмет:'));

      // Pointer move > 10px cancels long-press delete
      vi.useFakeTimers();
      const noteTextEl = screen.getByText('Изучить конспект');
      fireEvent.pointerDown(noteTextEl, { clientX: 10, clientY: 10 });
      fireEvent.pointerMove(noteTextEl, { clientX: 28, clientY: 10 });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.queryByRole('dialog', { name: 'Удалить заметку?' })).not.toBeInTheDocument();
      vi.useRealTimers();

      // Open Create modal -> open IosDatePickerModal -> BackButton closes picker without closing Create modal
      fireEvent.click(screen.getByRole('button', { name: 'Создать заметку' }));
      const createDialog = await screen.findByRole('dialog', { name: 'Новая заметка' });
      fireEvent.click(within(createDialog).getByText(/^\d{2}\.\d{2}\.\d{4}$/));
      expect(await screen.findByRole('dialog', { name: 'Выберите дату' })).toBeInTheDocument();

      act(() => {
        registeredBackHandler?.();
      });
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Выберите дату' })).not.toBeInTheDocument();
      });
      expect(screen.getByRole('dialog', { name: 'Новая заметка' })).toBeInTheDocument();

      // Rapid double-click on "Сохранить" creates only 1 note
      fireEvent.change(within(createDialog).getByPlaceholderText('Заметка'), {
        target: { value: 'Уникальная заметка' },
      });
      const saveBtn = within(createDialog).getByRole('button', { name: 'Сохранить' });
      await act(async () => {
        fireEvent.click(saveBtn);
        fireEvent.click(saveBtn);
      });

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Новая заметка' })).not.toBeInTheDocument();
      });
      expect(screen.getAllByText('Уникальная заметка')).toHaveLength(1);
    });
  });
});
