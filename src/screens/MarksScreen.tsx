import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Award, BookOpen, ChevronRight, BarChart2, Star, CheckCircle } from 'lucide-react'
import { haptic } from '../services/telegram'

interface MarksScreenProps {
  accentColor?: string
}

export const MarksScreen: React.FC<MarksScreenProps> = ({
  accentColor = '#6C63FF'
}) => {
  const [selectedTab, setSelectedTab] = useState<'rating' | 'markbook'>('rating')

  // Academic rating sample structure aligned with IIS BSUIR API
  const sampleSubjects = [
    { name: 'Методы оптимизации и принятие решений', hours: 64, done: 48, rating: 8.8, marks: ['9', '8', '10', '8'] },
    { name: 'Разработка мобильных приложений', hours: 72, done: 60, rating: 9.5, marks: ['10', '9', '10', '9', '9'] },
    { name: 'Инженерия качества программного обеспечения', hours: 56, done: 40, rating: 8.2, marks: ['8', '7', '9', '9'] },
    { name: 'Управление программными проектами', hours: 48, done: 32, rating: 9.0, marks: ['9', '9', '9'] },
  ]

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto px-6 pt-4 pb-24">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Успеваемость</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Оценки, рейтинг и журнал успеваемости</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-zinc-900/60 p-1 rounded-2xl border border-white/10 mb-4 max-w-sm">
        <button
          onClick={() => {
            haptic.click()
            setSelectedTab('rating')
          }}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
            selectedTab === 'rating' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Текущий рейтинг
        </button>
        <button
          onClick={() => {
            haptic.click()
            setSelectedTab('markbook')
          }}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
            selectedTab === 'markbook' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Электронная зачётка
        </button>
      </div>

      {/* Overall Score Card */}
      <div
        className="relative overflow-hidden rounded-3xl p-5 border border-white/10 mb-5 shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${accentColor}25, rgba(20,20,30,0.8))`
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Средний балл
            </span>
            <div className="text-3xl font-black text-white mt-1">
              8.9
            </div>
            <p className="text-xs text-zinc-400 mt-1">Позиция в группе: 3 из 28</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md">
            <Award className="w-8 h-8" style={{ color: accentColor }} />
          </div>
        </div>
      </div>

      {/* Subject List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-zinc-300">Дисциплины семестра</h3>
        {sampleSubjects.map((sub, idx) => (
          <div
            key={idx}
            className="p-4 rounded-3xl bg-zinc-900/60 border border-white/10 backdrop-blur-md"
          >
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-sm font-bold text-white line-clamp-1">{sub.name}</h4>
              <span
                className="text-xs font-extrabold px-2 py-0.5 rounded-lg bg-white/10 shrink-0"
                style={{ color: accentColor }}
              >
                {sub.rating}
              </span>
            </div>

            {/* Marks history */}
            <div className="flex items-center gap-1.5 mt-3">
              <span className="text-[11px] text-zinc-400 mr-1">Оценки:</span>
              {sub.marks.map((m, i) => (
                <span
                  key={i}
                  className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-zinc-200"
                >
                  {m}
                </span>
              ))}
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                <span>Пройдено часов: {sub.done} из {sub.hours}</span>
                <span>{Math.round((sub.done / sub.hours) * 100)}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(sub.done / sub.hours) * 100}%`,
                    backgroundColor: accentColor
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
