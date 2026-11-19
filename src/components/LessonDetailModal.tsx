import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Lesson } from '../types'
import { X, Clock, MapPin, User, Bookmark, Users, ExternalLink } from 'lucide-react'

interface LessonDetailModalProps {
  lesson: Lesson | null
  onClose: () => void
  onAddNote?: (lesson: Lesson) => void
  accentColor?: string
}

export const LessonDetailModal: React.FC<LessonDetailModalProps> = ({
  lesson,
  onClose,
  onAddNote,
  accentColor = '#6C63FF'
}) => {
  if (!lesson) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
        {/* Backdrop click */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        {/* Modal content sheet */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-lg bg-zinc-900 border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <span
              className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/10 text-zinc-300"
              style={{ color: accentColor }}
            >
              {lesson.lessonType || 'Занятие'}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Full Title */}
          <h2 className="text-xl font-bold text-white mt-4 leading-tight">
            {lesson.subjectFullName || lesson.title}
          </h2>

          {/* Details list */}
          <div className="mt-5 space-y-3.5">
            <div className="flex items-center gap-3 text-sm text-zinc-300">
              <Clock className="w-5 h-5 text-zinc-400 shrink-0" />
              <span>{lesson.startTime} — {lesson.endTime}</span>
            </div>

            {lesson.auditory && (
              <div className="flex items-center gap-3 text-sm text-zinc-300">
                <MapPin className="w-5 h-5 text-zinc-400 shrink-0" />
                <span>Аудитория {lesson.auditory}</span>
              </div>
            )}

            {lesson.teacherFullName && (
              <div className="flex items-center gap-3 text-sm text-zinc-300">
                <User className="w-5 h-5 text-zinc-400 shrink-0" />
                <span>{lesson.teacherFullName}</span>
              </div>
            )}

            {lesson.subgroup > 0 && (
              <div className="flex items-center gap-3 text-sm text-zinc-300">
                <Users className="w-5 h-5 text-zinc-400 shrink-0" />
                <span>{lesson.subgroup} подгруппа</span>
              </div>
            )}

            {lesson.studentGroups && lesson.studentGroups.length > 0 && (
              <div className="flex items-start gap-3 text-sm text-zinc-300">
                <Users className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
                <div className="flex flex-wrap gap-1.5">
                  {lesson.studentGroups.map((g, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-white/5 text-xs text-zinc-300 font-mono">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {lesson.note && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex gap-2.5">
                <Bookmark className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{lesson.note}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-6 flex gap-3">
            {onAddNote && (
              <button
                onClick={() => {
                  onAddNote(lesson)
                  onClose()
                }}
                className="flex-1 py-3 px-4 rounded-2xl font-bold text-sm bg-white/10 hover:bg-white/20 text-white transition-all text-center"
              >
                Добавить заметку
              </button>
            )}
            <button
              onClick={onClose}
              className="py-3 px-6 rounded-2xl font-bold text-sm text-black transition-all text-center"
              style={{ backgroundColor: accentColor, color: '#fff' }}
            >
              Закрыть
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
