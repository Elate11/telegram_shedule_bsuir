import React, { useState, useEffect } from 'react'
import { ArrowLeft, FileText, Plus, CheckCircle, Clock, X, ChevronRight } from 'lucide-react'
import { haptic } from '../services/telegram'
import { NetworkClient, BASE_URL, FALLBACK_DIRECT_BASE } from '../services/networkClient'

export interface IisCertificateItem {
  id: number
  number: number
  certificateType: string
  provisionPlace: string
  dateOrder: string
  issueDate?: string
  status: number // 0 = Отклонено, 1 = Готово, 2 = На рассмотрении
  rejectionReason?: string
}

export interface IisMarkSheetItem {
  id: number
  number: string
  subjectName: string
  subjectType: string
  employeeFio: string
  absentDate: string
  hours: number
  price: number
  status: string
  term: number
}

interface StudyScreenProps {
  onBack: () => void
  accentColor?: string
}

export const StudyScreen: React.FC<StudyScreenProps> = ({
  onBack,
  accentColor = '#2997FF'
}) => {
  const [selectedTab, setSelectedTab] = useState<0 | 1>(0) // 0 = Справки, 1 = Ведомости
  const [certificates, setCertificates] = useState<IisCertificateItem[]>([])
  const [markSheets, setMarkSheets] = useState<IisMarkSheetItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const parseCertificates = (data: any): IisCertificateItem[] => {
    const arr = Array.isArray(data) ? data : []
    return arr.map((obj: any) => ({
      id: obj.id || 0,
      number: obj.number || 0,
      certificateType: obj.certificateType || 'обычная',
      provisionPlace: obj.provisionPlace || 'По месту требования',
      dateOrder: obj.dateOrder || '',
      issueDate: obj.issueDate && obj.issueDate !== 'null' ? obj.issueDate : undefined,
      status: obj.status ?? 2,
      rejectionReason: obj.rejectionReason && obj.rejectionReason !== 'null' ? obj.rejectionReason : undefined
    }))
  }

  const parseMarkSheets = (data: any): IisMarkSheetItem[] => {
    const arr = Array.isArray(data) ? data : []
    return arr.map((obj: any) => {
      const subj = obj.subject
      const emp = obj.employee
      return {
        id: obj.id || 0,
        number: obj.number || '',
        subjectName: subj?.abbrev || subj?.name || 'Дисциплина',
        subjectType: subj?.lessonTypeAbbrev || '',
        employeeFio: emp?.fio || '',
        absentDate: obj.absentDate && obj.absentDate !== 'null' ? obj.absentDate : '',
        hours: obj.hours || 0,
        price: obj.price || 0,
        status: obj.status || 'В обработке',
        term: obj.term || subj?.term || 0
      }
    })
  }

  const loadData = async () => {
    setIsLoading(true)
    const cachedCerts = localStorage.getItem('cached_iis_certificates')
    if (cachedCerts) {
      try { setCertificates(parseCertificates(JSON.parse(cachedCerts))) } catch {}
    }
    const cachedSheets = localStorage.getItem('cached_iis_marksheets')
    if (cachedSheets) {
      try { setMarkSheets(parseMarkSheets(JSON.parse(cachedSheets))) } catch {}
    }

    try {
      // 1. Certificates
      const certRes = await NetworkClient.executeWithAuth(`${BASE_URL}/certificate`).catch(() => {
        return NetworkClient.executeWithAuth(`${FALLBACK_DIRECT_BASE}/certificate`)
      })
      if (certRes && certRes.ok) {
        const json = await certRes.json()
        localStorage.setItem('cached_iis_certificates', JSON.stringify(json))
        setCertificates(parseCertificates(json))
      }

      // 2. Mark sheets
      const msRes = await NetworkClient.executeWithAuth(`${BASE_URL}/mark-sheet`).catch(() => {
        return NetworkClient.executeWithAuth(`${FALLBACK_DIRECT_BASE}/mark-sheet`)
      })
      if (msRes && msRes.ok) {
        const json = await msRes.json()
        localStorage.setItem('cached_iis_marksheets', JSON.stringify(json))
        setMarkSheets(parseMarkSheets(json))
      }
    } catch (e) {
      console.warn('Study data fetch error', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
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
        <h1 className="text-xl font-bold tracking-tight">Учёба и справки</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center px-5 pt-3 gap-2">
        <button
          onClick={() => {
            haptic.click()
            setSelectedTab(0)
          }}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
            selectedTab === 0
              ? 'bg-white/10 text-white border border-white/20'
              : 'text-[#86868B] hover:text-white'
          }`}
        >
          Справки ({certificates.length})
        </button>
        <button
          onClick={() => {
            haptic.click()
            setSelectedTab(1)
          }}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
            selectedTab === 1
              ? 'bg-white/10 text-white border border-white/20'
              : 'text-[#86868B] hover:text-white'
          }`}
        >
          Ведомости ({markSheets.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 pb-24">
        {selectedTab === 0 ? (
          certificates.length > 0 ? (
            <div className="space-y-3">
              {certificates.map((cert) => (
                <div
                  key={cert.id}
                  className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08] flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      Справка #{cert.number} ({cert.certificateType})
                    </h4>
                    <p className="text-xs text-[#86868B] mt-0.5">
                      {cert.provisionPlace} • {cert.dateOrder}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      cert.status === 1
                        ? 'bg-[#30D158]/15 text-[#30D158]'
                        : cert.status === 0
                          ? 'bg-[#FF453A]/15 text-[#FF453A]'
                          : 'bg-white/10 text-[#86868B]'
                    }`}
                  >
                    {cert.status === 1 ? 'Готово' : cert.status === 0 ? 'Отклонено' : 'В обработке'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <FileText className="w-12 h-12 text-zinc-600 mb-3" />
              <h2 className="text-xl font-bold text-white mb-1">
                Справок не заказано
              </h2>
              <p className="text-xs text-[#86868B] max-w-xs">
                Заказанные справки об обучении подгружаются из кабинета ИИС
              </p>
            </div>
          )
        ) : markSheets.length > 0 ? (
          <div className="space-y-3">
            {markSheets.map((ms) => (
              <div
                key={ms.id}
                className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08] flex items-center justify-between"
              >
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    {ms.subjectName} {ms.subjectType && `(${ms.subjectType})`}
                  </h4>
                  <p className="text-xs text-[#86868B] mt-0.5">
                    {ms.employeeFio} • {ms.hours} ч.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 text-white">
                  {ms.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <FileText className="w-12 h-12 text-zinc-600 mb-3" />
            <h2 className="text-xl font-bold text-white mb-1">
              Экзаменационных листов нет
            </h2>
            <p className="text-xs text-[#86868B] max-w-xs">
              Ведомости на пересдачу появляются здесь при наличии задолженностей
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
