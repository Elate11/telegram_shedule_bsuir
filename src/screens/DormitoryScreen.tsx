import React, { useState, useEffect } from 'react'
import { ArrowLeft, Home, Star } from 'lucide-react'
import { haptic } from '../services/telegram'
import { NetworkClient, BASE_URL, FALLBACK_DIRECT_BASE } from '../services/networkClient'

export interface IisDormitoryAppItem {
  id: number
  number?: number
  numberInQueue?: string
  status: string
  roomInfo?: string
  applicationDate: string
  acceptedDate?: string
  settledDate?: string
  rejectionReason?: string
}

export interface IisPrivilegeItem {
  id: number
  year?: number
  categoryName: string
  privilegeName: string
  note?: string
}

interface DormitoryScreenProps {
  onBack: () => void
  accentColor?: string
}

export const DormitoryScreen: React.FC<DormitoryScreenProps> = ({
  onBack,
  accentColor = '#2997FF'
}) => {
  const [selectedTab, setSelectedTab] = useState<0 | 1>(0)
  const [dorms, setDorms] = useState<IisDormitoryAppItem[]>([])
  const [privileges, setPrivileges] = useState<IisPrivilegeItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const parseDorm = (data: any): IisDormitoryAppItem[] => {
    const arr = Array.isArray(data) ? data : []
    return arr.map((obj: any, i: number) => ({
      id: obj.id || i,
      number: obj.number,
      numberInQueue: obj.numberInQueue?.toString(),
      status: obj.status || 'Заявление принято',
      roomInfo: obj.roomInfo,
      applicationDate: obj.applicationDate || '',
      acceptedDate: obj.acceptedDate,
      settledDate: obj.settledDate,
      rejectionReason: obj.rejectionReason
    }))
  }

  const parsePriv = (data: any): IisPrivilegeItem[] => {
    const arr = Array.isArray(data) ? data : []
    return arr.map((obj: any, i: number) => ({
      id: obj.id || i,
      year: obj.year,
      categoryName: obj.dormitoryPrivilegeCategoryName || 'Право на общежитие',
      privilegeName: obj.dormitoryPrivilegeName || '',
      note: obj.note
    }))
  }

  const loadData = async () => {
    setIsLoading(true)
    const cachedDorm = localStorage.getItem('cached_iis_dormitory')
    if (cachedDorm) {
      try { setDorms(parseDorm(JSON.parse(cachedDorm))) } catch {}
    }
    const cachedPriv = localStorage.getItem('cached_iis_privileges')
    if (cachedPriv) {
      try { setPrivileges(parsePriv(JSON.parse(cachedPriv))) } catch {}
    }

    try {
      const dormRes = await NetworkClient.executeWithAuth(`${BASE_URL}/dormitory-queue-application`).catch(() => {
        return NetworkClient.executeWithAuth(`${FALLBACK_DIRECT_BASE}/dormitory-queue-application`)
      })
      if (dormRes && dormRes.ok) {
        const json = await dormRes.json()
        localStorage.setItem('cached_iis_dormitory', JSON.stringify(json))
        setDorms(parseDorm(json))
      }

      const privRes = await NetworkClient.executeWithAuth(`${BASE_URL}/dormitory-queue-application/privileges`).catch(() => {
        return NetworkClient.executeWithAuth(`${FALLBACK_DIRECT_BASE}/dormitory-queue-application/privileges`)
      })
      if (privRes && privRes.ok) {
        const json = await privRes.json()
        localStorage.setItem('cached_iis_privileges', JSON.stringify(json))
        setPrivileges(parsePriv(json))
      }
    } catch (e) {
      console.warn('Dormitory fetch error', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
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
        <h1 className="text-xl font-bold tracking-tight">Общежитие и льготы</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center px-5 pt-3 gap-2">
        <button
          onClick={() => {
            haptic.click()
            setSelectedTab(0)
          }}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
            selectedTab === 0
              ? 'bg-white/10 text-white border border-white/20'
              : 'text-[#86868B] hover:text-white'
          }`}
        >
          Очередь ({dorms.length})
        </button>
        <button
          onClick={() => {
            haptic.click()
            setSelectedTab(1)
          }}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
            selectedTab === 1
              ? 'bg-white/10 text-white border border-white/20'
              : 'text-[#86868B] hover:text-white'
          }`}
        >
          Льготы ({privileges.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 pb-24">
        {selectedTab === 0 ? (
          dorms.length > 0 ? (
            <div className="space-y-3">
              {dorms.map((d) => (
                <div
                  key={d.id}
                  className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08] flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      Заявление #{d.number || d.id}
                    </h4>
                    <p className="text-xs text-[#86868B] mt-0.5">
                      {d.roomInfo || 'Общежитие'} • {d.applicationDate}
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 text-white">
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Home className="w-12 h-12 text-zinc-600 mb-3" />
              <h2 className="text-xl font-bold text-white mb-1">
                Нет заявлений на общежитие
              </h2>
              <p className="text-xs text-[#86868B] max-w-xs">
                Информация об очереди и заселении синхронизируется с ИИС
              </p>
            </div>
          )
        ) : privileges.length > 0 ? (
          <div className="space-y-3">
            {privileges.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08]"
              >
                <h4 className="text-sm font-semibold text-white">{p.categoryName}</h4>
                <p className="text-xs text-[#86868B] mt-0.5">{p.privilegeName}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Star className="w-12 h-12 text-zinc-600 mb-3" />
            <h2 className="text-xl font-bold text-white mb-1">
              Льготы не найдены
            </h2>
            <p className="text-xs text-[#86868B] max-w-xs">
              Подтвержденные социальные льготы отображаются здесь
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
