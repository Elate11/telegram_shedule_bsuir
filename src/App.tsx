import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  Calendar,
  CheckCircle2,
  Pencil,
  User,
  X,
} from 'lucide-react';
import bsuirGlowImg from './assets/bsuir_logo_glow.png';
import { BsuirIntroSplash } from './components/splash/BsuirIntroSplash';
import {
  AppleRadialMenu,
  AppleTouchChargingAura,
  BottomNavBar,
  DynamicGradientBg,
  LiquidGlassSurface,
  TransitionWrapper,
  useLongPressRadialTrigger,
  type BottomNavItem,
} from './components/ui';
import { AppDataProvider, useAppData } from './context/AppDataContext';
import { useTheme } from './context/ThemeContext';
import { AbsencesScreen } from './screens/AbsencesScreen';
import { AnnouncementsScreen } from './screens/AnnouncementsScreen';
import { CustomizationScreen } from './screens/CustomizationScreen';
import { DormitoryScreen } from './screens/DormitoryScreen';
import { GradebookScreen } from './screens/GradebookScreen';
import { GroupScreen } from './screens/GroupScreen';
import { HeadmanJournalScreen } from './screens/HeadmanJournalScreen';
import { IisResumeScreen } from './screens/IisResumeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { MarksScreen } from './screens/MarksScreen';
import { NotesScreen } from './screens/NotesScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { PenaltiesScreen } from './screens/PenaltiesScreen';
import { ProfileScreen, type ProfileSubScreen } from './screens/ProfileScreen';
import { ScheduleScreen } from './screens/ScheduleScreen';
import { StudyScreen } from './screens/StudyScreen';
import {
  initTelegramApp,
  pushBackHandler,
  triggerHaptic,
} from './services/telegram';
import { calculateReminderTime } from './utils/scheduleMath';

const NAV_ITEMS: BottomNavItem[] = [
  { id: 'schedule', label: 'Расписание', icon: Calendar },
  { id: 'marks', label: 'Оценки', icon: CheckCircle2 },
  { id: 'notes', label: 'Заметки', icon: Pencil },
  { id: 'profile', label: 'Профиль', icon: User },
];

interface ReminderBannerState {
  title: string;
  body: string;
}

const AppShell: React.FC = () => {
  const {
    isDarkTheme,
    tokens,
    bgMode,
    bgBlur,
    bgDim,
    bgImageDataUrl,
    navMode,
    transitionType,
    transitionsEnabled,
    transitionSpeed,
    introEnabled,
    reminderTiming,
    reminderCustomHours,
  } = useTheme();

  const { isLoggedIn, notes } = useAppData();

  const [showSplash, setShowSplash] = useState(introEnabled);
  const [replayKey, setReplayKey] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [tabDir, setTabDir] = useState<1 | -1>(1);
  const [profileSubScreen, setProfileSubScreen] =
    useState<ProfileSubScreen | null>(null);
  const [notesInitialSubject, setNotesInitialSubject] = useState<
    string | undefined
  >(undefined);

  const [radialOpen, setRadialOpen] = useState(false);
  const [radialPos, setRadialPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [reminderBanner, setReminderBanner] =
    useState<ReminderBannerState | null>(null);

  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const firedRemindersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    initTelegramApp();
  }, []);

  const triggerReplayIntro = useCallback(() => {
    setReplayKey((k) => k + 1);
    setShowSplash(true);
  }, []);

  const triggerTestReminder = useCallback(() => {
    const body =
      reminderTiming === 'custom_hours'
        ? `Напоминание сработает за ${reminderCustomHours} ч. до события!`
        : 'Напоминание сработает за выбранное время!';
    triggerHaptic('notification', 'warning');
    setReminderBanner({
      title: 'Событие: Тестовое событие',
      body,
    });
  }, [reminderCustomHours, reminderTiming]);

  useEffect(() => {
    const onReplay = () => triggerReplayIntro();
    const onTestRem = (e: Event) => {
      const detail = (e as CustomEvent<ReminderBannerState>).detail;
      if (detail?.title) {
        setReminderBanner(detail);
      } else {
        triggerTestReminder();
      }
    };
    window.addEventListener('bsuir:replay-intro', onReplay);
    window.addEventListener('bsuir:test-reminder', onTestRem);
    return () => {
      window.removeEventListener('bsuir:replay-intro', onReplay);
      window.removeEventListener('bsuir:test-reminder', onTestRem);
    };
  }, [triggerReplayIntro, triggerTestReminder]);

  useEffect(() => {
    if (!reminderBanner) return;
    const timer = window.setTimeout(() => setReminderBanner(null), 5000);
    return () => window.clearTimeout(timer);
  }, [reminderBanner]);

  // Event reminder checker loop
  useEffect(() => {
    const checkReminders = () => {
      const now = Date.now();
      for (const note of notes) {
        if (!note.isEvent) continue;
        const match = note.date.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (!match) continue;
        const day = Number.parseInt(match[1], 10);
        const month1Based = Number.parseInt(match[2], 10);
        const year = Number.parseInt(match[3], 10);
        const [hour, minute] = (note.time || '09:00')
          .split(':')
          .map((n: string) => Number.parseInt(n, 10) || 0);

        const triggerMs = calculateReminderTime(
          reminderTiming,
          day,
          month1Based - 1,
          year,
          hour,
          minute,
          reminderCustomHours,
        );
        const eventMs = new Date(
          year,
          month1Based - 1,
          day,
          hour,
          minute,
          0,
          0,
        ).getTime();

        const fireKey = `${note.id}:${triggerMs}`;
        if (
          now >= triggerMs &&
          now <= eventMs + 60_000 &&
          !firedRemindersRef.current.has(fireKey)
        ) {
          firedRemindersRef.current.add(fireKey);
          triggerHaptic('notification', 'warning');
          setReminderBanner({
            title: note.subject ? `Событие: ${note.subject}` : 'Напоминание',
            body: note.text,
          });
        }
      }
    };

    checkReminders();
    const interval = window.setInterval(checkReminders, 20_000);
    return () => window.clearInterval(interval);
  }, [notes, reminderCustomHours, reminderTiming]);

  const handleTabSelect = useCallback(
    (nextIndex: number) => {
      if (nextIndex === activeTab) return;
      setTabDir(nextIndex > activeTab ? 1 : -1);
      setActiveTab(nextIndex);
    },
    [activeTab],
  );

  // Telegram BackButton integration
  useEffect(() => {
    if (!isLoggedIn) return undefined;
    if (profileSubScreen !== null) {
      return pushBackHandler(() => setProfileSubScreen(null));
    }
    if (activeTab !== 0) {
      return pushBackHandler(() => handleTabSelect(0));
    }
    return undefined;
  }, [activeTab, handleTabSelect, isLoggedIn, profileSubScreen]);

  // Reset sub-screen on logout
  useEffect(() => {
    if (!isLoggedIn) {
      setProfileSubScreen(null);
      setActiveTab(0);
    }
  }, [isLoggedIn]);

  const longPress = useLongPressRadialTrigger({
    enabled: isLoggedIn && navMode === 'Hold' && profileSubScreen === null,
    onOpen: (pos) => {
      setRadialPos(pos);
      setRadialOpen(true);
    },
  });

  const handleShellPointerDown: React.PointerEventHandler<HTMLDivElement> = (
    e,
  ) => {
    if (!isLoggedIn || navMode !== 'Swipe' || profileSubScreen !== null) return;
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleShellPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (
      !isLoggedIn ||
      navMode !== 'Swipe' ||
      profileSubScreen !== null ||
      !swipeStartRef.current
    ) {
      return;
    }
    const dx = e.clientX - swipeStartRef.current.x;
    const dy = e.clientY - swipeStartRef.current.y;
    swipeStartRef.current = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0 && activeTab < NAV_ITEMS.length - 1) {
        triggerHaptic('selection');
        handleTabSelect(activeTab + 1);
      } else if (dx > 0 && activeTab > 0) {
        triggerHaptic('selection');
        handleTabSelect(activeTab - 1);
      }
    }
  };

  const closeSubScreen = useCallback(() => {
    setProfileSubScreen(null);
  }, []);

  const renderProfileSubScreen = () => {
    switch (profileSubScreen) {
      case 'notifications':
        return <NotificationsScreen onBack={closeSubScreen} />;
      case 'study':
        return <StudyScreen onBack={closeSubScreen} />;
      case 'gradebook':
        return <GradebookScreen onBack={closeSubScreen} />;
      case 'marks':
        return <MarksScreen onBack={closeSubScreen} />;
      case 'group':
        return <GroupScreen onBack={closeSubScreen} />;
      case 'headman':
        return <HeadmanJournalScreen onBack={closeSubScreen} />;
      case 'absences':
        return <AbsencesScreen onBack={closeSubScreen} />;
      case 'resume':
        return <IisResumeScreen onBack={closeSubScreen} />;
      case 'dormitory':
        return <DormitoryScreen initialTab={0} onBack={closeSubScreen} />;
      case 'privileges':
        return <DormitoryScreen initialTab={1} onBack={closeSubScreen} />;
      case 'penalties':
        return <PenaltiesScreen onBack={closeSubScreen} />;
      case 'announcements':
        return <AnnouncementsScreen onBack={closeSubScreen} />;
      case 'customization':
        return (
          <CustomizationScreen
            onBack={closeSubScreen}
            onReplayIntro={triggerReplayIntro}
            onTestReminder={triggerTestReminder}
          />
        );
      default:
        return null;
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 0:
        return (
          <ScheduleScreen
            onOpenNotesForSubject={(subj) => {
              setNotesInitialSubject(subj);
              setProfileSubScreen(null);
              handleTabSelect(2);
            }}
          />
        );
      case 1:
        return <MarksScreen />;
      case 2:
        return <NotesScreen initialSubject={notesInitialSubject} />;
      case 3:
        return <ProfileScreen onNavigate={(sub) => setProfileSubScreen(sub)} />;
      default:
        return null;
    }
  };

  return (
    <div
      className="relative isolate h-full flex flex-col overflow-hidden"
      style={{ color: tokens.text }}
      {...(isLoggedIn && navMode === 'Hold' && profileSubScreen === null
        ? longPress.handlers
        : {})}
    >
      {/* Solid Backdrop */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ backgroundColor: tokens.actualBg }}
      />

      {bgMode === 'Gradient' && (
        <DynamicGradientBg
          accentColor={tokens.accent}
          isDarkTheme={isDarkTheme}
          dimOpacity={bgDim}
          className="fixed inset-0 z-0 pointer-events-none"
        />
      )}

      {bgMode === 'Gallery' && (
        <div
          aria-hidden="true"
          data-testid="gallery-backdrop"
          className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
        >
          <img
            src={bgImageDataUrl ?? bsuirGlowImg}
            alt=""
            className="w-full h-full object-cover"
            style={{
              filter: `blur(${Math.round(bgBlur * 25)}px)`,
              transform: 'scale(1.06)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{ backgroundColor: `rgba(0, 0, 0, ${bgDim})` }}
          />
        </div>
      )}

      {/* Main Content */}
      <div
        className="relative z-10 flex flex-col h-full min-h-0"
        onPointerDown={handleShellPointerDown}
        onPointerUp={handleShellPointerUp}
        onPointerCancel={() => {
          swipeStartRef.current = null;
        }}
      >
        {!isLoggedIn ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            <LoginScreen />
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 relative overflow-hidden">
              <TransitionWrapper
                activeKey={activeTab}
                direction={tabDir}
                transitionType={transitionType}
                transitionsEnabled={transitionsEnabled}
                transitionSpeedMultiplier={transitionSpeed}
                className="h-full"
              >
                {renderTabContent()}
              </TransitionWrapper>

              {/* Profile Sub-Screen Overlay */}
              {profileSubScreen !== null && (
                <div
                  className="absolute inset-0 z-30 flex flex-col overflow-hidden"
                  style={{ backgroundColor: tokens.actualBg }}
                >
                  {renderProfileSubScreen()}
                </div>
              )}
            </div>

            {navMode !== 'Hold' && profileSubScreen === null && (
              <div className="shrink-0 relative z-20 pointer-events-auto">
                <BottomNavBar
                  items={NAV_ITEMS}
                  selectedIndex={activeTab}
                  onSelectIndex={handleTabSelect}
                  accentColor={tokens.accent}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Hold Navigation Aura & Radial Menu */}
      {isLoggedIn && profileSubScreen === null && (
        <>
          <AppleTouchChargingAura
            touchOffset={longPress.touchOffset}
            progress={longPress.chargeProgress}
            isDarkTheme={isDarkTheme}
            accentColor={tokens.accent}
          />

          <AppleRadialMenu
            isOpen={radialOpen}
            onDismiss={() => setRadialOpen(false)}
            items={NAV_ITEMS.map((it, index) => ({
              title: it.label,
              icon: it.icon,
              index,
            }))}
            selectedIndex={activeTab}
            onSelectIndex={handleTabSelect}
            isDarkTheme={isDarkTheme}
            accentColor={tokens.accent}
            touchPosition={radialPos}
          />
        </>
      )}

      {/* In-app Reminder Toast Banner */}
      {reminderBanner && (
        <div
          role="alert"
          className="fixed top-3 left-3 right-3 z-40 max-w-md mx-auto"
        >
          <LiquidGlassSurface
            isDarkTheme={isDarkTheme}
            accentColor={tokens.accent}
            cornerRadius={18}
            className="px-4 py-3 flex items-start gap-3 shadow-lg"
          >
            <Bell
              size={18}
              style={{ color: tokens.accent }}
              className="shrink-0 mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <div
                className="text-s-14 font-bold leading-snug"
                style={{ color: tokens.text }}
              >
                {reminderBanner.title}
              </div>
              <div
                className="text-s-13 mt-0.5 leading-snug"
                style={{ color: tokens.textSecondary }}
              >
                {reminderBanner.body}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReminderBanner(null)}
              aria-label="Закрыть напоминание"
              style={{ color: tokens.textSecondary }}
              className="cursor-pointer shrink-0"
            >
              <X size={16} />
            </button>
          </LiquidGlassSurface>
        </div>
      )}

      {/* Intro Splash Gate */}
      {showSplash && (
        <BsuirIntroSplash
          replayKey={replayKey}
          onFinished={() => setShowSplash(false)}
        />
      )}
    </div>
  );
};

export function App() {
  return (
    <AppDataProvider>
      <AppShell />
    </AppDataProvider>
  );
}

export default App;
