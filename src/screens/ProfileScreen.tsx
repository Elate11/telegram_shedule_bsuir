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
  onNavModeChange,
  transitionType,
  onTransitionChange
}) => {
  const tgUser = tg?.initDataUnsafe?.user
  const [userFio, setUserFio] = useState(() => {
    return tgUser ? `${tgUser.first_name} ${tgUser.last_name || ''}`.trim() : 'Александр'
  })
  const [userGroup] = useState('114001')
  const [userDesc] = useState('ФКП, 4 курс')
  const [showGroupToggle, setShowGroupToggle] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeModal, setActiveModal] = useState<string | null>(null)

  // Subtitle crossfade interval
  useEffect(() => {
    const timer = setInterval(() => {
      setShowGroupToggle(prev => !prev)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await new Promise(r => setTimeout(r, 600))
    setIsRefreshing(false)
  }

  // Profile Rows exact order from Kotlin MinProfileScreen
  const serviceSections = [
    {
      items: [
        { id: 'notif', title: 'Уведомления', icon: Bell, badge: '0 новых' },
        { id: 'study', title: 'Учёба и справки', icon: FileText },
        { id: 'gradebook', title: 'Зачётка', icon: List },
        { id: 'group', title: 'Группа', icon: User, value: userGroup },
        { id: 'omissions', title: 'Пропуски', icon: Calendar, badge: '0 ч' },
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
        className="px-5 pt-4 pb-24"
      >
        {/* 1. Profile Avatar & User Details */}
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-2 border-white/30 p-1 flex items-center justify-center overflow-hidden bg-[#2A2A2C]">
              {tgUser?.photo_url ? (
                <img src={tgUser.photo_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-white">
                  {userFio.charAt(0)}
                </span>
              )}
            </div>
            <div className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#EEEEEE] text-[#111111] shadow-md cursor-pointer">
              <Edit2 className="w-3.5 h-3.5" />
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-white mt-3 text-center tracking-tight">
            {userFio}
          </h2>

          <div className="h-5 mt-1 flex items-center justify-center">
            <span className="text-sm font-normal text-[#86868B] transition-opacity duration-300">
              {showGroupToggle ? `Группа ${userGroup}` : userDesc}
            </span>
          </div>
        </div>

        {/* 2. Apple Profile Sections */}
        <div className="space-y-3.5 mb-6">
          {serviceSections.map((section, sIdx) => (
            <div
              key={sIdx}
              className="rounded-[22px] bg-[#272729] border border-white/[0.08] overflow-hidden"
            >
              {section.items.map((row, rIdx) => {
                const IconComponent = row.icon
                const isLast = rIdx === section.items.length - 1
                return (
                  <div key={row.id}>
                    <button
                      onClick={() => {
                        haptic.click()
                        setActiveModal(row.id)
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 active:bg-white/10 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[#86868B]">
                          <IconComponent className="w-5 h-5 text-zinc-300" />
                        </div>
                        <span className="text-base font-medium text-white">
                          {row.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {row.value && (
                          <span className="text-sm text-[#86868B]">{row.value}</span>
                        )}
                        {row.badge && (
                          <span className="text-xs text-[#86868B]">{row.badge}</span>
                        )}
                        <ChevronRight className="w-4 h-4 text-zinc-500" />
                      </div>
                    </button>
                    {!isLast && (
                      <div className="ml-14 border-b border-white/[0.06]" />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* 3. Red Exit Button */}
        <div className="w-full flex justify-center py-2">
          <button
            onClick={() => {
              haptic.heavy()
              if (tg) tg.close()
            }}
            className="text-base font-medium text-[#FF3B30] hover:opacity-80 active:scale-95"
          >
            Выйти
          </button>
        </div>
      </ApplePullToRefresh>

      {/* Customization Sheet Dialog */}
      <AnimatePresence>
        {activeModal === 'customization' && (
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
                  onClick={() => setActiveModal(null)}
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
      </AnimatePresence>

      {/* Info Dialog for other tabs */}
      <AnimatePresence>
        {activeModal && activeModal !== 'customization' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#272729] border border-white/10 rounded-3xl p-6 shadow-2xl"
            >
              <h3 className="text-lg font-bold text-white mb-2">ИИС БГУИР</h3>
              <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                Синхронизация с серверами университета в режиме реального времени. Все данные привязаны к студенческой группе.
              </p>
              <button
                onClick={() => setActiveModal(null)}
                className="w-full py-2.5 rounded-xl font-bold text-sm bg-white text-black"
                style={{ backgroundColor: accentColor, color: '#fff' }}
              >
                Понятно
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
