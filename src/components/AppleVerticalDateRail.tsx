import React, { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { haptic } from '../services/telegram'

interface AppleVerticalDateRailProps {
  selectedIndex: number
  onSelectIndex: (index: number) => void
  accentColor?: string
  isDarkTheme?: boolean
}

export const AppleVerticalDateRail: React.FC<AppleVerticalDateRailProps> = ({
  selectedIndex,
  onSelectIndex,
  accentColor = '#2997FF',
  isDarkTheme = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const daysShort = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ']

  // 90 calendar items (-7 days to +82 days)
  const railItems = Array.from({ length: 90 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - 7 + i)
    return {
      index: i,
      dayNum: d.getDate(),
      weekDay: daysShort[d.getDay()],
      isToday: i === 7,
      date: d
    }
  })

  // Auto scroll selected day into vertical center
  useEffect(() => {
    if (containerRef.current) {
      const activeEl = containerRef.current.children[selectedIndex] as HTMLElement
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [selectedIndex])

  return (
    <div className="relative w-12 h-full flex flex-col items-center select-none">
      {/* Top and Bottom Dissolve gradient mask */}
      <div
        className="w-full h-full overflow-y-auto no-scrollbar py-6 space-y-2.5 flex flex-col items-center"
        ref={containerRef}
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {railItems.map((item) => {
          const isSelected = selectedIndex === item.index
          return (
            <button
              key={item.index}
              onClick={() => {
                haptic.click()
                onSelectIndex(item.index)
              }}
              className={`flex flex-col items-center justify-center w-11 h-12 rounded-xl transition-all duration-200 shrink-0 ${
                isSelected ? 'scale-115' : 'hover:scale-105 opacity-40 hover:opacity-70'
              }`}
            >
              <span
                className={`text-[10px] font-bold tracking-wider leading-none ${
                  isSelected ? '' : isDarkTheme ? 'text-white' : 'text-black'
                }`}
                style={isSelected ? { color: accentColor } : {}}
              >
                {item.weekDay}
              </span>
              <span
                className={`text-lg font-bold leading-tight mt-0.5 tracking-tight ${
                  isSelected ? '' : isDarkTheme ? 'text-white' : 'text-black'
                }`}
                style={isSelected ? { color: accentColor } : {}}
              >
                {item.dayNum}
              </span>
              {item.isToday && (
                <div
                  className="w-1 h-1 rounded-full mt-0.5"
                  style={{ backgroundColor: isSelected ? accentColor : isDarkTheme ? '#FFFFFF' : '#000000' }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
