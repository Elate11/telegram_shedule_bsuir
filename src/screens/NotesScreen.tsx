import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Note } from '../types'
import { Plus, Trash2, Edit3, Clock, Bookmark, X } from 'lucide-react'
import { haptic } from '../services/telegram'

interface NotesScreenProps {
  accentColor?: string
}

export const NotesScreen: React.FC<NotesScreenProps> = ({
  accentColor = '#6C63FF'
}) => {
  const [notes, setNotes] = useState<Note[]>(() => {
    try {
      const saved = localStorage.getItem('app_notes_data')
      return saved ? JSON.parse(saved) : [
        {
          id: '1',
          subject: 'Методы оптимизации',
          text: 'Сдать 3 лабораторную работу и подготовить отчет к среде.',
          timestamp: Date.now() - 3600000 * 24,
          lessonTime: '09:45'
        },
        {
          id: '2',
          subject: 'Мобильная разработка',
          text: 'Задеплоить Telegram Mini App и протестировать на планшете.',
          timestamp: Date.now() - 3600000 * 12,
          lessonTime: '11:40'
        }
      ]
    } catch {
      return []
    }
  })

  const [showAddModal, setShowAddModal] = useState(false)
  const [newSubject, setNewSubject] = useState('')
  const [newText, setNewText] = useState('')

  // Persist notes
  useEffect(() => {
    try {
      localStorage.setItem('app_notes_data', JSON.stringify(notes))
    } catch {}
  }, [notes])

  const handleAddNote = () => {
    if (!newText.trim()) return
    haptic.success()
    const newNote: Note = {
      id: Date.now().toString(),
      subject: newSubject.trim() || 'Общая заметка',
      text: newText.trim(),
      timestamp: Date.now(),
      lessonTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    setNotes([newNote, ...notes])
    setNewSubject('')
    setNewText('')
    setShowAddModal(false)
  }

  const handleDeleteNote = (id: string) => {
    haptic.light()
    setNotes(notes.filter(n => n.id !== id))
  }

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto px-6 pt-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Заметки</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Личные задачи и напоминания к занятиям</p>
        </div>
        <button
          onClick={() => {
            haptic.click()
            setShowAddModal(true)
          }}
          className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all shadow-md active:scale-95"
          style={{ backgroundColor: accentColor }}
        >
          <Plus className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Notes List */}
      {notes.length > 0 ? (
        <div className="space-y-3">
          {notes.map((note) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-3xl bg-zinc-900/60 border border-white/10 backdrop-blur-md relative group"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {note.subject}
                </span>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-white/5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
                {note.text}
              </p>

              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mt-3 pt-2 border-t border-white/5">
                <Clock className="w-3 h-3" />
                <span>{new Date(note.timestamp).toLocaleDateString()}</span>
                {note.lessonTime && <span>• {note.lessonTime}</span>}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Edit3 className="w-12 h-12 text-zinc-600 mb-3" />
          <h3 className="text-lg font-bold text-zinc-300">Заметок пока нет</h3>
          <p className="text-xs text-zinc-500 max-w-xs mt-1">
            Нажмите кнопку «+» вверху, чтобы добавить напоминание к паре или задаче
          </p>
        </div>
      )}

      {/* Add Note Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Новая заметка</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 rounded-full bg-white/5 text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 mb-5">
                <input
                  type="text"
                  placeholder="Предмет или заголовок"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-800/80 border border-white/10 rounded-2xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                />

                <textarea
                  rows={4}
                  placeholder="Текст заметки..."
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-800/80 border border-white/10 rounded-2xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm bg-white/10 hover:bg-white/20 text-white transition-all"
                >
                  Отмена
                </button>
                <button
                  onClick={handleAddNote}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm text-white transition-all shadow-md"
                  style={{ backgroundColor: accentColor }}
                >
                  Сохранить
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
