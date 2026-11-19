import React, { useState } from 'react'
import { ArrowLeft, BookOpen, Star } from 'lucide-react'
import { haptic } from '../services/telegram'

interface GradebookScreenProps {
  onBack: () => void
  accentColor?: string
}

export const GradebookScreen: React.FC<GradebookScreenProps> = ({
  onBack,
  accentColor = '#2997FF'
}) => {
  const [semesters] = useState<Array<{ name: string; marks: Array<{ subject: string; mark: string }> }>>([])

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
        <h1 className="text-xl font-bold tracking-tight">Электронная зачётка</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {semesters.length > 0 ? (
          <div className="space-y-4">
            {semesters.map((sem, idx) => (
              <div key={idx} className="rounded-2xl bg-[#272729] border border-white/[0.08] p-4">
                <h3 className="text-base font-bold text-white mb-2">{sem.name}</h3>
                <div className="space-y-2">
                  {sem.marks.map((m, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="text-zinc-300">{m.subject}</span>
                      <span className="font-bold text-white px-2 py-0.5 rounded bg-white/10">{m.mark}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BookOpen className="w-12 h-12 text-zinc-600 mb-3" />
            <h2 className="text-xl font-bold text-white mb-1">
              Зачётная книжка
            </h2>
            <p className="text-xs text-[#86868B] max-w-xs">
              Оценки за все семестры загружаются из базы данных деканата
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
