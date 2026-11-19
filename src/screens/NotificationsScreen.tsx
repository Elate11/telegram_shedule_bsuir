import React, { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Bell, Search, CheckCircle, Info, AlertTriangle, XCircle } from 'lucide-react'
import { haptic } from '../services/telegram'
import { NetworkClient, BASE_URL, FALLBACK_DIRECT_BASE } from '../services/networkClient'

export interface DeanNotificationItem {
  id: number
  message: string
  date: string
  type: string
  isViewed: boolean
}

interface NotificationsScreenProps {
  onBack: () => void
  accentColor?: string
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  onBack,
  accentColor = '#2997FF'
}) => {
  const [notifications, setNotifications] = useState<DeanNotificationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedFilter, setSelectedFilter] = useState<'Все' | 'Инфо' | 'Успешно' | 'Важное'>('Все')
  const [searchQuery, setSearchQuery] = useState('')

  const parseNotifications = (data: any): DeanNotificationItem[] => {
    const arr = Array.isArray(data) ? data : (data?.notifications || data?.items || data?.content || [])
    return arr.map((item: any, i: number) => ({
      id: item.id || i,
      message: item.message || '',
      date: item.date || '',
      type: (item.type || 'INFO').toUpperCase(),
      isViewed: item.isViewed ?? true
    })).filter((n: DeanNotificationItem) => Boolean(n.message))
  }

  // Exact 1-to-1 match to Kotlin markDeanNotificationsAsRead
  const markAsRead = async (unreadIds: number[]) => {
    if (unreadIds.length === 0) return
    try {
      const payload = unreadIds.map(id => ({ id, isViewed: true }))
      const url = `${BASE_URL}/notifications`
      await NetworkClient.executeWithAuth(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload)
      }).catch(() => {
        return NetworkClient.executeWithAuth(`${FALLBACK_DIRECT_BASE}/notifications`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(payload)
        })
      })
      localStorage.setItem('app_unread_notifs', '0')
    } catch {}
  }

  const loadNotifications = async () => {
    setIsLoading(true)
    const cached = localStorage.getItem('cached_dean_notifications')
    if (cached) {
      try {
        setNotifications(parseNotifications(JSON.parse(cached)))
      } catch {}
    }

    try {
      const url = `${BASE_URL}/notifications?pageNumber=0&pageSize=50`
      const res = await NetworkClient.executeWithAuth(url).catch(() => {
        return NetworkClient.executeWithAuth(`${FALLBACK_DIRECT_BASE}/notifications?pageNumber=0&pageSize=50`)
      })
      if (res && res.ok) {
        const json = await res.json()
        localStorage.setItem('cached_dean_notifications', JSON.stringify(json))
        const parsed = parseNotifications(json)
        setNotifications(parsed)

        const unread = parsed.filter(n => !n.isViewed).map(n => n.id)
        if (unread.length > 0) {
          markAsRead(unread)
        }
      }
    } catch (e) {
      console.warn('Notifications fetch error', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  // Filtering matches Kotlin lines 10320-10335
  const filteredList = useMemo(() => {
    let list = notifications
    if (selectedFilter === 'Инфо') {
      list = list.filter(n => n.type === 'INFO')
    } else if (selectedFilter === 'Успешно') {
      list = list.filter(n => n.type === 'SUCCESS')
    } else if (selectedFilter === 'Важное') {
      list = list.filter(n => n.type === 'FAILURE' || n.type === 'WARNING')
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(n => n.message.toLowerCase().includes(q) || n.date.includes(q))
    }
    return list
  }, [notifications, selectedFilter, searchQuery])

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
        <h1 className="text-xl font-bold tracking-tight">Уведомления деканата</h1>
      </div>

      <div className="px-5 pt-3 pb-2 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Поиск сообщений..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#272729] border border-white/[0.08] rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none"
          />
        </div>

        {/* Filter Pills (matches Kotlin lines 10310-10325) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {(['Все', 'Инфо', 'Успешно', 'Важное'] as const).map(f => (
            <button
              key={f}
              onClick={() => {
                haptic.click()
                setSelectedFilter(f)
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                selectedFilter === f
                  ? 'bg-white text-black border-white'
                  : 'bg-[#272729] text-[#86868B] border-white/[0.08] hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 py-2 pb-24 space-y-3">
        {filteredList.length > 0 ? (
          filteredList.map((notif) => {
            const isSuccess = notif.type === 'SUCCESS'
            const isWarn = notif.type === 'WARNING' || notif.type === 'FAILURE'
            return (
              <div
                key={notif.id}
                className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08] space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {isSuccess ? (
                      <CheckCircle className="w-3.5 h-3.5 text-[#30D158]" />
                    ) : isWarn ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-[#FF9F0A]" />
                    ) : (
                      <Info className="w-3.5 h-3.5 text-[#2997FF]" />
                    )}
                    <span
                      className={`font-semibold ${
                        isSuccess ? 'text-[#30D158]' : isWarn ? 'text-[#FF9F0A]' : 'text-[#2997FF]'
                      }`}
                    >
                      {notif.type}
                    </span>
                  </div>
                  <span className="text-[#86868B]">{notif.date}</span>
                </div>
                <p className="text-sm font-medium text-white leading-relaxed">
                  {notif.message}
                </p>
              </div>
            )
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Bell className="w-12 h-12 text-zinc-600 mb-3" />
            <h2 className="text-xl font-bold text-white mb-1">
              Нет уведомлений
            </h2>
            <p className="text-xs text-[#86868B] max-w-xs">
              Все важные сообщения деканата будут отображаться здесь
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
