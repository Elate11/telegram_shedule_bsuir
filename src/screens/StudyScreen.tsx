import React, { useState, useEffect } from 'react'
import { ArrowLeft, Plus, FileText, CheckCircle, Clock, X, ChevronRight } from 'lucide-react'
import { haptic } from '../services/telegram'

interface CertificateItem {
  id: number
  number: number
  certificateType: string
  provisionPlace: string
  dateOrder: string
  issueDate?: string
  status: number // 0 = Отклонено, 1 = Готово, 2 = На рассмотрении
  rejectionReason?: string
}

interface MarkSheetItem {
  id: number
  number: number
  subjectName: string
  term: number
  status: number
  hours: number
}

interface StudyScreenProps {
  onBack: () => void
  accentColor?: string
  isDarkTheme?: boolean
}

export const StudyScreen: React.FC<StudyScreenProps> = ({
  onBack,
  accentColor = '#2997FF',
  isDarkTheme = true
}) => {
  const [selectedTab, setSelectedTab] = useState<0 | 1>(0) // 0: Справки, 1: Ведомости
  const [certificates, setCertificates] = useState<CertificateItem[]>([])
  const [markSheets, setMarkSheets] = useState<MarkSheetItem[]>([])
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [orderPlace, setOrderPlace] = useState('')
  const [orderCount, setOrderCount] = useState(1)

  const handleOrderCert = () => {
    if (!orderPlace.trim()) return
    haptic.success()
    const newCert: CertificateItem = {
      id: Date.now(),
      number: certificates.length + 1,
      certificateType: 'обычная',
      provisionPlace: orderPlace.trim(),
      dateOrder: new Date().toLocaleDateString('ru-RU'),
      status: 2
    }
    setCertificates([newCert, ...certificates])
    setOrderPlace('')
    setShowOrderModal(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#101116] text-white overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              haptic.click()
              onBack()
            }}
            className="p-1 rounded-full hover:bg-white/10 text-white"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">Учёба и справки</h1>
        </div>

        {selectedTab === 0 && (
          <button
            onClick={() => {
              haptic.click()
              setShowOrderModal(true)
            }}
            className="p-2 rounded-xl text-white active:scale-95 transition-transform"
            style={{ backgroundColor: accentColor }}
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Tabs Switcher: [Справки] [Ведомости] */}
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
            Справки
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
            Ведомости
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {selectedTab === 0 ? (
          certificates.length > 0 ? (
            <div className="space-y-3">
              {certificates.map((cert) => (
                <div
                  key={cert.id}
                  className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08]"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-[#86868B]">
                      Справка №{cert.number}
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                        cert.status === 1
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : cert.status === 0
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {cert.status === 1 ? 'Готова' : cert.status === 0 ? 'Отклонена' : 'На рассмотрении'}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">
                    {cert.provisionPlace}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-[#86868B] mt-2">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Заказ от {cert.dateOrder}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <FileText className="w-12 h-12 text-zinc-600 mb-3" />
              <h2 className="text-xl font-bold text-white mb-1">
                Нет заказанных справок
              </h2>
              <p className="text-xs text-[#86868B] max-w-xs">
                Нажмите «+» в правом верхнем углу, чтобы заказать электронную справку об обучении
              </p>
            </div>
          )
        ) : (
          markSheets.length > 0 ? (
            <div className="space-y-3">
              {markSheets.map((ms) => (
                <div
                  key={ms.id}
                  className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08]"
                >
                  <h3 className="text-sm font-semibold text-white">{ms.subjectName}</h3>
                  <p className="text-xs text-[#86868B] mt-1">{ms.term} семестр • {ms.hours} ч</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <FileText className="w-12 h-12 text-zinc-600 mb-3" />
              <h2 className="text-xl font-bold text-white mb-1">
                Нет направлений на пересдачу
              </h2>
              <p className="text-xs text-[#86868B] max-w-xs">
                У вас нет открытых экзаменационных ведомостей или направлений
              </p>
            </div>
          )
        )}
      </div>

      {/* Order Certificate Dialog */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#272729] border border-white/10 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Заказ справки</h3>
              <button
                onClick={() => setShowOrderModal(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <label className="text-xs font-semibold text-[#86868B] uppercase">
                Место предъявления
              </label>
              <input
                type="text"
                placeholder="Например: По месту требования, Военкомат..."
                value={orderPlace}
                onChange={(e) => setOrderPlace(e.target.value)}
                className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none"
              />

              <label className="text-xs font-semibold text-[#86868B] uppercase block mt-3">
                Количество
              </label>
              <div className="flex gap-2">
                {[1, 2, 3].map((num) => (
                  <button
                    key={num}
                    onClick={() => setOrderCount(num)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold border ${
                      orderCount === num ? 'bg-white text-black border-white' : 'bg-black/30 text-white border-white/10'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowOrderModal(false)}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-white/10 text-white"
              >
                Отмена
              </button>
              <button
                onClick={handleOrderCert}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white shadow-md"
                style={{ backgroundColor: accentColor }}
              >
                Заказать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
