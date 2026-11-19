import React, { useState, useEffect } from 'react'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { haptic } from '../services/telegram'
import { NetworkClient, BASE_URL, FALLBACK_DIRECT_BASE } from '../services/networkClient'

export interface IisPenaltyItem {
  id: number
  type: string
  reason: string
  status: string
  date: string
  directiveNumber?: string
  note?: string
}

interface PenaltiesScreenProps {
  onBack: () => void
  accentColor?: string
}

export const PenaltiesScreen: React.FC<PenaltiesScreenProps> = ({
  onBack,
  accentColor = '#2997FF'
}) => {
  const [penalties, setPenalties] = useState<IisPenaltyItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const parsePenalties = (data: any): IisPenaltyItem[] => {
    const arr = Array.isArray(data) ? data : []
    return arr.map((obj: any, i: number) => {
      const dir = obj.directiveDto
      return {
        id: obj.id || i,
        type: dir?.typeName || dir?.type || obj.type || 'Запись',
        reason: obj.reason && obj.reason !== 'null' ? obj.reason : '',
        status: obj.status && obj.status !== 'null' ? obj.status : '',
        date: dir?.date || obj.date || '',
        directiveNumber: dir?.number || '',
        note: obj.note && obj.note !== 'null' ? obj.note : ''
      }
    })
  }

  const loadPenalties = async () => {
    setIsLoading(true)
    const cached = localStorage.getItem('cached_iis_penalties')
    if (cached) {
      try { setPenalties(parsePenalties(JSON.parse(cached))) } catch {}
    }

    try {
      const url = `${BASE_URL}/dormitory-queue-application/premium-penalty`
      const res = await NetworkClient.executeWithAuth(url).catch(() => {
        return NetworkClient.executeWithAuth(`${FALLBACK_DIRECT_BASE}/dormitory-queue-application/premium-penalty`)
      })
      if (res && res.ok) {
        const json = await res.json()
        localStorage.setItem('cached_iis_penalties', JSON.stringify(json))
        setPenalties(parsePenalties(json))
      }
    } catch (e) {
      console.warn('Penalties fetch error', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadPenalties()
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
        <h1 className="text-xl font-bold tracking-tight">Взыскания и поощрения</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-24">
        {penalties.length > 0 ? (
          <div className="space-y-3">
            {penalties.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08] space-y-1"
              >
                <div className="flex items-center justify-between text-xs text-[#86868B]">
                  <span>{item.type}</span>
                  <span>{item.date}</span>
                </div>
                {item.reason && (
                  <p className="text-sm font-semibold text-white">{item.reason}</p>
                )}
                {item.note && (
                  <p className="text-xs text-[#86868B]">{item.note}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <AlertTriangle className="w-12 h-12 text-zinc-600 mb-3" />
            <h2 className="text-xl font-bold text-white mb-1">
              Взысканий и поощрений нет
            </h2>
            <p className="text-xs text-[#86868B] max-w-xs">
              Приказы и выговоры деканата синхронизируются с ИИС
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
