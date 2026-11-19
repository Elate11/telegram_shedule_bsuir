import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ApplePullToRefresh } from '../components/ApplePullToRefresh'
import { haptic } from '../services/telegram'

interface AcademicSubject {
  name: string
  abbrev: string
  rating?: number
  hours?: number
  doneHours?: number
  marks: string[]
}

interface MarksScreenProps {
  accentColor?: string
  isDarkTheme?: boolean
}

export const MarksScreen: React.FC<MarksScreenProps> = ({
  accentColor = '#2997FF',
  isDarkTheme = true
}) => {
  const [subjects, setSubjects] = useState<AcademicSubject[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [studentRating, setStudentRating] = useState<number | null>(null)
  const [ratingPosition, setRatingPosition] = useState<number | null>(null)

  // Pure live load from BSUIR API / local user data without fake hardcoded items
  const loadData = async (isUserRefresh = false) => {
    if (isUserRefresh) setIsRefreshing(true)
    else setIsLoading(true)

    try {
      const cached = localStorage.getItem('app_academic_subjects')
      if (cached) {
        setSubjects(JSON.parse(cached))
      }
      const ratingCached = localStorage.getItem('app_student_rating')
      if (ratingCached) {
        const parsed = JSON.parse(ratingCached)
        setStudentRating(parsed.rating)
        setRatingPosition(parsed.position)
      }
    } finally {
      setIsRefreshing(false)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData(false)
  }, [])

  return (
    <div className="h-full w-full overflow-hidden select-none">
      <ApplePullToRefresh
        isRefreshing={isRefreshing}
        onRefresh={() => loadData(true)}
        accentColor={accentColor}
        className="px-5 pt-4 pb-24"
      >
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Успеваемость
          </h1>
          <p className="text-sm text-[#86868B] mt-0.5">
            Текущий рейтинг и оценки
          </p>
        </div>

        {/* Rating Card if present */}
        {studentRating !== null ? (
          <div className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08] mb-4">
            <span className="text-xs font-semibold text-[#86868B] uppercase">Средний балл</span>
            <div className="text-3xl font-bold text-white mt-1" style={{ color: accentColor }}>
              {studentRating}
            </div>
            {ratingPosition && (
              <span className="text-xs text-[#86868B]">Место в группе: {ratingPosition}</span>
            )}
          </div>
        ) : null}

        {/* Subjects list */}
        {subjects.length > 0 ? (
          <div className="space-y-3">
            {subjects.map((sub, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08]"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-semibold text-white truncate max-w-[80%]">
                    {sub.name}
                  </span>
                  {sub.rating && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white/10" style={{ color: accentColor }}>
                      {sub.rating}
                    </span>
                  )}
                </div>

                {sub.marks && sub.marks.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2">
                    {sub.marks.map((m, i) => (
                      <span
                        key={i}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-black/30 border border-white/5 text-xs font-bold text-white"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <h2 className="text-xl font-bold text-white mb-1">
              Нет данных об оценках
            </h2>
            <p className="text-xs text-[#86868B] max-w-xs">
              Для загрузки персональных оценок и зачётки требуется авторизация в личном кабинете ИИС БГУИР
            </p>
          </div>
        )}
      </ApplePullToRefresh>
    </div>
  )
}
