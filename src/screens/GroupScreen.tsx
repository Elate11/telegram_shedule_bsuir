import React, { useState, useEffect } from 'react'
import { ArrowLeft, Users, Phone, Mail, Search } from 'lucide-react'
import { haptic } from '../services/telegram'
import { NetworkClient, BASE_URL, FALLBACK_DIRECT_BASE } from '../services/networkClient'

export interface GroupCuratorInfo {
  fio: string
  position: string
  phone?: string
  email?: string
}

export interface GroupStudentInfo {
  fio: string
  position: number
  role?: string
  isCurrentUser?: boolean
}

interface GroupScreenProps {
  onBack: () => void
  currentGroup?: string
  accentColor?: string
}

export const GroupScreen: React.FC<GroupScreenProps> = ({
  onBack,
  currentGroup = '510902',
  accentColor = '#2997FF'
}) => {
  const [students, setStudents] = useState<GroupStudentInfo[]>([])
  const [curator, setCurator] = useState<GroupCuratorInfo | null>(null)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const parseUserGroupInfo = (jsonStr: any, currentUserFio: string): { cur: GroupCuratorInfo | null; sts: GroupStudentInfo[] } => {
    try {
      const root = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
      let cur: GroupCuratorInfo | null = null
      const curObj = root?.studentGroupCuratorDto
      if (curObj && curObj.fio) {
        cur = {
          fio: curObj.fio.trim(),
          position: curObj.position || 'Куратор',
          phone: curObj.phone?.trim(),
          email: curObj.email?.trim()
        }
      }

      const sts: GroupStudentInfo[] = []
      const arr = root?.groupInfoStudentDto
      if (Array.isArray(arr)) {
        arr.forEach((item: any, i: number) => {
          const fio = item?.fio?.trim()
          if (!fio) return
          const role = item?.position?.trim()
          const isMe = currentUserFio && (fio.toLowerCase().includes(currentUserFio.toLowerCase()) || currentUserFio.toLowerCase().includes(fio.toLowerCase()))
          sts.push({
            fio,
            position: i + 1,
            role: role || undefined,
            isCurrentUser: Boolean(isMe)
          })
        })
      }
      return { cur, sts }
    } catch {
      return { cur: null, sts: [] }
    }
  }

  const loadGroupData = async () => {
    setIsLoading(true)
    const myFio = localStorage.getItem('app_user_fio') || ''
    const cached = localStorage.getItem('cached_user_group_info')
    if (cached) {
      try {
        const { cur, sts } = parseUserGroupInfo(cached, myFio)
        if (cur) setCurator(cur)
        if (sts.length > 0) setStudents(sts)
      } catch {}
    }

    try {
      const url = `${BASE_URL}/student-groups/user-group-info`
      const res = await NetworkClient.executeWithAuth(url).catch(() => {
        return NetworkClient.executeWithAuth(`${FALLBACK_DIRECT_BASE}/student-groups/user-group-info`)
      })
      if (res && res.ok) {
        const json = await res.json()
        localStorage.setItem('cached_user_group_info', JSON.stringify(json))
        const { cur, sts } = parseUserGroupInfo(json, myFio)
        if (cur) setCurator(cur)
        if (sts.length > 0) setStudents(sts)
      }
    } catch (e) {
      console.warn('Group fetch error', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadGroupData()
  }, [currentGroup])

  const filteredStudents = students.filter(s =>
    s.fio.toLowerCase().includes(search.toLowerCase())
  )

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
          <p className="text-xs text-[#86868B]">Список одногруппников и куратор</p>
        </div>
      </div>

      {/* Curator card if present */}
      <div className="px-5 pt-3">
        {curator && (
          <div className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08] mb-3">
            <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider block mb-1">
              {curator.position}
            </span>
            <h3 className="text-base font-bold text-white">{curator.fio}</h3>
            {(curator.phone || curator.email) && (
              <div className="flex items-center gap-4 mt-2 text-xs text-[#2997FF]">
                {curator.phone && (
                  <a href={`tel:${curator.phone}`} className="flex items-center gap-1 hover:underline">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{curator.phone}</span>
                  </a>
                )}
                {curator.email && (
                  <a href={`mailto:${curator.email}`} className="flex items-center gap-1 hover:underline">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{curator.email}</span>
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Поиск по фамилии..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#272729] border border-white/[0.08] rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Students List */}
      <div className="flex-1 overflow-y-auto px-5 pb-24">
        {filteredStudents.length > 0 ? (
          <div className="space-y-2">
            {filteredStudents.map((st) => (
              <div
                key={st.position}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-colors ${
                  st.isCurrentUser
                    ? 'bg-[#2997FF]/15 border-[#2997FF]/40 text-white'
                    : 'bg-[#272729] border-white/[0.08]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs text-[#86868B]">
                    {st.position}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{st.fio}</h4>
                    {st.role && (
                      <span className="text-xs font-medium text-[#2997FF]">{st.role}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="w-12 h-12 text-zinc-600 mb-3" />
            <h2 className="text-xl font-bold text-white mb-1">
              Информация о группе
            </h2>
            <p className="text-xs text-[#86868B] max-w-xs">
              Список студентов группы {currentGroup} подгружается из официального сервиса ИИС БГУИР
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
