import React, { useState, useEffect } from 'react'
import { ArrowLeft, Bell, Check, Clock } from 'lucide-react'
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

  const parseNotifications = (data: any): DeanNotificationItem[] => {
    const arr = Array.isArray(data) ? data : (data?.notifications || data?.items || data?.content || [])
    return arr.map((item: any, i: number) => ({
      id: item.id || i,
      message: item.message || '',
      date: item.date || '',
      type: item.type || 'INFO',
      isViewed: item.isViewed ?? true
    })).filter((n: DeanNotificationItem) => Boolean(n.message))
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
        setNotifications(parseNotifications(json))
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

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-24">
        {notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08] flex flex-col space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs text-[#86868B]">
                  <span>{notif.type}</span>
                  <span>{notif.date}</span>
                </div>
                <p className="text-sm font-medium text-white leading-relaxed">
                  {notif.message}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Bell className="w-12 h-12 text-zinc-600 mb-3" />
            <h2 className="text-xl font-bold text-white mb-1">
              Нет новых уведомлений
            </h2>
            <p className="text-xs text-[#86868B] max-w-xs">
              Все важные объявления деканата будут отображаться здесь
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
