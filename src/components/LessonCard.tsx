import React from 'react'
import type { Lesson } from '../types'
import { Clock, MapPin, User, Bookmark } from 'lucide-react'

interface LessonCardProps {
  lesson: Lesson
  onClick?: () => void
  accentColor?: string
  isDarkTheme?: boolean
}

export const LessonCard: React.FC<LessonCardProps> = ({
  lesson,
  onClick,
  accentColor = '#6C63FF',
}) => {
  // Determine badge color for lesson type
  const getTypeColor = (type: string) => {
    const t = type.toLowerCase()
    if (t.includes('лк') || t.includes('лекц')) return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    if (t.includes('пз') || t.includes('практ')) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    if (t.includes('лр') || t.includes('лаб')) return 'bg-rose-500/15 text-rose-300 border-rose-500/30'
    if (t.includes('экз') || t.includes('конс')) return 'bg-purple-500/15 text-purple-300 border-purple-500/30'
    return 'bg-zinc-700/30 text-zinc-300 border-zinc-600/30'
  }

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col p-4 rounded-3xl bg-zinc-900/60 hover:bg-zinc-800/60 border border-white/10 backdrop-blur-xl transition-all duration-200 cursor-pointer active:scale-[0.98] shadow-sm hover:shadow-md"
    >
      {/* Top Header: Time & Type Badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
          <Clock className="w-3.5 h-3.5 text-zinc-400" />
          <span>{lesson.startTime} — {lesson.endTime}</span>
        </div>

        {lesson.lessonType && (
          <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${getTypeColor(lesson.lessonType)}`}>
            {lesson.lessonType}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-base font-bold text-white line-clamp-2 leading-snug mb-2 group-hover:text-white">
        {lesson.title}
      </h3>

      {/* Subgroup info if present */}
      {lesson.subgroup > 0 && (
        <div className="mb-2">
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/10 text-zinc-300">
            {lesson.subgroup} подгруппа
          </span>
        </div>
      )}

      {/* Footer Info: Teacher & Auditory */}
      <div className="flex flex-wrap items-center justify-between gap-y-1.5 text-xs text-zinc-400 pt-2 border-t border-white/5">
        {lesson.teacherName ? (
          <div className="flex items-center gap-1.5 truncate max-w-[65%]">
            <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="truncate hover:underline">{lesson.teacherName}</span>
          </div>
        ) : <div />}

        {lesson.auditory && (
          <div className="flex items-center gap-1 shrink-0 font-medium text-zinc-300">
            <MapPin className="w-3.5 h-3.5 text-zinc-400" />
            <span>{lesson.auditory}</span>
          </div>
        )}
      </div>

      {/* Note indicator if exists */}
      {lesson.note && (
        <div className="mt-2 text-[11px] text-zinc-400 italic line-clamp-1 flex items-center gap-1">
          <Bookmark className="w-3 h-3 text-amber-400 shrink-0" />
          <span>{lesson.note}</span>
        </div>
      )}
    </div>
  )
}
