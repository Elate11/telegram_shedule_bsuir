import React, { useState } from 'react'
import { ArrowLeft, BadgeCheck, Share2 } from 'lucide-react'
import { haptic } from '../services/telegram'

interface IisResumeScreenProps {
  onBack: () => void
  accentColor?: string
}

export const IisResumeScreen: React.FC<IisResumeScreenProps> = ({
  onBack,
  accentColor = '#2997FF'
}) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#101116] text-white overflow-hidden select-none">
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
        <h1 className="text-xl font-bold tracking-tight">Резюме и виджет ИИС</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <BadgeCheck className="w-12 h-12 text-zinc-600 mb-3" />
          <h2 className="text-xl font-bold text-white mb-1">
            Публичное резюме студента
          </h2>
          <p className="text-xs text-[#86868B] max-w-xs">
            Настройка публичной визитки и портфолио в каталоге выпускников БГУИР
          </p>
        </div>
      </div>
    </div>
  )
}
