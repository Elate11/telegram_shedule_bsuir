import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, CheckCircle, Edit3, User } from 'lucide-react'
import { haptic } from '../services/telegram'

interface NavigationProps {
  currentTab: number
  onTabChange: (index: number) => void
  navMode: 'Hold' | 'Swipe' | 'Buttons'
  styleType: 'Minimal' | 'Techno'
  accentColor?: string
}

export const BottomNavigation: React.FC<NavigationProps> = ({
  currentTab,
  onTabChange,
  navMode,
  styleType,
  accentColor = '#6C63FF'
}) => {
  const tabs = [
    { title: 'Расписание', icon: Calendar, tag: '[SCH]' },
    { title: 'Оценки', icon: CheckCircle, tag: '[MRK]' },
    { title: 'Заметки', icon: Edit3, tag: '[NTS]' },
    { title: 'Профиль', icon: User, tag: '[PRF]' },
  ]

  // If in Swipe mode, hide bottom bar or show minimal indicators
  if (navMode === 'Swipe') {
    return (
      <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-1.5 pointer-events-none z-30">
        {tabs.map((_, i) => (
          <div
            key={i}
            className={`transition-all duration-300 rounded-full ${
              currentTab === i ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/30'
            }`}
          />
        ))}
      </div>
    )
  }

  // Techno Style: ASCII Terminal Nav
  if (styleType === 'Techno') {
    return (
      <div className="w-full max-w-lg mx-auto px-4 pb-4 pt-1 z-30">
        <div className="flex w-full h-14 bg-[#0D0D0D]/95 border border-[#00FF41]/80 backdrop-blur-md">
          {tabs.map((tab, idx) => {
            const isSelected = currentTab === idx
            return (
              <button
                key={idx}
                onClick={() => {
                  haptic.click()
                  onTabChange(idx)
                }}
                className={`flex-1 flex items-center justify-center font-mono text-sm uppercase transition-colors ${
                  isSelected
                    ? 'text-[#00FF41] border border-[#00FF41] bg-[#00FF41]/10 font-bold'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {isSelected ? `> ${tab.tag}` : tab.tag}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Minimal Style: Floating Apple pill with animated sliding bubble
  return (
    <div className="w-full max-w-lg mx-auto px-6 pb-5 pt-2 z-30 select-none">
      <div className="relative flex items-center justify-around h-16 rounded-full bg-zinc-900/80 border border-white/10 backdrop-blur-xl shadow-2xl px-2">
        {tabs.map((tab, idx) => {
          const isSelected = currentTab === idx
          const IconComponent = tab.icon

          return (
            <button
              key={idx}
              onClick={() => {
                haptic.click()
                onTabChange(idx)
              }}
              className="relative flex-1 flex flex-col items-center justify-center h-full z-10"
            >
              <div className="relative">
                <IconComponent
                  className={`w-6 h-6 transition-all duration-300 ${
                    isSelected ? 'text-white scale-110' : 'text-zinc-400 scale-100 hover:text-zinc-200'
                  }`}
                  style={isSelected ? { color: accentColor } : {}}
                />
              </div>

              {isSelected && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-x-2 inset-y-1.5 rounded-full -z-10"
                  style={{
                    backgroundColor: `${accentColor}25`,
                    border: `1px solid ${accentColor}40`
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
