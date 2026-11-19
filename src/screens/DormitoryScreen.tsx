import React, { useState } from 'react'
import { ArrowLeft, Home, Star } from 'lucide-react'
import { haptic } from '../services/telegram'

interface DormitoryScreenProps {
  initialTab?: 0 | 1 // 0 = Общежитие, 1 = Льготы
  onBack: () => void
  accentColor?: string
}

export const DormitoryScreen: React.FC<DormitoryScreenProps> = ({
  initialTab = 0,
  onBack,
  accentColor = '#2997FF'
}) => {
  const [selectedTab, setSelectedTab] = useState<0 | 1>(initialTab)

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
        <h1 className="text-xl font-bold tracking-tight">
          {selectedTab === 0 ? 'Общежитие' : 'Льготы'}
        </h1>
      </div>

      {/* Tabs */}
      <div className="px-5 pt-3 pb-2">
        <div className="flex bg-[#272729] p-1 rounded-2xl border border-white/[0.08]">
          <button
            onClick={() => {
              haptic.click()
              setSelectedTab(0)
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
              selectedTab === 0 ? 'bg-white text-black shadow-sm' : 'text-[#86868B]'
            }`}
          >
            Общежитие
          </button>
          <button
            onClick={() => {
              haptic.click()
              setSelectedTab(1)
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
              selectedTab === 1 ? 'bg-white text-black shadow-sm' : 'text-[#86868B]'
            }`}
          >
            Льготы
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          {selectedTab === 0 ? (
            <Home className="w-12 h-12 text-zinc-600 mb-3" />
          ) : (
            <Star className="w-12 h-12 text-zinc-600 mb-3" />
          )}
          <h2 className="text-xl font-bold text-white mb-1">
            {selectedTab === 0 ? 'Очередь на общежитие' : 'Категории льгот'}
          </h2>
          <p className="text-xs text-[#86868B] max-w-xs">
            {selectedTab === 0
              ? 'Статус заявления и номер в очереди синхронизируются с жилищной комиссией'
              : 'Подтвержденные социальные льготы и документы студента'}
          </p>
        </div>
      </div>
    </div>
  )
}
