import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { bsuirApi } from '../services/bsuirApi'
import { getBsuirWeekForCalendarDay, formatDayDate } from '../services/calendar'
import type { Lesson, BsuirStudentGroup, BsuirEmployee } from '../types'
import { ApplePullToRefresh } from '../components/ApplePullToRefresh'
import { DateRail } from '../components/DateRail'
import { LessonCard } from '../components/LessonCard'
import { LessonDetailModal } from '../components/LessonDetailModal'
import { Search, ChevronDown, Calendar as CalendarIcon, RefreshCw } from 'lucide-react'
import { haptic } from '../services/telegram'

interface ScheduleScreenProps {
  currentGroup: string
  onGroupChange: (group: string) => void
  subgroup: number
  onSubgroupChange: (sub: number) => void
  accentColor?: string
  isDarkTheme?: boolean
}

export const ScheduleScreen: React.FC<ScheduleScreenProps> = ({
  currentGroup,
  onGroupChange,
  subgroup,
  onSubgroupChange,
  accentColor = '#6C63FF',
}) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState(7) // Today is index 7
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [allLessons, setAllLessons] = useState<Lesson[]>([])
  const [exams, setExams] = useState<Lesson[]>([])
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [allGroups, setAllGroups] = useState<BsuirStudentGroup[]>([])
  const [allEmployees, setAllEmployees] = useState<BsuirEmployee[]>([])
  const [isSessionMode, setIsSessionMode] = useState(false)

  // Calendar day calculation
  const dayInfo = getBsuirWeekForCalendarDay(selectedDayIndex)
  const dateFormatted = formatDayDate(dayInfo.date)

  // Fetch groups and employees for target switcher
  useEffect(() => {
    bsuirApi.getAllGroups().then(setAllGroups)
    bsuirApi.getAllEmployees().then(setAllEmployees)
  }, [])

  // Load schedule function
  const loadSchedule = async (target: string) => {
    setIsRefreshing(true)
    try {
      const isTeacher = target.length > 0 && isNaN(Number(target))
      const resp = isTeacher
        ? await bsuirApi.getEmployeeSchedule(target)
        : await bsuirApi.getGroupSchedule(target)

      const parsed = bsuirApi.parseScheduleResponse(resp)
      setAllLessons(parsed.lessons)
      setExams(parsed.exams)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Load when group changes
  useEffect(() => {
    loadSchedule(currentGroup)
  }, [currentGroup])

  // Filter lessons for selected day and subgroup
  const dayLessons = allLessons.filter(l => {
    // Check day of week
    if (l.dayOfWeek !== dayInfo.dow) return false
    // Check week number
    if (l.weeks && l.weeks.length > 0 && !l.weeks.includes(dayInfo.weekNum)) return false
    // Check subgroup (0 means both subgroups)
    if (subgroup !== 0 && l.subgroup !== 0 && l.subgroup !== subgroup) return false
    return true
  }).sort((a, b) => a.startTime.localeCompare(b.startTime))

  return (
    <div className="flex flex-col h-full w-full">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 pt-4 pb-2 z-20">
        <div>
          <button
            onClick={() => {
              haptic.click()
              setShowSearchModal(true)
            }}
            className="flex items-center gap-2 group text-left"
          >
            <h1 className="text-2xl font-black tracking-tight text-white group-hover:text-zinc-200">
              {currentGroup || 'Выберите группу'}
            </h1>
            <ChevronDown className="w-5 h-5 text-zinc-400 group-hover:text-white transition-transform" />
          </button>
          <p className="text-xs font-medium text-zinc-400 mt-0.5">
            {dateFormatted.dayNumber} {dateFormatted.monthName} • {dayInfo.weekNum} учебная неделя
          </p>
        </div>

        {/* Subgroup Switcher & Mode buttons */}
        <div className="flex items-center gap-1.5 bg-zinc-900/60 border border-white/10 rounded-2xl p-1">
          <button
            onClick={() => {
              haptic.click()
              onSubgroupChange(subgroup === 1 ? 0 : 1)
            }}
            className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all ${
              subgroup === 1 ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            1 подгр.
          </button>
          <button
            onClick={() => {
              haptic.click()
              onSubgroupChange(subgroup === 2 ? 0 : 2)
            }}
            className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all ${
              subgroup === 2 ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            2 подгр.
          </button>
        </div>
      </div>

      {/* Date Rail */}
      <div className="z-10 border-b border-white/5 pb-1">
        <DateRail
          selectedIndex={selectedDayIndex}
          onSelectIndex={(idx) => {
            haptic.click()
            setSelectedDayIndex(idx)
          }}
          accentColor={accentColor}
        />
      </div>

      {/* Main Schedule Content with Pull-To-Refresh */}
      <div className="flex-1 overflow-hidden relative">
        <ApplePullToRefresh
          isRefreshing={isRefreshing}
          onRefresh={() => loadSchedule(currentGroup)}
          accentColor={accentColor}
          className="px-6 py-4"
        >
          {dayLessons.length > 0 ? (
            <div className="space-y-3 pb-24 max-w-2xl mx-auto">
              {dayLessons.map((lesson, idx) => (
                <LessonCard
                  key={idx}
                  lesson={lesson}
                  onClick={() => {
                    haptic.click()
                    setSelectedLesson(lesson)
                  }}
                  accentColor={accentColor}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <CalendarIcon className="w-12 h-12 text-zinc-600 mb-3" />
              <h3 className="text-lg font-bold text-zinc-300">Занятий нет</h3>
              <p className="text-xs text-zinc-500 max-w-xs mt-1">
                На этот день в расписании ничего не запланировано. Отличный повод отдохнуть!
              </p>
            </div>
          )}
        </ApplePullToRefresh>
      </div>

      {/* Lesson Details Sheet */}
      <LessonDetailModal
        lesson={selectedLesson}
        onClose={() => setSelectedLesson(null)}
        accentColor={accentColor}
      />

      {/* Search / Select Group Modal */}
      <AnimatePresence>
        {showSearchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Выбор группы или преподавателя</h3>
                <button
                  onClick={() => setShowSearchModal(false)}
                  className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-lg bg-white/5"
                >
                  Отмена
                </button>
              </div>

              {/* Search input */}
              <div className="relative mb-4">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  placeholder="Номер группы или фамилия..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-zinc-800/80 border border-white/10 rounded-2xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Filtered list */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {allGroups
                  .filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .slice(0, 50)
                  .map((g) => (
                    <button
                      key={g.name}
                      onClick={() => {
                        haptic.click()
                        onGroupChange(g.name)
                        setShowSearchModal(false)
                        setSearchQuery('')
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-2xl bg-zinc-800/40 hover:bg-zinc-800 border border-white/5 text-left text-sm text-zinc-200 hover:text-white transition-colors"
                    >
                      <span className="font-bold">{g.name}</span>
                      <span className="text-xs text-zinc-500">
                        {g.facultyAbbrev} {g.course ? `• ${g.course} курс` : ''}
                      </span>
                    </button>
                  ))}

                {allEmployees
                  .filter(e => e.fio?.toLowerCase().includes(searchQuery.toLowerCase()) || e.fullName?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .slice(0, 30)
                  .map((e) => (
                    <button
                      key={e.urlId || e.id}
                      onClick={() => {
                        if (e.urlId) {
                          haptic.click()
                          onGroupChange(e.urlId)
                          setShowSearchModal(false)
                          setSearchQuery('')
                        }
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-2xl bg-zinc-800/40 hover:bg-zinc-800 border border-white/5 text-left text-sm text-zinc-200 hover:text-white transition-colors"
                    >
                      <span className="font-bold">{e.fio || e.fullName}</span>
                      <span className="text-xs text-zinc-500">{e.academicDepartment?.[0] || 'Преподаватель'}</span>
                    </button>
                  ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
