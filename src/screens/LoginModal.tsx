import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { haptic } from '../services/telegram'
import { NetworkClient } from '../services/networkClient'
import { bsuirApi } from '../services/bsuirApi'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  accentColor?: string
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  accentColor = '#2997FF'
}) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Заполните номер зачетки и пароль')
      return
    }

    setIsLoading(true)
    setError(null)
    haptic.click()

    try {
      const ok = await NetworkClient.login(username.trim(), password)
      if (ok) {
        haptic.success()
        await bsuirApi.fetchStudentProfile()
        onSuccess()
        onClose()
      } else {
        haptic.error()
        setError('Неверный логин или пароль ИИС БГУИР')
      }
    } catch {
      haptic.error()
      setError('Ошибка подключения к серверу БГУИР')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-sm rounded-[28px] bg-[#272729] border border-white/10 p-6 shadow-2xl"
      >
        {/* Close */}
        <button
          onClick={() => {
            haptic.click()
            onClose()
          }}
          className="absolute right-4 top-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="text-center mb-6 pt-2">
          <span className="text-xs font-semibold text-[#2997FF] uppercase tracking-wider block mb-1">
            ИИС БГУИР
          </span>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Вход в кабинет
          </h2>
          <p className="text-xs text-[#86868B] mt-1">
            Для зачётки, справок, пропусков и оценок
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[#FF453A]/15 border border-[#FF453A]/30 flex items-center gap-2 text-xs text-[#FF453A]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3.5">
          {/* Username */}
          <div className="relative">
            <User className="w-4 h-4 text-[#86868B] absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Номер зачетки (логин)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full pl-10 pr-3 py-3 rounded-2xl bg-black/40 border border-white/10 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-[#2997FF]"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="w-4 h-4 text-[#86868B] absolute left-3.5 top-3.5" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Пароль от ИИС"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-10 py-3 rounded-2xl bg-black/40 border border-white/10 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-[#2997FF]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-3.5 text-[#86868B] hover:text-white"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-2xl font-semibold text-sm text-white transition-opacity active:opacity-85 mt-2 shadow-lg disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            {isLoading ? 'Авторизация...' : 'Войти'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
