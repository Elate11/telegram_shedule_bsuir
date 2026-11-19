import React, { useState, useEffect } from 'react'
import { ArrowLeft, Info } from 'lucide-react'
import { haptic } from '../services/telegram'
import { NetworkClient, BASE_URL, FALLBACK_DIRECT_BASE } from '../services/networkClient'

export interface AnnouncementItem {
  id: number
  title: string
  content: string
  date: string
}

interface AnnouncementsScreenProps {
  onBack: () => void
  accentColor?: string
}

export const AnnouncementsScreen: React.FC<AnnouncementsScreenProps> = ({
  onBack,
  accentColor = '#2997FF'
}) => {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const parseAnnouncements = (data: any): AnnouncementItem[] => {
    const arr = Array.isArray(data) ? data : (data?.content || data?.items || [])
    return arr.map((obj: any, i: number) => ({
      id: obj.id || i,
      title: obj.title || obj.name || 'Объявление',
      content: obj.content || obj.description || obj.text || '',
      date: obj.date || obj.dateString || ''
    })).filter((a: AnnouncementItem) => Boolean(a.content || a.title))
  }

  const loadAnnouncements = async () => {
    setIsLoading(true)
    const cached = localStorage.getItem('cached_iis_announcements')
    if (cached) {
      try { setAnnouncements(parseAnnouncements(JSON.parse(cached))) } catch {}
    }

    try {
      const url = `${BASE_URL}/announcements?page=0&size=20`
      const res = await NetworkClient.executeWithAuth(url).catch(() => {
        return NetworkClient.executeWithAuth(`${FALLBACK_DIRECT_BASE}/announcements?page=0&size=20`)
      })
      if (res && res.ok) {
        const json = await res.json()
        localStorage.setItem('cached_iis_announcements', JSON.stringify(json))
        setAnnouncements(parseAnnouncements(json))
      }
    } catch (e) {
      console.warn('Announcements fetch error', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAnnouncements()
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
        <h1 className="text-xl font-bold tracking-tight">Объявления университета</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-24">
        {announcements.length > 0 ? (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div
                key={a.id}
                className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08] space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs text-[#86868B]">
                  <span className="font-semibold text-white">{a.title}</span>
                  <span>{a.date}</span>
                </div>
                <p className="text-sm text-[#CCCCCC] leading-relaxed whitespace-pre-wrap">
                  {a.content}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Info className="w-12 h-12 text-zinc-600 mb-3" />
            <h2 className="text-xl font-bold text-white mb-1">
              Нет актуальных объявлений
            </h2>
            <p className="text-xs text-[#86868B] max-w-xs">
              Все официальные новости и объявления БГУИР отображаются здесь
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
