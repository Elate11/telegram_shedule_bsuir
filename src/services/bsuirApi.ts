import type { BsuirScheduleResponse, BsuirStudentGroup, BsuirEmployee, Lesson } from '../types'

// Use relative API path to benefit from Vite proxy in dev or CORS proxy in prod
const API_BASE = '/api/v1'
const FALLBACK_DIRECT_BASE = 'https://iis.bsuir.by/api/v1'

class BsuirApiService {
  private cachePrefix = 'bsuir_cache_'

  private getCached<T>(key: string): T | null {
    try {
      const data = localStorage.getItem(this.cachePrefix + key)
      return data ? JSON.parse(data) : null
    } catch {
      return null
    }
  }

  private setCache<T>(key: string, data: T): void {
    try {
      localStorage.setItem(this.cachePrefix + key, JSON.stringify(data))
    } catch (e) {
      console.warn('Storage quota exceeded', e)
    }
  }

  private async fetchWithFallback(url: string, headers: HeadersInit = {}): Promise<Response> {
    try {
      const res = await fetch(url, { headers })
      if (res.ok) return res
    } catch {
      // ignore and try fallback
    }

    // Try direct base
    const directUrl = url.replace(API_BASE, FALLBACK_DIRECT_BASE)
    return fetch(directUrl, { headers })
  }

  async getAllGroups(): Promise<BsuirStudentGroup[]> {
    const cached = this.getCached<BsuirStudentGroup[]>('all_groups')
    if (cached && cached.length > 0) {
      // Background revalidate
      this.fetchWithFallback(`${API_BASE}/student-groups`)
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) this.setCache('all_groups', data) })
        .catch(() => {})
      return cached
    }

    try {
      const res = await this.fetchWithFallback(`${API_BASE}/student-groups`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          this.setCache('all_groups', data)
          return data
        }
      }
    } catch (e) {
      console.error('Failed to fetch groups', e)
    }
    return []
  }

  async getAllEmployees(): Promise<BsuirEmployee[]> {
    const cached = this.getCached<BsuirEmployee[]>('all_employees')
    if (cached && cached.length > 0) {
      this.fetchWithFallback(`${API_BASE}/employees/all`)
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) this.setCache('all_employees', data) })
        .catch(() => {})
      return cached
    }

    try {
      const res = await this.fetchWithFallback(`${API_BASE}/employees/all`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          this.setCache('all_employees', data)
          return data
        }
      }
    } catch (e) {
      console.error('Failed to fetch employees', e)
    }
    return []
  }

  async getGroupSchedule(groupNumber: string): Promise<BsuirScheduleResponse | null> {
    const cacheKey = `sched_group_${groupNumber}`
    const cached = this.getCached<BsuirScheduleResponse>(cacheKey)

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4500)
      const res = await fetch(`${API_BASE}/schedule?studentGroup=${encodeURIComponent(groupNumber)}`, {
        signal: controller.signal
      }).catch(() => fetch(`${FALLBACK_DIRECT_BASE}/schedule?studentGroup=${encodeURIComponent(groupNumber)}`))
      clearTimeout(timer)

      if (res && res.ok) {
        const data: BsuirScheduleResponse = await res.json()
        this.setCache(cacheKey, data)
        return data
      }
    } catch (e) {
      console.warn('Network schedule fetch failed, using cache', e)
    }

    return cached
  }

  async getEmployeeSchedule(urlId: string): Promise<BsuirScheduleResponse | null> {
    const cacheKey = `sched_emp_${urlId}`
    const cached = this.getCached<BsuirScheduleResponse>(cacheKey)

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4500)
      const res = await fetch(`${API_BASE}/employees/schedule/${encodeURIComponent(urlId)}`, {
        signal: controller.signal
      }).catch(() => fetch(`${FALLBACK_DIRECT_BASE}/employees/schedule/${encodeURIComponent(urlId)}`))
      clearTimeout(timer)

      if (res && res.ok) {
        const data: BsuirScheduleResponse = await res.json()
        this.setCache(cacheKey, data)
        return data
      }
    } catch (e) {
      console.warn('Network employee schedule fetch failed', e)
    }

    return cached
  }

  async getCurrentWeek(): Promise<number> {
    try {
      const res = await this.fetchWithFallback(`${API_BASE}/schedule/current-week`)
      if (res.ok) {
        const txt = await res.text()
        const week = parseInt(txt.trim(), 10)
        if (!isNaN(week) && week >= 1 && week <= 4) return week
      }
    } catch {}
    return 1
  }

  // Parse Raw BSUIR response into standard Lesson list (1-to-1 with Kotlin parseScheduleResponse)
  parseScheduleResponse(resp: BsuirScheduleResponse | null): { lessons: Lesson[]; exams: Lesson[] } {
    if (!resp) return { lessons: [], exams: [] }

    const newLessons: Lesson[] = []
    const schedMap = (resp.schedules && Object.keys(resp.schedules).length > 0)
      ? resp.schedules
      : (resp.nextSchedules || {})

    Object.entries(schedMap).forEach(([dayName, dayLessons]) => {
      const dn = dayName.toLowerCase().trim()
      let dow = 0
      if (dn.includes('пон') || dn.includes('mon')) dow = 1
      else if (dn.includes('втор') || dn.includes('tue')) dow = 2
      else if (dn.includes('сред') || dn.includes('wed')) dow = 3
      else if (dn.includes('чет') || dn.includes('thu')) dow = 4
      else if (dn.includes('пят') || dn.includes('fri')) dow = 5
      else if (dn.includes('суб') || dn.includes('sat')) dow = 6
      else if (dn.includes('вос') || dn.includes('sun')) dow = 7

      dayLessons.forEach(bl => {
        const teacher = bl.employees?.[0]
        let teacherShort = ''
        if (teacher) {
          const ln = teacher.lastName || ''
          const fn = teacher.firstName ? `${teacher.firstName.charAt(0)}.` : ''
          const mn = teacher.middleName ? `${teacher.middleName.charAt(0)}.` : ''
          teacherShort = `${ln} ${fn}${mn}`.trim()
        }

        const aud = bl.auditories?.filter(Boolean).join(', ') || ''
        const subjectTitle = bl.subject?.trim()
          || bl.note?.trim()
          || bl.subjectFullName?.trim()
          || (bl.announcement ? 'Объявление' : 'Занятие')
        const lType = bl.lessonTypeAbbrev?.trim() || (bl.announcement ? 'Инфо' : '')

        const parts: string[] = []
        if (lType) parts.push(lType)
        if (teacherShort) parts.push(teacherShort)
        if (aud) parts.push(aud)
        if (bl.note?.trim() && subjectTitle !== bl.note.trim()) {
          parts.push(bl.note.trim())
        }
        const detailsStr = parts.join(' • ')
        const groupsList = bl.studentGroups?.map(g => g.name?.trim()).filter(Boolean) as string[] || []

        newLessons.push({
          startTime: bl.startLessonTime || '',
          endTime: bl.endLessonTime || '',
          title: subjectTitle,
          details: detailsStr,
          isActive: false,
          progress: null,
          subjectFullName: bl.subjectFullName || subjectTitle,
          lessonType: lType,
          teacherName: teacherShort,
          teacherFullName: teacher ? `${teacher.lastName || ''} ${teacher.firstName || ''} ${teacher.middleName || ''}`.trim() : teacherShort,
          teacherPhoto: teacher?.photoLink || (teacher?.id ? `https://iis.bsuir.by/api/v1/employees/photo/` : ''),
          teacherUrlId: teacher?.urlId || '',
          auditory: aud,
          subgroup: bl.numSubgroup || 0,
          weeks: bl.weekNumber || [],
          dayOfWeek: dow,
          dateLesson: bl.dateLesson || null,
          note: bl.note || null,
          studentGroups: groupsList
        })
      })
    })

    const parsedExams: Lesson[] = []
    resp.exams?.forEach(bl => {
      const teacher = bl.employees?.[0]
      let teacherShort = ''
      if (teacher) {
        const ln = teacher.lastName || ''
        const fn = teacher.firstName ? `${teacher.firstName.charAt(0)}.` : ''
        const mn = teacher.middleName ? `${teacher.middleName.charAt(0)}.` : ''
        teacherShort = `${ln} ${fn}${mn}`.trim()
      }
      const aud = bl.auditories?.filter(Boolean).join(', ') || ''
      const lType = bl.lessonTypeAbbrev?.trim() || 'Экзамен'
      const parts: string[] = [lType]
      if (teacherShort) parts.push(teacherShort)
      if (aud) parts.push(aud)
      const groupsList = bl.studentGroups?.map(g => g.name?.trim()).filter(Boolean) as string[] || []

      parsedExams.push({
        startTime: bl.startLessonTime || '',
        endTime: bl.endLessonTime || '',
        title: bl.subject || 'Экзамен',
        details: parts.join(' • '),
        isActive: false,
        progress: null,
        subjectFullName: bl.subjectFullName || bl.subject || 'Экзамен',
        lessonType: lType,
        teacherName: teacherShort,
        teacherFullName: teacher ? `${teacher.lastName || ''} ${teacher.firstName || ''} ${teacher.middleName || ''}`.trim() : teacherShort,
        teacherPhoto: teacher?.photoLink || (teacher?.id ? `https://iis.bsuir.by/api/v1/employees/photo/` : ''),
        teacherUrlId: teacher?.urlId || '',
        auditory: aud,
        subgroup: bl.numSubgroup || 0,
        weeks: bl.weekNumber || [1, 2, 3, 4],
        dayOfWeek: 0,
        dateLesson: bl.dateLesson || null,
        note: bl.note || null,
        studentGroups: groupsList
      })
    })

    return { lessons: newLessons, exams: parsedExams }
  }
}

export const bsuirApi = new BsuirApiService()
