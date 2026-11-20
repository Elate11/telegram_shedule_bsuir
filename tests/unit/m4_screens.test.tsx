import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppDataProvider, useAppData } from '../../src/context/AppDataContext';
import { ThemeProvider, useTheme } from '../../src/context/ThemeContext';
import { resetMockStore } from '../../src/services/mockData';
import { _resetTelegramAdaptersForTest } from '../../src/services/telegram';
import { AbsencesScreen } from '../../src/screens/AbsencesScreen';
import { AnnouncementsScreen } from '../../src/screens/AnnouncementsScreen';
import { CustomizationScreen } from '../../src/screens/CustomizationScreen';
import { DormitoryScreen } from '../../src/screens/DormitoryScreen';
import { GroupScreen } from '../../src/screens/GroupScreen';
import { HeadmanJournalScreen } from '../../src/screens/HeadmanJournalScreen';
import { IisResumeScreen } from '../../src/screens/IisResumeScreen';
import { NotificationsScreen } from '../../src/screens/NotificationsScreen';
import { PenaltiesScreen } from '../../src/screens/PenaltiesScreen';
import { ProfileScreen, type ProfileSubScreen } from '../../src/screens/ProfileScreen';
import { StudyScreen } from '../../src/screens/StudyScreen';

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ThemeProvider>
      <AppDataProvider>{ui}</AppDataProvider>
    </ThemeProvider>,
  );
}

const AuthBootWrapper: React.FC<{
  mode?: 'auth' | 'guest';
  children: React.ReactNode;
}> = ({ mode = 'auth', children }) => {
  const { authMode, login, loginAsGuest } = useAppData();
  const bootedRef = React.useRef(false);

  React.useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    if (mode === 'auth') {
      void login('31010103', 'secret');
    } else {
      void loginAsGuest();
    }
  }, [login, loginAsGuest, mode]);

  if (authMode === 'logged_out') {
    return <div data-testid="booting">booting</div>;
  }
  return <>{children}</>;
};

describe('M4 Screens Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetMockStore();
    _resetTelegramAdaptersForTest();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Offline in unit test')),
    );
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    // Stub canvas context + toDataURL in jsdom for ORVI signature tests
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    HTMLCanvasElement.prototype.toDataURL = vi
      .fn()
      .mockReturnValue('data:image/png;base64,QUJD');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ProfileScreen renders FIO, headman badge/row when authenticated, navigates to sub-screens, and hides headman row for guest', async () => {
    const onNavigate = vi.fn<(screen: ProfileSubScreen) => void>();

    const { unmount } = renderWithProviders(
      <AuthBootWrapper mode="auth">
        <ProfileScreen onNavigate={onNavigate} />
      </AuthBootWrapper>,
    );

    expect(await screen.findByText('Соколов Артём Дмитриевич')).toBeInTheDocument();
    expect(screen.getAllByText('Староста').length).toBeGreaterThan(0);
    expect(screen.getByText('Журнал старосты')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Уведомления'));
    expect(onNavigate).toHaveBeenCalledWith('notifications');

    fireEvent.click(screen.getByText('Льготы'));
    expect(onNavigate).toHaveBeenCalledWith('privileges');

    fireEvent.click(screen.getByText('Кастомизация'));
    expect(onNavigate).toHaveBeenCalledWith('customization');

    unmount();

    renderWithProviders(
      <AuthBootWrapper mode="guest">
        <ProfileScreen onNavigate={onNavigate} />
      </AuthBootWrapper>,
    );

    expect(await screen.findByText('Гость')).toBeInTheDocument();
    expect(screen.queryByText('Журнал старосты')).not.toBeInTheDocument();
  });

  it('NotificationsScreen loads notifications, auto-marks unread read, and filters by type and search', async () => {
    const onBack = vi.fn();
    let unreadAfter = -1;

    const Probe = () => {
      const { notifications } = useAppData();
      unreadAfter = notifications.unreadCount;
      return <NotificationsScreen onBack={onBack} />;
    };

    renderWithProviders(
      <AuthBootWrapper mode="auth">
        <Probe />
      </AuthBootWrapper>,
    );

    expect(await screen.findByText(/Справка «По месту требования»/)).toBeInTheDocument();
    await waitFor(() => {
      expect(unreadAfter).toBe(0);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Важное' }));
    expect(screen.getByText(/2 часа неуважительных пропусков/)).toBeInTheDocument();
    expect(screen.queryByText(/Справка «По месту требования»/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Все' }));
    const searchInput = screen.getByPlaceholderText('Поиск');
    fireEvent.change(searchInput, { target: { value: 'аттестация' } });
    expect(screen.getByText(/Открыта аттестация/)).toBeInTheDocument();
    expect(screen.queryByText(/2 часа неуважительных пропусков/)).not.toBeInTheDocument();
  });

  it('StudyScreen orders/cancels certificates, calculates 5.75 BYN/h mark sheet cost, and triggers ORVI', async () => {
    const onBack = vi.fn();
    const onOpenOrvi = vi.fn();

    renderWithProviders(
      <AuthBootWrapper mode="auth">
        <StudyScreen onBack={onBack} onOpenOrvi={onOpenOrvi} />
      </AuthBootWrapper>,
    );

    expect(await screen.findByText('Справка №4421')).toBeInTheDocument();
    expect(screen.getByText('Справка №4488')).toBeInTheDocument();

    // Order new certificate
    fireEvent.click(screen.getByText('+ Заказать справку'));
    const customPlaceInput = screen.getByPlaceholderText(/по месту работы матери/i);
    fireEvent.change(customPlaceInput, { target: { value: 'В деканат ФКП' } });
    fireEvent.click(screen.getByRole('button', { name: 'Заказать' }));

    expect(await screen.findByText('Куда: В деканат ФКП')).toBeInTheDocument();

    // Cancel an in-processing certificate
    const cancelButtons = screen.getAllByText('Отменить заявку');
    fireEvent.click(cancelButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Заявка отменена')).toBeInTheDocument();
    });

    // Switch to Mark Sheets tab
    fireEvent.click(screen.getByRole('button', { name: /Ведомости/ }));
    expect(screen.getByText('РПМ (ЛР)')).toBeInTheDocument();

    // Open Create Mark Sheet modal & check 5.75 BYN/h live calc
    fireEvent.click(screen.getByText('+ Заказать ведомость'));
    const reasonToggle = screen.getByLabelText('Уважительная причина');
    expect(screen.getByText(/Бесплатно/)).toBeInTheDocument();
    fireEvent.click(reasonToggle); // uncheck -> 2h * 5.75 = 11.50 BYN
    expect(screen.getAllByText('11.50 BYN').length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole('button', { name: '4 ч' }));
    expect(screen.getByText('23.00 BYN')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Заказать' }));
    expect(await screen.findByText('Заявка на ведомость отправлена')).toBeInTheDocument();

    // Revoke mark sheet
    const revokeBtns = screen.getAllByText('Отозвать заявку');
    fireEvent.click(revokeBtns[0]);
    await waitFor(() => {
      expect(screen.getByText('Ведомость отозвана')).toBeInTheDocument();
    });

    // ORVI trigger on tab 0
    fireEvent.click(screen.getByRole('button', { name: /Справки/ }));
    fireEvent.click(screen.getByText('Подать заявку на ОРВИ'));
    expect(onOpenOrvi).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Оформление заявления по ОРВИ')).toBeInTheDocument();
  });

  it('AbsencesScreen renders KPIs, filters by monthly bar chart, signs ORVI canvas, and handles 409 monthly limit', async () => {
    const onBack = vi.fn();

    renderWithProviders(
      <AuthBootWrapper mode="auth">
        <AbsencesScreen onBack={onBack} />
      </AuthBootWrapper>,
    );

    expect(await screen.findByText('10 ч')).toBeInTheDocument();
    expect(screen.getByText('За этот месяц')).toBeInTheDocument();
    expect(screen.getByText('8 ч')).toBeInTheDocument();
    expect(screen.getAllByText('2 ч').length).toBeGreaterThanOrEqual(1);

    // Filter by month Сен
    fireEvent.click(screen.getByRole('button', { name: 'Месяц Сен' }));
    expect(screen.getByText('Пропуски за Сен')).toBeInTheDocument();
    expect(screen.queryByText('КС')).not.toBeInTheDocument();

    // Toggle back to clear filter
    fireEvent.click(screen.getByRole('button', { name: 'Месяц Сен' }));
    expect(screen.getByText('Детализация пропущенных занятий')).toBeInTheDocument();

    // Open ORVI modal & check permanent address auto-fill
    fireEvent.click(screen.getByText('Подать заявку на ОРВИ'));
    const addressInput = await screen.findByPlaceholderText(/Республика Беларусь/);
    await waitFor(() => {
      expect((addressInput as HTMLInputElement).value).toContain('Минск');
    });

    // Open signature canvas, draw stroke, save signature
    fireEvent.click(screen.getByText('Нажмите, чтобы расписаться на весь экран'));
    const canvas = screen.getByTestId('signature-canvas');
    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 120, clientY: 90, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 120, clientY: 90, pointerId: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить подпись' }));
    expect(screen.getByText('Нажмите для изменения')).toBeInTheDocument();

    // Submit ORVI (today..today+4 = 5 days -> succeeds on 1st submit, hits 409 limit on 2nd)
    fireEvent.click(screen.getByRole('button', { name: 'Отправить заявку' }));
    await waitFor(() => {
      expect(screen.getByText(/успешно отправлен/i)).toBeInTheDocument();
    });

    // Second 5-day submission in same month must trigger 409 limit message
    fireEvent.click(screen.getByText('Подать заявку на ОРВИ'));
    fireEvent.click(screen.getByText('Нажмите, чтобы расписаться на весь экран'));
    const canvas2 = screen.getByTestId('signature-canvas');
    fireEvent.pointerDown(canvas2, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(canvas2, { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить подпись' }));
    fireEvent.click(screen.getByRole('button', { name: 'Отправить заявку' }));

    expect(
      await screen.findByText(/Вы превысили лимит дней на заявление студента/i),
    ).toBeInTheDocument();
  });

  it('GroupScreen renders curator links, ВЫ badge, role badges, and filters roster', async () => {
    renderWithProviders(
      <AuthBootWrapper mode="auth">
        <GroupScreen onBack={vi.fn()} />
      </AuthBootWrapper>,
    );

    expect(await screen.findByText('Куратор группы')).toBeInTheDocument();
    expect(screen.getByText(/\+375 \(29\) 123-45-67/)).toBeInTheDocument();
    expect(screen.getByText('ВЫ')).toBeInTheDocument();
    expect(screen.getByText('Студентов в группе: 12')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Поиск'), {
      target: { value: 'Волкова' },
    });
    expect(screen.getByText('Студентов в группе: 1 (из 12)')).toBeInTheDocument();
  });

  it('HeadmanJournalScreen clamps steppers 0..maxHours and persists saved attendance including zeroing', async () => {
    renderWithProviders(
      <AuthBootWrapper mode="auth">
        <HeadmanJournalScreen onBack={vi.fn()} />
      </AuthBootWrapper>,
    );

    expect(await screen.findByText('РПМ (ЛР)')).toBeInTheDocument();
    expect(await screen.findByText('20.10.2025 • п/г 1')).toBeInTheDocument();
    expect(screen.getByText('Волкова Дарья Андреевна')).toBeInTheDocument();

    const incBtn = screen.getByLabelText(
      'Увеличить пропуск для Волкова Дарья Андреевна',
    );
    fireEvent.click(incBtn);
    fireEvent.click(incBtn);
    fireEvent.click(incBtn); // clamped at maxHours=2
    expect(screen.getAllByText('Пропуск: 2 ч').length).toBeGreaterThanOrEqual(1);

    fireEvent.click(
      screen.getByRole('button', { name: 'Сохранить ведомость посещаемости' }),
    );
    expect(
      await screen.findByText(/Отметки посещаемости сохранены|Пропуски сохранены/i),
    ).toBeInTheDocument();

    // Decrement back to 0 and save
    const decBtn = screen.getByLabelText(
      'Уменьшить пропуск для Волкова Дарья Андреевна',
    );
    fireEvent.click(decBtn);
    fireEvent.click(decBtn);
    expect(screen.queryByText('Пропуск: 2 ч')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Сохранить ведомость посещаемости' }),
    );
    expect(
      await screen.findByText(/Отметки посещаемости сохранены|Пропуски сохранены/i),
    ).toBeInTheDocument();
  });

  it('DormitoryScreen respects initialTab and switches between Заявки and Льготы', async () => {
    renderWithProviders(
      <AuthBootWrapper mode="auth">
        <DormitoryScreen onBack={vi.fn()} initialTab={1} />
      </AuthBootWrapper>,
    );

    expect(await screen.findByText('Учебная и научная деятельность')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Заявки/ }));
    expect(screen.getByText(/Общежитие №2/)).toBeInTheDocument();
  });

  it('PenaltiesScreen renders directives without double №№', async () => {
    renderWithProviders(
      <AuthBootWrapper mode="auth">
        <PenaltiesScreen onBack={vi.fn()} />
      </AuthBootWrapper>,
    );

    expect(
      await screen.findByText('Активное участие в жизни факультета и научная работа'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Приказ № 312-с/)).toBeInTheDocument();
    expect(screen.queryByText(/№№/)).not.toBeInTheDocument();
  });

  it('AnnouncementsScreen renders announcements feed', async () => {
    renderWithProviders(
      <AuthBootWrapper mode="auth">
        <AnnouncementsScreen onBack={vi.fn()} />
      </AuthBootWrapper>,
    );

    expect(
      await screen.findByText('График пересдач осенней промежуточной аттестации'),
    ).toBeInTheDocument();
  });

  it('IisResumeScreen supports widget day preview, CV switches, skills & links add/delete, and Outlook copy', async () => {
    renderWithProviders(
      <AuthBootWrapper mode="auth">
        <IisResumeScreen onBack={vi.fn()} />
      </AuthBootWrapper>,
    );

    expect(await screen.findByText('Виджет расписания')).toBeInTheDocument();
    expect(screen.getByText(/Сегодня,/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Следующий день виджета'));
    expect(screen.getByText(/Завтра,/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Предыдущий день виджета'));
    expect(screen.getByText(/Сегодня,/)).toBeInTheDocument();

    // Copy iCal URL
    fireEvent.click(screen.getByLabelText('Скопировать ссылку iCal'));
    expect(await screen.findByText('Ссылка iCal скопирована')).toBeInTheDocument();

    // Toggle CV switch
    const publishToggle = screen.getByLabelText('Профиль опубликован') as HTMLInputElement;
    expect(publishToggle.checked).toBe(true);
    fireEvent.click(publishToggle);
    await waitFor(() => {
      expect(publishToggle.checked).toBe(false);
    });

    // Add & delete skill
    const addButtons = screen.getAllByRole('button', { name: /^Добавить$/ });
    fireEvent.click(addButtons[0]);
    fireEvent.change(screen.getByPlaceholderText(/Kotlin, Python, Docker/), {
      target: { value: 'Docker' },
    });
    const modalAddButtons = screen.getAllByRole('button', { name: /^Добавить$/ });
    fireEvent.click(modalAddButtons[modalAddButtons.length - 1]);
    expect(await screen.findByText('Docker')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Удалить навык Docker'));
    await waitFor(() => {
      expect(screen.queryByText('Docker')).not.toBeInTheDocument();
    });

    // Add & delete link
    const addButtonsAfter = screen.getAllByRole('button', { name: /^Добавить$/ });
    fireEvent.click(addButtonsAfter[1]);
    fireEvent.change(screen.getByPlaceholderText(/GitHub, Telegram/), {
      target: { value: 'Telegram' },
    });
    fireEvent.change(screen.getByPlaceholderText('https://...'), {
      target: { value: 'https://t.me/bsuir' },
    });
    const modalRefAddButtons = screen.getAllByRole('button', { name: /^Добавить$/ });
    fireEvent.click(modalRefAddButtons[modalRefAddButtons.length - 1]);
    expect(await screen.findByText('Telegram')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Удалить ссылку Telegram'));
    await waitFor(() => {
      expect(screen.queryByText('Telegram')).not.toBeInTheDocument();
    });

    // Copy Outlook login
    fireEvent.click(screen.getByText(/Логин: 31010103@study\.bsuir\.by/));
    expect(await screen.findByText('Логин скопирован')).toBeInTheDocument();
  });

  it('CustomizationScreen supports Dark/Light switching (zero Techno), palettes, reminders, replay intro, and offline toggle', async () => {
    const onReplayIntro = vi.fn();
    const onTestReminder = vi.fn();
    let currentThemeMode = '';
    let currentOffline = false;

    const Probe = () => {
      const theme = useTheme();
      const app = useAppData();
      currentThemeMode = theme.themeMode;
      currentOffline = app.forceOffline;
      return (
        <CustomizationScreen
          onBack={vi.fn()}
          onReplayIntro={onReplayIntro}
          onTestReminder={onTestReminder}
        />
      );
    };

    renderWithProviders(
      <AuthBootWrapper mode="auth">
        <Probe />
      </AuthBootWrapper>,
    );

    expect(await screen.findByText('Кастомизация')).toBeInTheDocument();
    expect(screen.queryByText(/techno|техно/i)).not.toBeInTheDocument();

    // Switch to Light theme
    fireEvent.click(screen.getByRole('tab', { name: 'Светлая' }));
    expect(currentThemeMode).toBe('light');

    // Save custom palette & remove it
    fireEvent.click(screen.getByLabelText('Сохранить текущую палитру'));
    const removePaletteBtn = screen.getByLabelText(/Удалить палитру/);
    expect(removePaletteBtn).toBeInTheDocument();
    fireEvent.click(removePaletteBtn);
    expect(screen.queryByLabelText(/Удалить палитру/)).not.toBeInTheDocument();

    // Custom reminder hours + test notification
    fireEvent.click(screen.getByRole('button', { name: 'Свой вариант' }));
    fireEvent.click(screen.getByLabelText('Увеличить часы напоминания'));
    expect(screen.getByText('4 ч.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Проверить уведомление' }));
    expect(onTestReminder).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(/Напоминание сработает за 4 ч\. до события!/),
    ).toBeInTheDocument();

    // Replay intro
    fireEvent.click(screen.getByRole('button', { name: 'Посмотреть интро' }));
    expect(onReplayIntro).toHaveBeenCalledTimes(1);

    // Offline toggle
    const offlineToggle = screen.getByLabelText('Оффлайн / Демо-режим');
    await act(async () => {
      fireEvent.click(offlineToggle);
    });
    expect(currentOffline).toBe(true);
  });
});
