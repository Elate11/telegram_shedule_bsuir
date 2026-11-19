import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Settings,
  Moon,
  Sun,
  Palette,
  Shield,
  FileText,
  Bell,
  Home,
  CheckSquare,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  LogOut,
  Sparkles
} from 'lucide-react'
import { haptic, tg } from '../services/telegram'
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
  onToggleTheme,
  accentColor,
  onAccentChange,
  styleType,
  onStyleChange,
  navMode,
  onNavModeChange,
  transitionType,
  onTransitionChange
}) => {
  // Telegram user data if opened inside TG WebApp
  const tgUser = tg?.initDataUnsafe?.user
  const userFio = tgUser ? `${tgUser.first_name} ${tgUser.last_name || ''}`.trim() : 'Александр'
  const userGroup = '114001'
  const userPhoto = tgUser?.photo_url || null

  const [activeModal, setActiveModal] = useState<string | null>(null)

  const paletteColors = [
    '#6C63FF', // Classic Apple Action / Indigo
    '#2997FF', // Sky Link Blue
    '#30D158', // Spring Green
    '#FF375F', // Rose Red
    '#FF9F0A', // Amber Orange
    '#BF5AF2', // Deep Purple
    '#00FF41'  // Techno Cyber Neon
  ]

  const serviceRows = [
    { id: 'certificates', title: 'Справки об обучении', icon: FileText, desc: 'Заказ и получение электронных справок' },
    { id: 'absences', title: 'Пропуски и справки', icon: CheckSquare, desc: 'Уважительные и неуважительные часы' },
    { id: 'dormitory', title: 'Общежитие и льготы', icon: Home, desc: 'Очередь и статус заселения' },
    { id: 'notifications', title: 'Уведомления деканата', icon: Bell, desc: 'Официальные извещения' },
    { id: 'customization', title: 'Оформление и темы', icon: Palette, desc: 'Цвета, стиль, анимации' },
    { id: 'settings', title: 'Настройки навигации', icon: Settings, desc: 'Режим навигации и жесты' },
  ]

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto px-6 pt-4 pb-24">
      {/* Header Profile Card */}
      <div className="flex flex-col items-center justify-center p-6 rounded-3xl bg-zinc-900/60 border border-white/10 backdrop-blur-xl mb-6 shadow-xl relative overflow-hidden">
        {/* Avatar with Glow */}
        <div className="relative mb-3">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden border-2 shadow-inner"
            style={{ borderColor: accentColor }}
          >
            {userPhoto ? (
              <img src={userPhoto} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-white font-black text-2xl"
                style={{ backgroundColor: `${accentColor}40` }}
              >
                {userFio.charAt(0)}
              </div>
            )}
          </div>
          <div
            className="absolute -bottom-1 -right-1 p-1 rounded-full bg-zinc-900 border border-white/20 text-white"
            style={{ color: accentColor }}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* FIO & Group */}
        <h2 className="text-xl font-bold text-white tracking-tight text-center">
          {userFio}
        </h2>
        <p className="text-xs font-semibold text-zinc-400 mt-0.5">
          Группа {userGroup} • БГУИР
        </p>

        {/* Quick Badges */}
        <div className="flex items-center gap-2 mt-4">
          <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-white/5 border border-white/10 text-zinc-300">
            Студент
          </span>
          <span
            className="px-3 py-1 rounded-full text-[11px] font-bold border"
            style={{
              backgroundColor: `${accentColor}15`,
              borderColor: `${accentColor}30`,
              color: accentColor
            }}
          >
            Telegram Mini App
          </span>
        </div>
      </div>

      {/* Services Section */}
      <div className="space-y-2 mb-6">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
          Сервисы и функции
        </h3>
        {serviceRows.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => {
                haptic.click()
                setActiveModal(item.id)
              }}
              className="w-full flex items-center justify-between p-4 rounded-3xl bg-zinc-900/60 hover:bg-zinc-800/60 border border-white/10 backdrop-blur-md transition-all active:scale-[0.99] text-left"
            >
              <div className="flex items-center gap-3.5">
                <div
                  className="p-2.5 rounded-2xl bg-white/5 border border-white/10"
                  style={{ color: accentColor }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{item.title}</h4>
                  <p className="text-xs text-zinc-400 line-clamp-1">{item.desc}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </button>
          )
        })}
      </div>

      {/* Appearance / Customization Sheet Modal */}
      <AnimatePresence>
        {activeModal === 'customization' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Оформление и темы</h3>
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-3 py-1 rounded-lg bg-white/5 text-xs text-zinc-400 hover:text-white"
                >
                  Готово
                </button>
              </div>

              {/* Style Type (Minimal / Techno) */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
                  Визуальный стиль
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      haptic.click()
                      onStyleChange('Minimal')
                    }}
                    className={`p-3 rounded-2xl border text-sm font-bold transition-all ${
                      styleType === 'Minimal'
                        ? 'bg-white/10 border-white text-white'
                        : 'bg-zinc-800/40 border-white/5 text-zinc-400'
                    }`}
                  >
                    Apple Minimal
                  </button>
                  <button
                    onClick={() => {
                      haptic.click()
                      onStyleChange('Techno')
                    }}
                    className={`p-3 rounded-2xl border text-sm font-mono font-bold transition-all ${
                      styleType === 'Techno'
                        ? 'bg-[#00FF41]/10 border-[#00FF41] text-[#00FF41]'
                        : 'bg-zinc-800/40 border-white/5 text-zinc-400'
                    }`}
                  >
                    Cyber Techno
                  </button>
                </div>
              </div>

              {/* Color Accents */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
                  Цветовой акцент
                </label>
                <div className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-zinc-800/40 border border-white/5">
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

              {/* Transition animations */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
                  Анимация переходов
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Slide', 'Fade', 'Scale'] as TransitionType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        haptic.click()
                        onTransitionChange(t)
                      }}
                      className={`py-2 px-2 rounded-xl text-xs font-medium border ${
                        transitionType === t
                          ? 'bg-white/10 border-white/30 text-white font-bold'
                          : 'bg-zinc-800/30 border-white/5 text-zinc-400'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings / Navigation Mode Modal */}
      <AnimatePresence>
        {activeModal === 'settings' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Режим навигации</h3>
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-3 py-1 rounded-lg bg-white/5 text-xs text-zinc-400 hover:text-white"
                >
                  Готово
                </button>
              </div>

              <div className="space-y-2">
                {[
                  { mode: 'Buttons' as NavigationMode, title: 'Кнопки (Панель снизу)', desc: 'Классическая плавающая Apple панель с индикатором' },
                  { mode: 'Swipe' as NavigationMode, title: 'Полноэкранный свайп', desc: 'Переключение экранов горизонтальными жестами' },
                  { mode: 'Hold' as NavigationMode, title: 'Зажатие и радиальное меню', desc: 'Удержание пальца в любой точке экрана' }
                ].map((item) => (
                  <button
                    key={item.mode}
                    onClick={() => {
                      haptic.click()
                      onNavModeChange(item.mode)
                    }}
                    className={`w-full flex flex-col p-3.5 rounded-2xl border text-left transition-all ${
                      navMode === item.mode
                        ? 'bg-white/10 border-white text-white'
                        : 'bg-zinc-800/40 border-white/5 text-zinc-400'
                    }`}
                  >
                    <span className="font-bold text-sm text-white">{item.title}</span>
                    <span className="text-xs text-zinc-400 mt-0.5">{item.desc}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Generic Service Info Modal */}
      <AnimatePresence>
        {activeModal && activeModal !== 'customization' && activeModal !== 'settings' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-white">Информация</h3>
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-3 py-1 rounded-lg bg-white/5 text-xs text-zinc-400 hover:text-white"
                >
                  Закрыть
                </button>
              </div>

              <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                Синхронизация с серверами ИИС БГУИР в режиме реального времени. Для доступа к закрытым персональным ведомостям используется защищённый токен студента.
              </p>

              <button
                onClick={() => setActiveModal(null)}
                className="w-full py-3 rounded-2xl font-bold text-sm text-white transition-all shadow-md"
                style={{ backgroundColor: accentColor }}
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
