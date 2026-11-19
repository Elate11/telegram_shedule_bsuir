import React, { useState, useEffect } from 'react'
import { ArrowLeft, Users, Shield, Award } from 'lucide-react'
import { haptic } from '../services/telegram'

interface StudentItem {
  id: number
  fio: string
  position?: string
  rating?: number
  isHeadman?: boolean
}

interface GroupScreenProps {
  onBack: () => void
  currentGroup?: string
  accentColor?: string
}

export const GroupScreen: React.FC<GroupScreenProps> = ({
  onBack,
  currentGroup = '114001',
  accentColor = '#2997FF'
}) => {
  const [students, setStudents] = useState<StudentItem[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    // Attempt local load or cache
    const cached = localStorage.getItem('app_group_students')
    if (cached) {
      try {
        setStudents(JSON.parse(cached))
      } catch {}
    }
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
        <div>
          <h1 className="text-xl font-bold tracking-tight">Группа {currentGroup}</h1>
          <p className="text-xs text-[#86868B]">Список одногруппников и старостат</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {students.length > 0 ? (
          <div className="space-y-2.5">
            {students.map((st, i) => (
              <div
                key={st.id || i}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[#272729] border border-white/[0.08]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center font-bold text-sm">
                    {st.fio.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{st.fio}</h4>
                    {st.position && (
                      <span className="text-xs text-[#2997FF]">{st.position}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Users className="w-12 h-12 text-zinc-600 mb-3" />
            <h2 className="text-xl font-bold text-white mb-1">
              Информация о группе
            </h2>
            <p className="text-xs text-[#86868B] max-w-xs">
              Список студентов группы {currentGroup} подгружается при авторизации в личном кабинете ИИС
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
