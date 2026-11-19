import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { bsuirApi } from '../services/bsuirApi'
import { getBsuirWeekForCalendarDay } from '../services/calendar'
import type { Lesson, BsuirStudentGroup, BsuirEmployee } from '../types'
import { ApplePullToRefresh } from '../components/ApplePullToRefresh'
import { AppleVerticalDateRail } from '../components/AppleVerticalDateRail'
import { MinLessonCard } from '../components/MinLessonCard'
import { LessonDetailModal } from '../components/LessonDetailModal'
import { ChevronDown, ChevronUp, History, X, Search, Calendar as CalendarIcon, ArrowLeft } from 'lucide-react'
import { haptic } from '../services/telegram'

interface ScheduleScreenProps {
  currentGroup: string
  onGroupChange: (group: string) => void
  subgroup: number
  onSubgroupChange: (sub: number) => void
  accentColor?: string
  isDarkTheme?: boolean
  styleType?: 'Minimal' | 'Techno'
}

export const ScheduleScreen: React.FC<ScheduleScreenProps> = ({
  currentGroup,
  onGroupChange,
  subgroup,
  onSubgroupChange,
  accentColor = '#2997FF',
  isDarkTheme = true,
  styleType = 'Minimal'
}) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState(7)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [allLessons, setAllLessons] = useState<Lesson[]>([])
  const [exams, setExams] = useState<Lesson[]>([])
  const [sessionPeriod, setSessionPeriod] = useState<{ start?: string; end?: string }>({})
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  const [inlineTeacher, setInlineTeacher] = useState<{ urlId: string; name: string } | null>(null)

  // Expandable Group Dropdown
  const [isGroupExpanded, setIsGroupExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [allGroups, setAllGroups] = useState<BsuirStudentGroup[]>([])
  const [allEmployees, setAllEmployees] = useState<BsuirEmployee[]>([])
  const [groupHistory, setGroupHistory] = useState<string[]>(() => {
    try {
      const h = localStorage.getItem('app_group_history')
      return h ? JSON.parse(h) : ['114001', '310101']
    } catch {
      return ['114001']
    }
  })

  // Date rail visibility toggle (swipe edge or click handle)
  const [isDateRailVisible, setIsDateRailVisible] = useState(true)

  // Calendar day calculation
  const dayInfo = getBsuirWeekForCalendarDay(selectedDayIndex)

  // Fetch groups and employees
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

      if (resp) {
        setSessionPeriod({ start: resp.startExamsDate, end: resp.endExamsDate })
      }
      const parsed = bsuirApi.parseScheduleResponse(resp)
      setAllLessons(parsed.lessons)
      setExams(parsed.exams)

      // Add to history
      if (target && !groupHistory.includes(target)) {
        const newHist = [target, ...groupHistory.filter(h => h !== target)].slice(0, 8)
        setGroupHistory(newHist)
        localStorage.setItem('app_group_history', JSON.stringify(newHist))
      }
    } finally {
      setIsRefreshing(false)
    }
  }

  // Reload when group or inline teacher changes
  useEffect(() => {
    const target = inlineTeacher ? inlineTeacher.urlId : currentGroup
    loadSchedule(target)
  }, [currentGroup, inlineTeacher])

  // Filter lessons for day & subgroup
  const dayLessons = allLessons.filter(l => {
    if (l.dayOfWeek !== dayInfo.dow) return false
    if (l.weeks && l.weeks.length > 0 && !l.weeks.includes(dayInfo.weekNum)) return false
    if (subgroup !== 0 && l.subgroup !== 0 && l.subgroup !== subgroup) return false
    return true
  }).sort((a, b) => a.startTime.localeCompare(b.startTime))

  const isTechno = styleType === 'Techno'

  return (
    <div className="relative flex h-full w-full overflow-hidden select-none">
      {/* Center Content with Pull-To-Refresh */}
      <div className="flex-1 h-full overflow-hidden flex flex-col pr-0">
        <ApplePullToRefresh
          isRefreshing={isRefreshing}
          onRefresh={() => loadSchedule(inlineTeacher ? inlineTeacher.urlId : currentGroup)}
          accentColor={accentColor}
          className="px-5 pt-3 pb-24"
        >
          {/* 1. Header: Week label */}
          <div className="w-full text-center mb-1">
            <span
              className={`text-sm font-medium ${
                isTechno ? 'text-[#00FF41] font-mono' : isDarkTheme ? 'text-[#86868B]' : 'text-[#86868B]'
              }`}
            >
              {isTechno ? `> ${dayInfo.weekNum} УЧЕБНАЯ НЕДЕЛЯ_` : `${dayInfo.weekNum} учебная неделя`}
            </span>
          </div>

          {/* 2. Group Number or Inline Teacher Header */}
          <div className="w-full flex justify-center items-center mb-3">
            {inlineTeacher ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    haptic.click()
                    setInlineTeacher(null)
                  }}
                  className="p-1.5 rounded-full hover:bg-white/10 text-white"
                  style={{ color: accentColor }}
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-2xl font-bold text-white truncate max-w-[260px]">
                  {inlineTeacher.name}
                </h1>
              </div>
            ) : (
              <button
                onClick={() => {
                  haptic.click()
                  setIsGroupExpanded(!isGroupExpanded)
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-2xl hover:bg-white/5 active:scale-95 transition-transform"
              >
                <h1
                  className={`text-3xl font-bold tracking-tight ${
                    isTechno ? 'text-[#00FF41] font-mono' : isDarkTheme ? 'text-white' : 'text-[#1D1D1F]'
                  }`}
                >
                  {isTechno ? `> ${currentGroup}_` : currentGroup}
                </h1>
                {isGroupExpanded ? (
                  <ChevronUp className="w-6 h-6 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-6 h-6 text-zinc-400" />
                )}
              </button>
            )}
          </div>

          {/* Expandable Group Switcher Panel */}
          <AnimatePresence>
            {isGroupExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-4 rounded-3xl bg-[#2A2A2C] border border-white/10 p-4 shadow-xl"
              >
                {/* Search input */}
                <div className="relative mb-3">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Номер группы или фамилия..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none"
                  />
                </div>

                {/* Filtered items */}
                {searchQuery ? (
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {allGroups
                      .filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .slice(0, 15)
                      .map((g) => (
                        <button
                          key={g.name}
                          onClick={() => {
                            haptic.click()
                            onGroupChange(g.name)
                            setIsGroupExpanded(false)
                            setSearchQuery('')
                          }}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/10 text-left text-sm text-zinc-200"
                        >
                          <span className="font-bold">{g.name}</span>
                          <span className="text-xs text-zinc-400">{g.facultyAbbrev}</span>
                        </button>
                      ))}

                    {allEmployees
                      .filter(e => (e.fio || e.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()))
                      .slice(0, 15)
                      .map((e) => (
                        <button
                          key={e.urlId || e.id}
                          onClick={() => {
                            if (e.urlId) {
                              haptic.click()
                              setInlineTeacher({ urlId: e.urlId, name: e.fio || e.fullName || '' })
                              setIsGroupExpanded(false)
                              setSearchQuery('')
                            }
                          }}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/10 text-left text-sm text-zinc-200"
                        >
                          <span className="font-bold">{e.fio || e.fullName}</span>
                          <span className="text-xs text-zinc-400">{e.academicDepartment?.[0] || 'Преподаватель'}</span>
                        </button>
                      ))}
                  </div>
                ) : (
                  // Recent History
                  <div>
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                      Недавние
                    </span>
                    <div className="space-y-1">
                      {groupHistory.map((grp) => (
                        <div key={grp} className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5">
                          <button
                            onClick={() => {
                              haptic.click()
                              onGroupChange(grp)
                              setIsGroupExpanded(false)
                            }}
                            className="flex items-center gap-2 text-sm font-medium text-white flex-1 text-left"
                          >
                            <History className="w-4 h-4 text-zinc-500" />
                            <span>{grp}</span>
                          </button>
                          <button
                            onClick={() => {
                              const filtered = groupHistory.filter(h => h !== grp)
                              setGroupHistory(filtered)
                              localStorage.setItem('app_group_history', JSON.stringify(filtered))
                            }}
                            className="p-1 text-zinc-500 hover:text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 3. Subgroup Chips: [Все] [1 подгр.] [2 подгр.] */}
          <div className="flex items-center justify-start gap-2 mb-4">
            {[
              { id: 0, label: 'Все' },
              { id: 1, label: '1 подгр.' },
              { id: 2, label: '2 подгр.' }
            ].map((chip) => {
              const isSelected = subgroup === chip.id
              return (
                <button
                  key={chip.id}
                  onClick={() => {
                    haptic.click()
                    onSubgroupChange(chip.id)
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    isSelected
                      ? 'bg-white text-black border-white shadow-sm'
                      : isDarkTheme
                        ? 'bg-[#272729] text-white border-white/10 hover:bg-[#2A2A2C]'
                        : 'bg-white text-zinc-700 border-black/10'
                  }`}
                  style={isSelected ? { backgroundColor: accentColor, color: '#FFFFFF', borderColor: accentColor } : {}}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>

          {/* 4. Lessons List */}
          {dayLessons.length > 0 ? (
            <div className="space-y-3 pb-8">
              {dayLessons.map((lesson, idx) => (
                <MinLessonCard
                  key={idx}
                  lesson={lesson}
                  isDarkTheme={isDarkTheme}
                  styleType={styleType}
                  accentColor={accentColor}
                  onClick={() => {
                    setSelectedLesson(lesson)
                  }}
                  onLongClick={() => {
                    // Open modal for details
                    setSelectedLesson(lesson)
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <h2
                className={`text-2xl font-bold mb-1 ${
                  isTechno ? 'text-[#00FF41] font-mono' : isDarkTheme ? 'text-white' : 'text-[#1D1D1F]'
                }`}
              >
                Отличный день
              </h2>
              <p
                className={`text-sm ${
                  isTechno ? 'text-[#00FF41]/70 font-mono' : isDarkTheme ? 'text-[#86868B]' : 'text-[#86868B]'
                }`}
              >
                Пар не найдено
              </p>
            </div>
          )}
        </ApplePullToRefresh>
      </div>

      {/* Floating Vertical Apple Date Rail on the right */}
      {isDateRailVisible && (
        <div className="shrink-0 h-full border-l border-white/5 bg-transparent">
          <AppleVerticalDateRail
            selectedIndex={selectedDayIndex}
            onSelectIndex={setSelectedDayIndex}
            accentColor={accentColor}
            isDarkTheme={isDarkTheme}
          />
        </div>
      )}

      {/* Lesson Details Dialog */}
      <LessonDetailModal
        lesson={selectedLesson}
        onClose={() => setSelectedLesson(null)}
        accentColor={accentColor}
      />
    </div>
  )
}
