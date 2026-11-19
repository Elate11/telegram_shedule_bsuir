import React, { useRef, useEffect } from 'react'

interface DateRailProps {
  selectedIndex: number
  onSelectIndex: (index: number) => void
  accentColor?: string
  isDarkTheme?: boolean
}

export const DateRail: React.FC<DateRailProps> = ({
  selectedIndex,
  onSelectIndex,
  accentColor = '#6C63FF',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

  // Generate 90 days (-7 days to +83 days) like in Kotlin app
  const items = Array.from({ length: 90 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - 7 + i)
    return {
      index: i,
      dayNum: d.getDate(),
      dayName: days[d.getDay()],
      isToday: i === 7,
      date: d
    }
  })

  // Auto scroll to active index
  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.children[selectedIndex] as HTMLElement
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }
  }, [selectedIndex])

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-2 overflow-x-auto py-2 px-4 no-scrollbar select-none"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {items.map((item) => {
        const isSelected = selectedIndex === item.index
        return (
          <button
            key={item.index}
            onClick={() => onSelectIndex(item.index)}
            className={`flex-shrink-0 flex flex-col items-center justify-center w-12 h-16 rounded-2xl transition-all duration-200 ${
              isSelected
                ? 'bg-white/15 border border-white/30 shadow-lg scale-105'
                : 'bg-zinc-900/40 border border-white/5 hover:bg-zinc-800/40'
            }`}
            style={isSelected ? { borderColor: `${accentColor}80`, backgroundColor: `${accentColor}20` } : {}}
          >
            <span className="text-[11px] font-medium text-zinc-400">
              {item.dayName}
            </span>
            <span className={`text-base font-bold mt-0.5 ${isSelected ? 'text-white' : 'text-zinc-200'}`}>
              {item.dayNum}
            </span>
            {item.isToday && (
              <div
                className="w-1.5 h-1.5 rounded-full mt-1"
                style={{ backgroundColor: accentColor }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
