import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Clock } from 'lucide-react'
import { haptic } from '../services/telegram'
import { ApplePullToRefresh } from '../components/ApplePullToRefresh'

interface NoteItem {
  id: string
  subject: string
  text: string
  timestamp: number
  date?: string
}

interface NotesScreenProps {
  accentColor?: string
  isDarkTheme?: boolean
}

export const NotesScreen: React.FC<NotesScreenProps> = ({
  accentColor = '#2997FF',
  isDarkTheme = true
}) => {
  // Pure user storage without hardcoded mocks
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    try {
      const saved = localStorage.getItem('app_notes_list')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('Все')
  const [showAddModal, setShowAddModal] = useState(false)
  const [noteSubject, setNoteSubject] = useState('')
  const [noteText, setNoteText] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Persist notes
  useEffect(() => {
    localStorage.setItem('app_notes_list', JSON.stringify(notes))
  }, [notes])

  const subjects = ['Все', ...Array.from(new Set(notes.map(n => n.subject).filter(Boolean)))]

  const filteredNotes = selectedSubjectFilter === 'Все'
    ? notes
    : notes.filter(n => n.subject === selectedSubjectFilter)

  const handleAddNote = () => {
    if (!noteText.trim()) return
    haptic.success()
    const newNote: NoteItem = {
      id: Date.now().toString(),
      subject: noteSubject.trim() || 'Общая заметка',
      text: noteText.trim(),
      timestamp: Date.now(),
      date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    }
    setNotes([newNote, ...notes])
    setNoteSubject('')
    setNoteText('')
    setShowAddModal(false)
  }

  const handleDelete = (id: string) => {
    haptic.light()
    setNotes(notes.filter(n => n.id !== id))
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await new Promise(r => setTimeout(r, 500))
    setIsRefreshing(false)
  }

  return (
    <div className="h-full w-full overflow-hidden select-none">
      <ApplePullToRefresh
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        accentColor={accentColor}
        className="px-5 pt-4 pb-24"
      >
        {/* Header matching Kotlin MinNotesScreen */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Заметки
          </h1>
          <button
            onClick={() => {
              haptic.click()
              setShowAddModal(true)
            }}
            className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 shadow-sm"
            style={{ backgroundColor: accentColor }}
          >
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Horizontal Subject Filter Carousel */}
        {subjects.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-2">
            {subjects.map((s) => (
              <button
                key={s}
                onClick={() => {
                  haptic.click()
                  setSelectedSubjectFilter(s)
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all ${
                  selectedSubjectFilter === s
                    ? 'bg-white text-black border-white'
                    : 'bg-[#272729] text-zinc-300 border-white/10'
                }`}
                style={selectedSubjectFilter === s ? { backgroundColor: accentColor, color: '#fff', borderColor: accentColor } : {}}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Notes List */}
        {filteredNotes.length > 0 ? (
          <div className="space-y-3">
            {filteredNotes.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08] shadow-sm relative group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400" style={{ color: accentColor }}>
                    {note.subject}
                  </span>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="text-zinc-500 hover:text-rose-400 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed">
                  {note.text}
                </p>

                <div className="flex items-center gap-1 text-[11px] text-zinc-500 mt-2.5 pt-2 border-t border-white/[0.04]">
                  <Clock className="w-3 h-3" />
                  <span>{note.date || new Date(note.timestamp).toLocaleDateString()}</span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <h2 className="text-xl font-bold text-white mb-1">
              Заметок пока нет
            </h2>
            <p className="text-xs text-[#86868B] max-w-xs">
              Нажмите кнопку «+» вверху, чтобы добавить напоминание к предмету или личную задачу
            </p>
          </div>
        )}
      </ApplePullToRefresh>

      {/* Add Note Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#272729] border border-white/10 rounded-3xl p-6 shadow-2xl"
            >
              <h3 className="text-lg font-bold text-white mb-4">Новая заметка</h3>

              <div className="space-y-3 mb-5">
                <input
                  type="text"
                  placeholder="Предмет или тема"
                  value={noteSubject}
                  onChange={(e) => setNoteSubject(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none"
                />

                <textarea
                  rows={4}
                  placeholder="Текст заметки..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-white/10 text-white"
                >
                  Отмена
                </button>
                <button
                  onClick={handleAddNote}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white shadow-md"
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
