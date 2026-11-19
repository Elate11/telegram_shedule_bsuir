import React, { useState, useEffect } from 'react'
import { ArrowLeft, FileText, CheckCircle, Clock } from 'lucide-react'
import { haptic } from '../services/telegram'
import { bsuirApi, type RealOmissionLesson, type RealExcuseDocument } from '../services/bsuirApi'

interface AbsencesScreenProps {
  onBack: () => void
  accentColor?: string
}

export const AbsencesScreen: React.FC<AbsencesScreenProps> = ({
  onBack,
  accentColor = '#2997FF'
}) => {
  const [totalHours, setTotalHours] = useState(0)
  const [unexcusedHours, setUnexcusedHours] = useState(0)
  const [excuseHours, setExcuseHours] = useState(0)
  const [lessons, setLessons] = useState<RealOmissionLesson[]>([])
  const [documents, setDocuments] = useState<RealExcuseDocument[]>([])
  const [selectedTab, setSelectedTab] = useState<'docs' | 'memo'>('docs')

  const months = ['Сен', 'Окт', 'Ноя', 'Дек', 'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн']

  useEffect(() => {
    // Check cached omissions or load from API
    const cached = localStorage.getItem('bsuir_cache_omissions')
    if (cached) {
      try {
        const parsed = bsuirApi.parseOmissions(JSON.parse(cached))
        setTotalHours(parsed.total)
        setUnexcusedHours(parsed.unexcused)
        setExcuseHours(Math.max(0, parsed.total - parsed.unexcused))
        setLessons(parsed.lessons)
        setDocuments(parsed.docs)
      } catch {}
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#101116] text-white overflow-hidden select-none">
      {/* Header (matches absences_verified_v3.png) */}
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
        <h1 className="text-xl font-bold tracking-tight">Пропуски и справки</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 pb-24">
        {/* 3 Metric cards */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-3 rounded-2xl bg-[#272729] border border-white/[0.08]">
            <span className="text-2xl font-bold text-white block">{unexcusedHours} ч</span>
            <span className="text-[11px] font-medium text-[#86868B] leading-tight block mt-1">За этот месяц</span>
          </div>
          <div className="p-3 rounded-2xl bg-[#272729] border border-white/[0.08]">
            <span className="text-2xl font-bold text-[#30D158] block">{excuseHours} ч</span>
            <span className="text-[11px] font-medium text-[#86868B] leading-tight block mt-1">По справкам</span>
          </div>
          <div className="p-3 rounded-2xl bg-[#272729] border border-white/[0.08]">
            <span className="text-2xl font-bold text-white block">{totalHours} ч</span>
            <span className="text-[11px] font-medium text-[#86868B] leading-tight block mt-1">Всего за семестр</span>
          </div>
        </div>

        {/* График по месяцам */}
        <div className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08]">
          <span className="text-xs font-semibold text-[#86868B] uppercase tracking-wider block mb-3">
            График по месяцам
          </span>
          <div className="flex items-center justify-between text-xs text-[#86868B] mb-3">
            {months.map(m => (
              <span key={m} className="px-1">{m}</span>
            ))}
          </div>
          <div className="flex items-center gap-4 text-[11px] text-[#86868B]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#30D158]" />
              <span>Уважительные (справки)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF453A]" />
              <span>Без ув. причины</span>
            </div>
          </div>
        </div>

        {/* Tab switcher: Оправдательные документы / Памятка */}
        <div className="flex items-center gap-3 border-b border-white/[0.08] pb-2">
          <button
            onClick={() => {
              haptic.click()
              setSelectedTab('docs')
            }}
            className={`text-sm font-semibold transition-colors ${
              selectedTab === 'docs' ? 'text-white border-b-2 border-white pb-1' : 'text-[#86868B]'
            }`}
          >
            Оправдательные документы
          </button>
          <button
            onClick={() => {
              haptic.click()
              setSelectedTab('memo')
            }}
            className={`text-sm font-semibold transition-colors ${
              selectedTab === 'memo' ? 'text-white border-b-2 border-white pb-1' : 'text-[#86868B]'
            }`}
          >
            Памятка
          </button>
        </div>

        {/* List of documents or Memo */}
        {selectedTab === 'docs' ? (
          documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map((doc, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08] flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-[#2997FF]" />
                    <div>
                      <h4 className="text-sm font-semibold text-white">{doc.title}</h4>
                      <p className="text-xs text-[#86868B]">{doc.note}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/10 text-white">
                    {doc.hoursClosed} ч
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="w-10 h-10 text-zinc-600 mb-2" />
              <p className="text-sm font-medium text-white">Документов не найдено</p>
              <p className="text-xs text-[#86868B] mt-0.5">Оправдательные документы синхронизируются с ИИС</p>
            </div>
          )
        ) : (
          <div className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08] text-xs text-[#86868B] space-y-2 leading-relaxed">
            <p>1. Справка о временной нетрудоспособности предоставляется в деканат в течение 3 рабочих дней после окончания болезни.</p>
            <p>2. Заявления на освобождение от занятий подаются заблаговременно.</p>
          </div>
        )}
      </div>
    </div>
  )
}
