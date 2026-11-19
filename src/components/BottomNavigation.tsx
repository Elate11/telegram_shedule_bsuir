import React from 'react'
import { motion } from 'framer-motion'
import { Calendar, CheckCircle, Edit3, User } from 'lucide-react'
import { haptic } from '../services/telegram'

interface NavigationProps {
  currentTab: number
  onTabChange: (index: number) => void
  navMode?: 'Hold' | 'Swipe' | 'Buttons'
  styleType: 'Minimal' | 'Techno'
  accentColor?: string
}

export const BottomNavigation: React.FC<NavigationProps> = ({
  currentTab,
  onTabChange,
  styleType,
  accentColor = '#2997FF'
}) => {
  const tabs = [
    { title: 'Расписание', icon: Calendar, tag: '[SCH]' },
    { title: 'Оценки', icon: CheckCircle, tag: '[MRK]' },
    { title: 'Заметки', icon: Edit3, tag: '[NTS]' },
    { title: 'Профиль', icon: User, tag: '[PRF]' },
  ]

  // Techno Style: ASCII Terminal Nav exactly from Kotlin MainActivity.kt
  if (styleType === 'Techno') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-auto px-4 pb-4 pt-1 flex justify-center bg-transparent">
        <div className="flex w-full max-w-lg h-14 bg-[#0D0D0D]/95 border border-[#00FF41]/80 backdrop-blur-md">
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

  // Apple Minimal: Floating pill navbar with exact sliding bubble and dots
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none pb-4 px-6 flex flex-col items-center">
      <div className="pointer-events-auto relative w-full max-w-md h-16 rounded-[28px] bg-[#1C1C1E]/90 border border-white/10 backdrop-blur-2xl shadow-2xl px-2 flex items-center">
        {/* Animated Sliding Bubble behind active item */}
        <div className="absolute inset-x-2 inset-y-0 flex pointer-events-none">
          {tabs.map((_, idx) => (
            <div key={idx} className="flex-1 flex items-center justify-center">
              {currentTab === idx && (
                <motion.div
                  layoutId="slidingBubble"
                  className="w-16 h-12 rounded-[22px]"
                  style={{
                    backgroundColor: `${accentColor}30`,
                    border: `1.5px solid ${accentColor}60`
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 380,
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
                className="flex-1 flex items-center justify-center h-full active:scale-90 transition-transform cursor-pointer"
              >
                <IconComponent
                  className={`w-7 h-7 transition-colors duration-200 ${
                    isSelected ? 'text-white' : 'text-[#86868B] hover:text-zinc-300'
                  }`}
                  style={isSelected ? { color: accentColor } : {}}
                />
              </button>
            )
          })}
        </div>
      </div>

      {/* 4 Pagination Dots below bar */}
      <div className="pointer-events-none flex items-center gap-1.5 mt-2">
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
