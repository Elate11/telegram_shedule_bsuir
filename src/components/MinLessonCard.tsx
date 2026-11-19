import React from 'react'
import type { Lesson } from '../types'
import { haptic } from '../services/telegram'

interface MinLessonCardProps {
  lesson: Lesson
  isDarkTheme?: boolean
  styleType?: 'Minimal' | 'Techno'
  accentColor?: string
  hasNotes?: boolean
  notePreview?: string | null
  onClick?: () => void
  onLongClick?: () => void
}

export const MinLessonCard: React.FC<MinLessonCardProps> = ({
  lesson,
  isDarkTheme = true,
  styleType = 'Minimal',
  accentColor = '#B388FF',
  notePreview,
  onClick,
  onLongClick
}) => {
  const isTechno = styleType === 'Techno'
  const technoAccent = '#00FF41'

  // Auditory chip text formatting (strip "ауд.")
  const cleanAuditory = React.useMemo(() => {
    const raw = lesson.auditory?.trim() || ''
    if (raw) {
      return raw.replace(/^(ауд\.?\s*|aud\.?\s*)/i, '').trim()
    }
    if (lesson.title.toLowerCase().includes('физ') || lesson.lessonType.toLowerCase().includes('физ')) {
      return 'спортзал'
    }
    return '—'
  }, [lesson.auditory, lesson.title, lesson.lessonType])

  return (
    <div
      onClick={() => {
        haptic.click()
        onClick?.()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        haptic.medium()
        onLongClick?.()
      }}
      className="group relative flex items-center justify-between w-full py-2.5 px-0 cursor-pointer active:opacity-75 transition-opacity select-none"
    >
      <div className="flex items-center flex-1 min-w-0">
        {/* 1. Time Column (2 lines: start time and end time) */}
        <div className="w-16 flex flex-col justify-center shrink-0">
          <span
            className={`text-[17px] font-bold leading-tight ${
              isTechno ? 'text-[#00FF41] font-mono' : isDarkTheme ? 'text-white' : 'text-[#1D1D1F]'
            }`}
          >
            {lesson.startTime}
          </span>
          <span
            className={`text-sm mt-0.5 leading-tight ${
              isTechno ? 'text-[#00FF41]/60 font-mono' : isDarkTheme ? 'text-[#8E8E93]' : 'text-[#8E8E93]'
            }`}
          >
            {lesson.endTime}
          </span>
        </div>

        {/* 2. Lesson Type Badge: White rounded rectangle with grey uppercase text */}
        {lesson.lessonType && (
          <div className="ml-2 mr-3 px-2 py-0.5 rounded-md bg-white text-[#2C2C2E] text-xs font-bold shrink-0 shadow-sm">
            {lesson.lessonType}
          </div>
        )}

        {/* 3. Title */}
        <div className="flex flex-col justify-center flex-1 min-w-0 pr-3">
          <span
            className={`text-lg font-bold truncate leading-tight ${
              isTechno ? 'text-[#00FF41] font-mono' : isDarkTheme ? 'text-white' : 'text-[#1D1D1F]'
            }`}
          >
            {lesson.subgroup !== 0 ? `${lesson.title} (${lesson.subgroup} п.)` : lesson.title}
          </span>

          {notePreview && (
            <span className="text-xs truncate text-[#8E8E93] mt-0.5">
              {notePreview}
            </span>
          )}
        </div>
      </div>

      {/* 4. Auditory Pill (Clean white pill with dark text or dash) */}
      <div className="shrink-0 min-w-14 h-9 px-3.5 rounded-xl bg-white text-[#1C1C1E] font-semibold text-sm flex items-center justify-center shadow-sm">
        {cleanAuditory}
      </div>
    </div>
  )
}
