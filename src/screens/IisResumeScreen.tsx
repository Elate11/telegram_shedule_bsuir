import React, { useState, useEffect } from 'react'
import { ArrowLeft, BadgeAlert, Plus, Globe, Mail, Eye } from 'lucide-react'
import { haptic } from '../services/telegram'
import { NetworkClient, BASE_URL, FALLBACK_DIRECT_BASE } from '../services/networkClient'

interface IisResumeScreenProps {
  onBack: () => void
  accentColor?: string
}

export const IisResumeScreen: React.FC<IisResumeScreenProps> = ({
  onBack,
  accentColor = '#2997FF'
}) => {
  const [summary, setSummary] = useState('')
  const [skills, setSkills] = useState<{ id: number; name: string }[]>([])
  const [references, setReferences] = useState<{ id: number; name: string; link: string }[]>([])
  const [published, setPublished] = useState(true)
  const [showRating, setShowRating] = useState(true)
  const [isLoading, setIsLoading] = useState(true)

  const parseCv = (json: any) => {
    try {
      setSummary(json.summary || '')
      setPublished(json.published ?? true)
      setShowRating(json.showRating ?? true)

      if (Array.isArray(json.skills)) {
        setSkills(json.skills.map((s: any) => ({ id: s.id || 0, name: s.name || '' })))
      }
      if (Array.isArray(json.references)) {
        setReferences(json.references.map((r: any) => ({
          id: r.id || 0,
          name: r.name || '',
          link: r.reference || ''
        })))
      }
    } catch {}
  }

  const loadCv = async () => {
    setIsLoading(true)
    const cached = localStorage.getItem('cached_personal_cv')
    if (cached) {
      try { parseCv(JSON.parse(cached)) } catch {}
    }

    try {
      const url = `${BASE_URL}/profiles/personal-cv`
      const res = await NetworkClient.executeWithAuth(url).catch(() => {
        return NetworkClient.executeWithAuth(`${FALLBACK_DIRECT_BASE}/profiles/personal-cv`)
      })
      if (res && res.ok) {
        const json = await res.json()
        localStorage.setItem('cached_personal_cv', JSON.stringify(json))
        parseCv(json)
      }
    } catch (e) {
      console.warn('CV fetch error', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCv()
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
        <h1 className="text-xl font-bold tracking-tight">Резюме и виджет ИИС</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 pb-24">
        {/* Visibility status */}
        <div className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-[#2997FF]" />
            <div>
              <h4 className="text-sm font-semibold text-white">Публикация в каталоге</h4>
              <p className="text-xs text-[#86868B]">Резюме видно работодателям и деканату</p>
            </div>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            published ? 'bg-[#30D158]/15 text-[#30D158]' : 'bg-white/10 text-[#86868B]'
          }`}>
            {published ? 'Опубликовано' : 'Скрыто'}
          </span>
        </div>

        {/* Summary bio */}
        <div className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08] space-y-2">
          <span className="text-xs font-bold text-[#86868B] uppercase tracking-wider block">
            О себе
          </span>
          <p className="text-sm text-white leading-relaxed">
            {summary || 'Описание не заполнено в профиле ИИС БГУИР'}
          </p>
        </div>

        {/* Skills */}
        <div className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08] space-y-3">
          <span className="text-xs font-bold text-[#86868B] uppercase tracking-wider block">
            Навыки и стек технологий
          </span>
          {skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {skills.map((s, i) => (
                <span
                  key={s.id || i}
                  className="px-3 py-1 rounded-xl bg-white/10 text-xs font-medium text-white"
                >
                  {s.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#86868B]">Навыки не указаны</p>
          )}
        </div>

        {/* References and Links */}
        <div className="p-4 rounded-2xl bg-[#272729] border border-white/[0.08] space-y-3">
          <span className="text-xs font-bold text-[#86868B] uppercase tracking-wider block">
            Ссылки и портфолио
          </span>
          {references.length > 0 ? (
            <div className="space-y-2">
              {references.map((r, i) => (
                <div key={r.id || i} className="flex items-center justify-between text-xs">
                  <span className="text-white font-medium">{r.name}</span>
                  <a
                    href={r.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#2997FF] hover:underline truncate max-w-[180px]"
                  >
                    {r.link}
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#86868B]">Ссылки на GitHub или портфолио отсутствуют</p>
          )}
        </div>
      </div>
    </div>
  )
}
