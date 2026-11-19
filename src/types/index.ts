// BSUIR API Data Contracts

export interface BsuirEmployee {
  firstName?: string
  lastName?: string
  middleName?: string
  photoLink?: string
  degree?: string
  rank?: string
  id?: number
  urlId?: string
  fio?: string
  fullName?: string
  academicDepartment?: string[]
}

export interface BsuirStudentGroup {
  name: string
  facultyAbbrev?: string
  specialityAbbrev?: string
  course?: number
  id?: number
  calendarId?: string
}

export interface BsuirLesson {
  subject?: string
  subjectFullName?: string
  lessonTypeAbbrev?: string
  startLessonTime?: string
  endLessonTime?: string
  numSubgroup?: number
  weekNumber?: number[]
  auditories?: string[]
  employees?: BsuirEmployee[]
  studentGroups?: BsuirStudentGroup[]
  dateLesson?: string
  startLessonDate?: string
  endLessonDate?: string
  note?: string
  announcement?: boolean
}

export interface BsuirScheduleResponse {
  schedules?: Record<string, BsuirLesson[]>
  nextSchedules?: Record<string, BsuirLesson[]>
  exams?: BsuirLesson[]
  currentWeekNumber?: number
  studentGroupDto?: BsuirStudentGroup
  employeeDto?: BsuirEmployee
  startDate?: string
  endDate?: string
  startExamsDate?: string
  endExamsDate?: string
  currentTerm?: string
  nextTerm?: string
}

// App Normalized Models

export interface Lesson {
  startTime: string
  endTime: string
  title: string
  details: string
  isActive?: boolean
  progress?: number | null
  subjectFullName: string
  lessonType: string
  teacherName: string
  teacherFullName: string
  teacherPhoto: string
  teacherUrlId: string
  auditory: string
  subgroup: number
  weeks: number[]
  dayOfWeek: number
  dateLesson?: string | null
  note?: string | null
  studentGroups: string[]
}

export interface Note {
  id: string
  subject: string
  text: string
  timestamp: number
  lessonTime?: string
  lessonType?: string
  reminderTime?: number | null
}

export interface SubjectProgress {
  subjectName: string
  totalHours: number
  completedHours: number
  marks: Array<{
    value: string
    date: string
    type?: string
  }>
  finalMark?: string
  rating?: number
}

export interface UserProfile {
  fio: string
  group: string
  faculty: string
  course: number
  speciality: string
  photo?: string
  isHeadman: boolean
  unexcusedHours: number
  notificationsCount: number
}

export type StyleType = 'Minimal' | 'Techno'
export type NavigationMode = 'Hold' | 'Swipe' | 'Buttons'
export type TransitionType = 'Slide' | 'Fade' | 'Scale' | 'Cube' | 'Flip'
