import React from 'react'
import { motion } from 'framer-motion'
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
  navMode = 'Buttons',
  styleType,
  accentColor = '#2997FF'
}) => {
  const tabs = [
    { title: 'Расписание', icon: Calendar, tag: '[SCH]' },
    { title: 'Оценки', icon: CheckCircle, tag: '[MRK]' },
    { title: 'Заметки', icon: Edit3, tag: '[NTS]' },
    { title: 'Профиль', icon: User, tag: '[PRF]' },
  ]

  // If in Swipe mode, show minimal dots only
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

  // Techno Style: ASCII Terminal Nav exactly from Kotlin MainActivity.kt
  if (styleType === 'Techno') {
    return (
      <div className="w-full max-w-lg mx-auto px-6 pb-4 pt-1 z-30">
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
                className={`flex-1 flex items-center justify-center font-mono text-base uppercase transition-colors ${
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

  // Apple Minimal: Exact sliding bubble (width: 64dp, height: 48dp, rounded: 24dp, bg: MinAccent.copy(0.22f)) + 4 dots below
  return (
    <div className="w-full max-w-lg mx-auto px-6 pb-3 pt-1 z-30 select-none flex flex-col items-center">
      <div className="relative w-full h-16 flex items-center">
        {/* Animated Sliding Bubble behind active item */}
        <div className="absolute inset-0 flex pointer-events-none">
          {tabs.map((_, idx) => (
            <div key={idx} className="flex-1 flex items-center justify-center">
              {currentTab === idx && (
                <motion.div
                  layoutId="slidingBubble"
                  className="w-16 h-12 rounded-[24px]"
                  style={{
                    backgroundColor: `${accentColor}38`,
                    border: `1px solid ${accentColor}50`
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 350,
                    damping: 28
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Icons Row */}
        <div className="relative w-full h-full flex items-center justify-around z-10">
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
                className="flex-1 flex items-center justify-center h-full active:scale-90 transition-transform"
              >
                <IconComponent
                  className={`w-7 h-7 transition-colors duration-200 ${
                    isSelected ? 'text-white' : 'text-[#86868B] hover:text-zinc-300'
                  }`}
                  style={isSelected ? { color: '#FFFFFF' } : {}}
                />
              </button>
            )
          })}
        </div>
      </div>

      {/* 4 Pagination Dots below bar (from Kotlin line 1370) */}
      <div className="flex items-center gap-1.5 mt-1.5 pb-1">
        {tabs.map((_, idx) => {
          const isSelected = currentTab === idx
          return (
            <div
              key={idx}
              className={`rounded-full transition-all duration-300 ${
                isSelected
                  ? 'w-1.5 h-1.5 bg-white'
                  : 'w-1 h-1 bg-white/20'
              }`}
            />
          )
        })}
      </div>
    </div>
  )
}
