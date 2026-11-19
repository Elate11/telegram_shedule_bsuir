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
      return h ? JSON.parse(h) : ['510902', '310101']
    } catch {
      return ['510902']
    }
  })

  // Calendar day calculation
  const dayInfo = getBsuirWeekForCalendarDay(selectedDayIndex)

  // Fetch groups and employees
  useEffect(() => {
    bsuirApi.getAllGroups().then(setAllGroups).catch(() => {})
    bsuirApi.getAllEmployees().then(setAllEmployees).catch(() => {})
  }, [])

  // Load schedule for group or teacher
  const loadSchedule = async () => {
    try {
      let resp
      if (inlineTeacher) {
        resp = await bsuirApi.getEmployeeSchedule(inlineTeacher.urlId)
      } else if (currentGroup) {
        resp = await bsuirApi.getGroupSchedule(currentGroup)
      }
      if (resp) {
        const parsed = bsuirApi.parseScheduleResponse(resp)
        setAllLessons(parsed.lessons)
        setExams(parsed.exams)
        setSessionPeriod({ start: resp.startExamsDate, end: resp.endExamsDate })
      }
    } catch (e) {
      console.error('Schedule fetch error', e)
    }
  }

  useEffect(() => {
    loadSchedule()
  }, [currentGroup, inlineTeacher])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadSchedule()
    setIsRefreshing(false)
  }

  // Filter lessons for selected day of week (1..7) and current week number (1..4)
  const dayLessons = React.useMemo(() => {
    return allLessons.filter(lesson => {
      // 1. Day of week check
      if (lesson.dayOfWeek !== dayInfo.dow) return false

      // 2. Week number check
      if (dayInfo.weekNum > 0 && lesson.weeks && lesson.weeks.length > 0) {
        if (!lesson.weeks.includes(dayInfo.weekNum)) return false
      }

      // 3. Subgroup filter
      if (subgroup !== 0 && lesson.subgroup !== 0 && lesson.subgroup !== subgroup) {
        return false
      }

      return true
    }).sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [allLessons, dayInfo, subgroup])

  const isTechno = styleType === 'Techno'

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden select-none">
      <ApplePullToRefresh
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        accentColor={accentColor}
        className="px-5 pt-4 pb-28 pr-16"
      >
        <div className="flex flex-col">
          {/* 1. Header: 2 учебная неделя (grey) (Kotlin lines 19100-19120) */}
          <div className="flex items-center justify-center mb-1">
            <span
              className={`text-sm font-medium ${
                isTechno ? 'text-[#00FF41]/80 font-mono text-base' : 'text-[#86868B]'
              }`}
            >
              {isTechno ? `> ${dayInfo.weekNum} УЧЕБНАЯ НЕДЕЛЯ_` : `${dayInfo.weekNum} учебная неделя`}
            </span>
          </div>

          {/* 2. Group Number or Teacher Name with Chevron (Kotlin lines 19120-19200) */}
          <div className="flex items-center justify-center mb-3">
            {inlineTeacher ? (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => {
                    haptic.click()
                    setInlineTeacher(null)
                  }}
                  className="p-1 rounded-full hover:bg-white/10 text-white"
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
                  className={`text-[33px] font-semibold tracking-tight ${
                    isTechno ? 'text-[#00FF41] font-mono' : isDarkTheme ? 'text-white' : 'text-[#1D1D1F]'
                  }`}
                >
                  {isTechno ? `> ${currentGroup}_` : currentGroup}
                </h1>
                {isGroupExpanded ? (
                  <ChevronUp className="w-6 h-6 text-[#86868B]" />
                ) : (
                  <ChevronDown className="w-6 h-6 text-[#86868B]" />
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
                className="overflow-hidden mb-4 rounded-3xl bg-[#272729] border border-white/10 p-4 shadow-xl"
              >
                {/* Search input */}
                <div className="relative mb-3">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Номер группы или преподавателя"
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
                            const newHist = [g.name, ...groupHistory.filter(h => h !== g.name)].slice(0, 5)
                            setGroupHistory(newHist)
                            localStorage.setItem('app_group_history', JSON.stringify(newHist))
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
                              const newHist = [e.fio || e.fullName || '', ...groupHistory.filter(h => h !== (e.fio || e.fullName))].slice(0, 5)
                              setGroupHistory(newHist)
                              localStorage.setItem('app_group_history', JSON.stringify(newHist))
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

          {/* 3. Subgroup Chips: [Все] [1 подгр.] [2 подгр.] (Centered pill row, Kotlin lines 37000-37030) */}
          <div className="flex items-center justify-center gap-2 mb-5">
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
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-[#2997FF] text-white shadow-sm'
                      : isDarkTheme
                        ? 'bg-[#272729] text-white border border-white/10 hover:bg-[#2A2A2C]'
                        : 'bg-white text-[#1D1D1F] border border-black/10'
                  }`}
                  style={isSelected ? { backgroundColor: accentColor, color: '#FFFFFF', borderColor: accentColor } : {}}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>

          {/* 4. Lessons List (Transparent rows, exact match to profile_verified_v1.png) */}
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
                    setSelectedLesson(lesson)
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <h2
                className={`text-2xl font-bold mb-1 ${
                  isTechno ? 'text-[#00FF41] font-mono' : isDarkTheme ? 'text-white' : 'text-[#1D1D1F]'
                }`}
              >
                Отличный день
              </h2>
              <p
                className={`text-sm ${
                  isTechno ? 'text-[#00FF41]/70 font-mono' : 'text-[#86868B]'
                }`}
              >
                Пар не найдено
              </p>
            </div>
          )}
        </div>
      </ApplePullToRefresh>

      {/* Vertical Date Rail on the right */}
      <AppleVerticalDateRail
        selectedIndex={selectedDayIndex}
        onSelectIndex={(idx: number) => {
          haptic.click()
          setSelectedDayIndex(idx)
        }}
        accentColor={accentColor}
        isDarkTheme={isDarkTheme}
        />

      {/* Detail Modal for Lesson */}
      <LessonDetailModal
        lesson={selectedLesson}
        onClose={() => setSelectedLesson(null)}
        accentColor={accentColor}
      />
    </div>
  )
}
