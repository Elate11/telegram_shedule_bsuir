import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  FileText,
  List,
  User,
  Calendar,
  BadgeAlert,
  Home,
  Star,
  AlertTriangle,
  Info,
  Settings,
  ChevronRight,
  LogOut,
  Edit2
} from 'lucide-react'
import { haptic, tg } from '../services/telegram'
import { ApplePullToRefresh } from '../components/ApplePullToRefresh'
import { bsuirApi, type StudentProfileData } from '../services/bsuirApi'
import { StudyScreen } from './StudyScreen'
import { AbsencesScreen } from './AbsencesScreen'
import { GroupScreen } from './GroupScreen'
import { GradebookScreen } from './GradebookScreen'
import { NotificationsScreen } from './NotificationsScreen'
import { DormitoryScreen } from './DormitoryScreen'
import { PenaltiesScreen } from './PenaltiesScreen'
import { AnnouncementsScreen } from './AnnouncementsScreen'
import { IisResumeScreen } from './IisResumeScreen'
import { LoginModal } from './LoginModal'
import { LogIn } from 'lucide-react'
import type { StyleType, NavigationMode, TransitionType } from '../types'

interface ProfileScreenProps {
  isDarkTheme: boolean
  onToggleTheme: () => void
  accentColor: string
  onAccentChange: (color: string) => void
  styleType: StyleType
  onStyleChange: (style: StyleType) => void
  navMode: NavigationMode
  onNavModeChange: (mode: NavigationMode) => void
  transitionType: TransitionType
  onTransitionChange: (trans: TransitionType) => void
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  isDarkTheme,
  accentColor,
  onAccentChange,
  styleType,
  onStyleChange,
  navMode,
  onNavModeChange
}) => {
  const tgUser = tg?.initDataUnsafe?.user
  const [profile, setProfile] = useState<StudentProfileData>(() => ({
    fio: localStorage.getItem('app_user_fio') || (tgUser ? `${tgUser.first_name} ${tgUser.last_name || ''}`.trim() : 'Сороколетов Александр Александрович'),
    group: localStorage.getItem('app_selected_group') || '510902',
    faculty: localStorage.getItem('app_user_faculty') || 'ФКП',
    course: parseInt(localStorage.getItem('app_user_course') || '2', 10),
    desc: localStorage.getItem('app_user_desc') || 'ФКП ПИ (ИПОИТ) 2 курс',
    unexcusedHours: parseInt(localStorage.getItem('app_unexcused_hours') || '0', 10),
    unreadNotifs: parseInt(localStorage.getItem('app_unread_notifs') || '0', 10),
    isHeadman: localStorage.getItem('app_is_headman') === 'true'
  }))

  const [showGroupToggle, setShowGroupToggle] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeSubScreen, setActiveSubScreen] = useState<string | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const isLoggedIn = Boolean(localStorage.getItem('app_auth_token'))

  // Subtitle crossfade interval (4000ms, identical to Kotlin lines 9480-9490)
  useEffect(() => {
    const timer = setInterval(() => {
      setShowGroupToggle(prev => !prev)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  // Live profile fetch from BSUIR API on mount
  useEffect(() => {
    bsuirApi.fetchStudentProfile().then(res => {
      if (res) setProfile(res)
    }).catch(() => {})
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const updated = await bsuirApi.fetchStudentProfile()
      if (updated) setProfile(updated)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Profile Sections matching Kotlin MinProfileScreen lines 9980-10040
  const serviceSections = [
    {
      items: [
        {
          id: 'notif',
          title: 'Уведомления',
          icon: Bell,
          badge: profile.unreadNotifs > 0 ? `${profile.unreadNotifs} новых` : undefined
        },
        { id: 'study', title: 'Учёба и справки', icon: FileText },
        { id: 'gradebook', title: 'Зачётка', icon: List },
        { id: 'group', title: 'Группа', icon: User, value: profile.group },
        ...(profile.isHeadman ? [{ id: 'headman', title: 'Журнал старосты', icon: List }] : []),
        {
          id: 'absences',
          title: 'Пропуски',
          icon: Calendar,
          badge: profile.unexcusedHours > 0 ? `${profile.unexcusedHours} ч` : undefined
        },
      ]
    },
    {
      items: [
        { id: 'resume', title: 'Резюме и виджет ИИС', icon: BadgeAlert },
        { id: 'dormitory', title: 'Общежитие', icon: Home },
        { id: 'benefits', title: 'Льготы', icon: Star },
        { id: 'penalties', title: 'Взыскания и поощрения', icon: AlertTriangle },
        { id: 'announcements', title: 'Объявления', icon: Info },
      ]
    },
    {
      items: [
        { id: 'customization', title: 'Кастомизация', icon: Settings },
      ]
    }
  ]

  const paletteColors = [
    '#0066CC', // Apple Action Blue
    '#2997FF', // Sky Link Blue
    '#30D158', // Spring Green
    '#FF375F', // Rose Red
    '#FF9F0A', // Amber
    '#BF5AF2', // Deep Purple
    '#00FF41'  // Techno Cyber Neon
  ]

  return (
    <div className="h-full w-full overflow-hidden select-none">
      <ApplePullToRefresh
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        accentColor={accentColor}
        className="px-6 pt-6 pb-28"
      >
        {/* 1. Profile Avatar & User Details (100% Kotlin lines 9890-9970) */}
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="relative">
            <div className="w-[108px] h-[108px] rounded-full border-2 border-white/35 p-[5px] flex items-center justify-center overflow-hidden bg-[#272729]">
              {profile.photoUrl ? (
                <img src={profile.photoUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
              ) : tgUser?.photo_url ? (
                <img src={tgUser.photo_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
              ) : (
                <img
                  src="/avatar.png"
                  alt="Avatar"
                  className="w-full h-full rounded-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none'
                  }}
                />
              )}
            </div>
            {/* Edit pencil icon chip bottom-right */}
            <label
              htmlFor="avatar-upload"
              className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[#EEEEEE] flex items-center justify-center shadow-md cursor-pointer active:scale-90 transition-transform"
            >
              <Edit2 className="w-4 h-4 text-[#111111]" />
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    const reader = new FileReader()
                    reader.onload = () => {
                      const base64 = reader.result as string
                      localStorage.setItem('app_user_photo', base64)
                      setProfile(prev => ({ ...prev, photoUrl: base64 }))
                      haptic.click()
                    }
                    reader.readAsDataURL(file)
                  }
                }}
              />
            </label>
          </div>

          {/* FIO matching screen_profile_open.png */}
          <h2 className="text-2xl font-semibold text-white text-center mt-3.5 leading-snug max-w-[280px]">
            {profile.fio}
          </h2>

          {/* Subtitle crossfade: group vs faculty/course */}
          <div className="h-5 mt-1 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.span
                key={showGroupToggle ? 'group' : 'desc'}
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -2 }}
                transition={{ duration: 0.3 }}
                className="text-sm font-normal text-[#86868B] text-center"
              >
                {showGroupToggle ? `Группа ${profile.group}` : profile.desc}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* 2. Absences Card Pill matching screen_profile_open.png */}
        <div
          onClick={() => {
            haptic.click()
            setActiveSubScreen('absences')
          }}
          className="w-full bg-[#272729] rounded-[22px] p-4 mb-4 flex flex-col items-center justify-center cursor-pointer active:opacity-85 transition-opacity border border-white/[0.08]"
        >
          <span className="text-[17px] font-bold text-[#86868B]">
            Пропуски (ч)
          </span>
          <span className="text-[29px] font-semibold text-white mt-1">
            {profile.unexcusedHours} ч
          </span>
        </div>

        {/* 3. Rounded Sections with ProfileRow items (Kotlin lines 9980-10040) */}
        <div className="space-y-3.5 mb-6">
          {serviceSections.map((sec, secIdx) => (
            <div
              key={secIdx}
              className="rounded-[22px] bg-[#272729] border border-white/[0.08] overflow-hidden"
            >
              {sec.items.map((item, itemIdx) => {
                const IconComponent = item.icon
                const isLast = itemIdx === sec.items.length - 1
                return (
                  <div key={item.id}>
                    <button
                      onClick={() => {
                        haptic.click()
                        setActiveSubScreen(item.id)
                      }}
                      className="w-full min-h-[52px] px-4 py-2 flex items-center justify-between hover:bg-white/5 active:bg-white/10 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 flex items-center justify-center text-[#86868B]">
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <span className="text-base font-medium text-white">
                          {item.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.value && (
                          <span className="text-[15px] text-[#86868B]">
                            {item.value}
                          </span>
                        )}
                        {item.badge && (
                          <span className="text-[15px] font-medium text-[#2997FF]">
                            {item.badge}
                          </span>
                        )}
                        <ChevronRight className="w-5 h-5 text-[#86868B]/50" />
                      </div>
                    </button>
                    {!isLast && (
                      <div className="ml-16 h-[0.5px] bg-white/[0.12]" />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* 4. Footer buttons: Войти / Выйти and GitHub link */}
        <div className="flex flex-col items-center justify-center pb-6">
          {!isLoggedIn ? (
            <button
              onClick={() => {
                haptic.click()
                setShowLoginModal(true)
              }}
              className="flex items-center gap-2 text-base font-semibold text-white py-3 px-6 rounded-2xl bg-white/10 hover:bg-white/15 active:scale-95 transition-all mb-2"
            >
              <LogIn className="w-4 h-4 text-[#2997FF]" />
              <span>Войти в личный кабинет ИИС</span>
            </button>
          ) : (
            <button
              onClick={() => {
                haptic.click()
                localStorage.removeItem('app_auth_token')
                localStorage.removeItem('app_network_cookies')
                localStorage.removeItem('saved_password')
                localStorage.removeItem('gradebook_number')
                window.location.reload()
              }}
              className="text-base font-medium text-[#FF3B30] py-3.5 px-6 active:opacity-70 transition-opacity"
            >
              Выйти
            </button>
          )}
          <a
            href="https://github.com/Elate11/telegram_shedule_bsuir"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => haptic.click()}
            className="text-[13px] font-medium text-[#86868B] p-2 hover:text-white transition-colors"
          >
            GitHub
          </a>
        </div>
      </ApplePullToRefresh>

      {/* Subscreens Modals */}
      <AnimatePresence>
        {activeSubScreen === 'notif' && (
          <NotificationsScreen onBack={() => setActiveSubScreen(null)} accentColor={accentColor} />
        )}
        {activeSubScreen === 'study' && (
          <StudyScreen onBack={() => setActiveSubScreen(null)} accentColor={accentColor} />
        )}
        {activeSubScreen === 'gradebook' && (
          <GradebookScreen onBack={() => setActiveSubScreen(null)} accentColor={accentColor} />
        )}
        {activeSubScreen === 'group' && (
          <GroupScreen
            onBack={() => setActiveSubScreen(null)}
            currentGroup={profile.group}
            accentColor={accentColor}
          />
        )}
        {activeSubScreen === 'absences' && (
          <AbsencesScreen onBack={() => setActiveSubScreen(null)} accentColor={accentColor} />
        )}
        {activeSubScreen === 'dormitory' && (
          <DormitoryScreen onBack={() => setActiveSubScreen(null)} accentColor={accentColor} />
        )}
        {activeSubScreen === 'penalties' && (
          <PenaltiesScreen onBack={() => setActiveSubScreen(null)} accentColor={accentColor} />
        )}
        {activeSubScreen === 'announcements' && (
          <AnnouncementsScreen onBack={() => setActiveSubScreen(null)} accentColor={accentColor} />
        )}
        {activeSubScreen === 'resume' && (
          <IisResumeScreen onBack={() => setActiveSubScreen(null)} accentColor={accentColor} />
        )}

        {/* Customization Screen */}
        {activeSubScreen === 'customization' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#272729] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Кастомизация</h3>
                <button
                  onClick={() => setActiveSubScreen(null)}
                  className="px-3 py-1 rounded-lg bg-white/10 text-xs text-white"
                >
                  Готово
                </button>
              </div>

              {/* Style Type */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
                  Стиль
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      haptic.click()
                      onStyleChange('Minimal')
                    }}
                    className={`p-3 rounded-2xl border text-sm font-semibold ${
                      styleType === 'Minimal'
                        ? 'bg-white/10 border-white text-white'
                        : 'bg-black/30 border-white/5 text-zinc-400'
                    }`}
                  >
                    Apple Minimal
                  </button>
                  <button
                    onClick={() => {
                      haptic.click()
                      onStyleChange('Techno')
                    }}
                    className={`p-3 rounded-2xl border text-sm font-mono font-semibold ${
                      styleType === 'Techno'
                        ? 'bg-[#00FF41]/10 border-[#00FF41] text-[#00FF41]'
                        : 'bg-black/30 border-white/5 text-zinc-400'
                    }`}
                  >
                    Cyber Techno
                  </button>
                </div>
              </div>

              {/* Color Accents */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
                  Акцентный цвет
                </label>
                <div className="flex items-center justify-between p-2 rounded-2xl bg-black/30 border border-white/5">
                  {paletteColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        haptic.click()
                        onAccentChange(color)
                      }}
                      className="w-8 h-8 rounded-full border-2 transition-transform active:scale-90"
                      style={{
                        backgroundColor: color,
                        borderColor: accentColor === color ? '#ffffff' : 'transparent',
                        transform: accentColor === color ? 'scale(1.15)' : 'scale(1)'
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Nav mode */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
                  Навигация
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Buttons', 'Swipe'] as NavigationMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        haptic.click()
                        onNavModeChange(m)
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-medium border ${
                        navMode === m
                          ? 'bg-white/10 border-white text-white'
                          : 'bg-black/30 border-white/5 text-zinc-400'
                      }`}
                    >
                      {m === 'Buttons' ? 'Кнопки снизу' : 'Полноэкранный свайп'}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} onSuccess={() => handleRefresh()} accentColor={accentColor} />
      </AnimatePresence>
    </div>
  )
}
