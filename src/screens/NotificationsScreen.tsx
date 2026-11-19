import React, { useState } from 'react'
import { ArrowLeft, Bell, Info, CheckCircle, AlertTriangle } from 'lucide-react'
import { haptic } from '../services/telegram'

interface NotificationItem {
  id: number
  title: string
  message: string
  date: string
  isViewed: boolean
  type?: string
}

interface NotificationsScreenProps {
  onBack: () => void
  accentColor?: string
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  onBack,
  accentColor = '#2997FF'
}) => {
  const [notifications] = useState<NotificationItem[]>([])

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

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div key={n.id} className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08]">
                <h4 className="text-sm font-bold text-white mb-1">{n.title}</h4>
                <p className="text-xs text-zinc-300">{n.message}</p>
                <span className="text-[10px] text-zinc-500 mt-2 block">{n.date}</span>
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
              Все важные объявления деканата и ректората будут появляться здесь
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
