import React, { useState, useEffect } from 'react'
import { ArrowLeft, BookOpen, Award } from 'lucide-react'
import { haptic } from '../services/telegram'
import { NetworkClient, BASE_URL, FALLBACK_DIRECT_BASE } from '../services/networkClient'

export interface GradebookSubject {
  name: string
  mark: string
  formOfControl?: string
}

export interface GradebookSemester {
  semesterNumber: number
  title: string
  subjects: GradebookSubject[]
}

interface GradebookScreenProps {
  onBack: () => void
  accentColor?: string
}

export const GradebookScreen: React.FC<GradebookScreenProps> = ({
  onBack,
  accentColor = '#2997FF'
}) => {
  const [semesters, setSemesters] = useState<GradebookSemester[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const parseGradebook = (jsonStr: any): GradebookSemester[] => {
    try {
      const root = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
      const markPages = root?.markPages
      const result: GradebookSemester[] = []

      if (markPages && typeof markPages === 'object') {
        Object.entries(markPages).forEach(([key, page]: [string, any]) => {
          const semNum = parseInt(key, 10) || 1
          const marksArr = page?.marks || []
          const subs: GradebookSubject[] = []

          marksArr.forEach((mObj: any) => {
            const subject = mObj?.subject || 'Неизвестно'
            const rawMark = mObj?.mark?.toString() || ''
            const formOfControl = mObj?.formOfControl || ''
            const mark = (!rawMark || rawMark === 'null')
              ? (formOfControl ? `— (${formOfControl})` : '—')
              : rawMark
            subs.push({ name: subject, mark, formOfControl })
          })

          result.push({
            semesterNumber: semNum,
            title: `Семестр ${semNum}`,
            subjects: subs
          })
        })
      }
      return result.sort((a, b) => b.semesterNumber - a.semesterNumber)
    } catch {
      return []
    }
  }

  const loadGradebook = async () => {
    setIsLoading(true)
    const cached = localStorage.getItem('cached_gradebook')
    if (cached) {
      try {
        setSemesters(parseGradebook(cached))
      } catch {}
    }

    try {
      const url = `${BASE_URL}/markbook`
      const res = await NetworkClient.executeWithAuth(url).catch(() => {
        return NetworkClient.executeWithAuth(`${FALLBACK_DIRECT_BASE}/markbook`)
      })
      if (res && res.ok) {
        const json = await res.json()
        localStorage.setItem('cached_gradebook', JSON.stringify(json))
        setSemesters(parseGradebook(json))
      }
    } catch (e) {
      console.warn('Gradebook fetch error', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadGradebook()
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#101116] text-white overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center px-5 pt-4 pb-3 border-b border-white/[0.08]">
        <button
          onClick={() => {
            haptic.click()
            onBack()
          }}
          className="p-1 rounded-full hover:bg-white/10 text-white mr-3"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold tracking-tight">Электронная зачётка</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 pb-24">
        {semesters.length > 0 ? (
          semesters.map((sem) => (
            <div key={sem.semesterNumber} className="space-y-2">
              <span className="text-xs font-bold text-[#86868B] uppercase tracking-wider block px-1">
                {sem.title}
              </span>
              <div className="rounded-2xl bg-[#272729] border border-white/[0.08] overflow-hidden divide-y divide-white/[0.06]">
                {sem.subjects.map((sub, idx) => (
                  <div key={idx} className="p-3.5 flex items-center justify-between">
                    <span className="text-sm font-medium text-white pr-3">
                      {sub.name}
                    </span>
                    <span
                      className={`text-sm font-bold px-2.5 py-1 rounded-lg ${
                        sub.mark === '10' || sub.mark === '9' || sub.mark === 'зачет'
                          ? 'bg-[#30D158]/15 text-[#30D158]'
                          : sub.mark.includes('—')
                            ? 'bg-white/5 text-[#86868B]'
                            : 'bg-white/10 text-white'
                      }`}
                    >
                      {sub.mark}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BookOpen className="w-12 h-12 text-zinc-600 mb-3" />
            <h2 className="text-xl font-bold text-white mb-1">
              Нет данных зачётки
            </h2>
            <p className="text-xs text-[#86868B] max-w-xs">
              Оценки синхронизируются из ИИС БГУИР после сессии
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
