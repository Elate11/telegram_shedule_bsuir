import { NetworkClient } from './networkClient'
import type { BsuirScheduleResponse, BsuirStudentGroup, BsuirEmployee, Lesson } from '../types'

// Proxied via Vite dev server or direct fallback
const API_BASE = '/api/v1'
const FALLBACK_DIRECT_BASE = 'https://iis.bsuir.by/api/v1'

export interface RealOmissionLesson {
  subject: string
  lessonType: string
  dateString: string
  hours: number
  isRespectful: boolean
  note: string
  teacher: string
  monthName: string
}

export interface RealExcuseDocument {
  title: string
  note: string
  hoursClosed: number
  dates: string[]
}

export interface StudentProfileData {
  fio: string
  group: string
  faculty: string
  course: number
  photoUrl?: string
  desc: string
  unexcusedHours: number
  unreadNotifs: number
  isHeadman: boolean
}

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

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('app_auth_token') || ''
    const headers: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*'
    }
    if (token) {
      headers['Cookie'] = token
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  private async fetchWithFallback(url: string, headers: HeadersInit = {}): Promise<Response> {
    const mergedHeaders = { ...this.getAuthHeaders(), ...headers }
    try {
      const res = await fetch(url, { headers: mergedHeaders })
      if (res.ok) return res
    } catch {
      // ignore and try direct fallback
    }

    const directUrl = url.replace(API_BASE, FALLBACK_DIRECT_BASE)
    return fetch(directUrl, { headers: mergedHeaders })
  }

  async getAllGroups(): Promise<BsuirStudentGroup[]> {
    const cached = this.getCached<BsuirStudentGroup[]>('all_groups')
    if (cached && cached.length > 0) {
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
    const cleanGroup = groupNumber.trim()
    const cacheKey = `sched_group_${cleanGroup}`
    const cached = this.getCached<BsuirScheduleResponse>(cacheKey)

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4500)
      const res = await fetch(`${API_BASE}/schedule?studentGroup=${encodeURIComponent(cleanGroup)}`, {
        signal: controller.signal
      }).catch(() => fetch(`${FALLBACK_DIRECT_BASE}/schedule?studentGroup=${encodeURIComponent(cleanGroup)}`))
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
    const cleanId = urlId.trim()
    const cacheKey = `sched_emp_${cleanId}`
    const cached = this.getCached<BsuirScheduleResponse>(cacheKey)

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4500)
      const res = await fetch(`${API_BASE}/employees/schedule/${encodeURIComponent(cleanId)}`, {
        signal: controller.signal
      }).catch(() => fetch(`${FALLBACK_DIRECT_BASE}/employees/schedule/${encodeURIComponent(cleanId)}`))
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

  // 1-to-1 sync with Kotlin fetchAndStoreStudentProfile & MinProfileScreen data loader
  async fetchStudentProfile(): Promise<StudentProfileData | null> {
    let fio = localStorage.getItem('app_user_fio') || ''
    let group = localStorage.getItem('app_selected_group') || '510902'
    let faculty = localStorage.getItem('app_user_faculty') || ''
    let course = parseInt(localStorage.getItem('app_user_course') || '2', 10)
    let photoUrl = localStorage.getItem('app_user_photo') || ''
    let unexcusedHours = parseInt(localStorage.getItem('app_unexcused_hours') || '0', 10)
    let unreadNotifs = parseInt(localStorage.getItem('app_unread_notifs') || '0', 10)
    let isHeadman = localStorage.getItem('app_is_headman') === 'true'

    const token = localStorage.getItem('app_auth_token')

    // 1. If auth token exists, try /profiles/personal-cv
    if (token) {
      try {
        const cvRes = await this.fetchWithFallback(`${API_BASE}/profiles/personal-cv`)
        if (cvRes.ok) {
          const cvJson = await cvRes.json()
          if (cvJson) {
            const calculatedFio = cvJson.fio || [cvJson.lastName, cvJson.firstName, cvJson.middleName].filter(Boolean).join(' ')
            if (calculatedFio) fio = calculatedFio
            if (cvJson.studentGroup?.name || cvJson.studentGroup || cvJson.group) {
              group = cvJson.studentGroup?.name || cvJson.studentGroup || cvJson.group
            }
            if (cvJson.faculty || cvJson.facultyAbbrev) {
              faculty = cvJson.faculty || cvJson.facultyAbbrev
            }
            if (cvJson.course) course = cvJson.course
            if (cvJson.photoUrl || cvJson.photoLink) {
              photoUrl = cvJson.photoUrl || cvJson.photoLink
            }
          }
        }
      } catch {}

      // 2. Try /markbook if group or fio still empty
      try {
        const mbRes = await this.fetchWithFallback(`${API_BASE}/markbook`)
        if (mbRes.ok) {
          const mbJson = await mbRes.json()
          const student = mbJson?.student
          if (student) {
            const calculatedFio = student.fio || [student.lastName, student.firstName, student.middleName].filter(Boolean).join(' ')
            if (calculatedFio) fio = calculatedFio
            if (student.group || student.studentGroup) group = student.group || student.studentGroup
            if (student.facultyAbbrev) faculty = student.facultyAbbrev
            if (student.course) course = student.course
          }
        }
      } catch {}

      // 3. Try /notifications/notViewed/count
      try {
        const notifRes = await this.fetchWithFallback(`${API_BASE}/notifications/notViewed/count`)
        if (notifRes.ok) {
          const count = parseInt(await notifRes.text(), 10)
          if (!isNaN(count)) unreadNotifs = count
        }
      } catch {}

      // 4. Try /omissions to get unexcused hours
      try {
        const omRes = await this.fetchWithFallback(`${API_BASE}/omissions`)
        if (omRes.ok) {
          const omData = await omRes.json()
          const { unexcused } = this.parseOmissions(omData)
          unexcusedHours = unexcused
        }
      } catch {}
    }

    // Supplementary: Lookup faculty & course from student-groups if group known
    if (group && (!faculty || course <= 0)) {
      try {
        const allGrps = await this.getAllGroups()
        const match = allGrps.find(g => g.name === group)
        if (match) {
          if (match.facultyAbbrev) faculty = match.facultyAbbrev
          if (match.course) course = match.course
        }
      } catch {}
    }

    // Default fallback to Kotlin screenshot baseline if not logged in
    if (!fio) fio = 'Сороколетов Александр Александрович'
    if (!faculty) faculty = 'ФКП'
    if (!course) course = 2

    const desc = `${faculty} ${course > 0 ? `${course} курс` : ''}`.trim()

    localStorage.setItem('app_user_fio', fio)
    localStorage.setItem('app_selected_group', group)
    localStorage.setItem('app_user_faculty', faculty)
    localStorage.setItem('app_user_course', course.toString())
    localStorage.setItem('app_user_desc', desc)
    localStorage.setItem('app_unexcused_hours', unexcusedHours.toString())
    localStorage.setItem('app_unread_notifs', unreadNotifs.toString())
    localStorage.setItem('app_is_headman', isHeadman.toString())

    return {
      fio,
      group,
      faculty,
      course,
      photoUrl,
      desc,
      unexcusedHours,
      unreadNotifs,
      isHeadman
    }
  }

  // Parse omissions JSON into structured records (matches Kotlin parseOmissionsJson lines 5120-5210)
  parseOmissions(data: any): { total: number; unexcused: number; lessons: RealOmissionLesson[]; docs: RealExcuseDocument[] } {
    let tHours = 0
    let uHours = 0
    const parsedLessons: RealOmissionLesson[] = []
    const nowMonth = new Date().getMonth() + 1
    const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

    const rawList: any[] = Array.isArray(data)
      ? data
      : (data?.omissions || data?.items || [])

    rawList.forEach((entry: any) => {
      const student = entry.student
      const lessonsArray = student?.lessons || (entry.gradeBookOmissions !== undefined || entry.missedHours !== undefined ? [entry] : [])

      lessonsArray.forEach((l: any) => {
        const omissions = l.gradeBookOmissions ?? l.missedHours ?? l.omissions ?? 0
        const isRespectful = Boolean(l.isRespectfulOmission ?? l.respectful ?? false)
        const dateString = l.dateString || l.date || ''
        const subject = l.nameLesson || l.subject || l.lessonName || 'Учебное занятие'
        const lessonType = l.lessonType || l.type || 'ПЗ'
        const note = l.note || l.reason || l.comment || ''
        const teacher = l.teacher || l.employee || ''

        let mName = 'Другое'
        let lMonth: number | null = null
        if (dateString.length >= 5) {
          const parts = dateString.split(/[\.-]/)
          if (parts.length >= 2) {
            lMonth = parts[0].length === 4 ? parseInt(parts[1], 10) : parseInt(parts[1], 10)
            if (lMonth && lMonth >= 1 && lMonth <= 12) {
              mName = monthNames[lMonth - 1]
            }
          }
        }

        tHours += omissions
        if (!isRespectful && (lMonth === null || lMonth === nowMonth)) {
          uHours += omissions
        }

        if (omissions > 0) {
          parsedLessons.push({
            subject,
            lessonType,
            dateString,
            hours: omissions,
            isRespectful,
            note,
            teacher,
            monthName: mName
          })
        }
      })
    })

    // Group respectful lessons into documents (matches Kotlin lines 5210-5235)
    const docsMap = new Map<string, RealOmissionLesson[]>()
    parsedLessons.filter(l => l.isRespectful).forEach(rl => {
      const key = rl.note?.trim() || 'Справка / Заявление в деканат'
      if (!docsMap.has(key)) docsMap.set(key, [])
      docsMap.get(key)!.push(rl)
    })

    const parsedDocs: RealExcuseDocument[] = []
    docsMap.forEach((list, key) => {
      const isMed = key.toLowerCase().includes('справ') || key.includes('095')
      const isZayv = key.toLowerCase().includes('заявл')
      parsedDocs.push({
        title: isMed ? 'Медицинская справка' : isZayv ? 'Заявление деканата' : 'Оправдательный документ',
        note: key,
        hoursClosed: list.reduce((acc, curr) => acc + curr.hours, 0),
        dates: Array.from(new Set(list.map(l => l.dateString).filter(Boolean))).slice(0, 4)
      })
    })

    return { total: tHours, unexcused: uHours, lessons: parsedLessons, docs: parsedDocs }
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
