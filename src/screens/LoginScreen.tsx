import React, { useState } from 'react';
import { Eye, EyeOff, WifiOff } from 'lucide-react';
import BsuirLogoSvg from '../assets/BsuirLogoSvg';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/ThemeContext';
import { triggerHaptic } from '../services/telegram';
import { AppleButtonPrimary, AppleButtonSecondaryPill } from '../components/ui/AppleButtons';
import { colorWithAlpha } from '../components/ui/LiquidGlassSurface';

export function LoginScreen(): React.JSX.Element {
  const { login, loginAsGuest, isOfflineMode, offlineReason } = useAppData();
  const { tokens, isDarkTheme } = useTheme();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!username.trim() || !password.trim()) {
      triggerHaptic('notification', 'error');
      setError('Пожалуйста, заполните все поля');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const res = await login(username.trim(), password);
      if (!res.ok) {
        triggerHaptic('notification', 'error');
        setError(res.error ?? 'Ошибка авторизации');
      } else {
        triggerHaptic('notification', 'success');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuest = async () => {
    if (isLoading) return;
    triggerHaptic('impact', 'light');
    setError(null);
    await loginAsGuest();
  };

  return (
    <div
      className="h-full w-full overflow-y-auto px-[28px] py-[32px] flex flex-col items-center"
      style={{ backgroundColor: tokens.actualBg, color: tokens.text }}
    >
      <div className="w-full max-w-[380px] my-auto flex flex-col items-center">
        {/* BSUIR Logo */}
        <div className="mb-4 flex items-center justify-center">
          <BsuirLogoSvg size={88} style={{ color: tokens.accent }} />
        </div>

        {/* Offline / Mock Indicator Badge */}
        {isOfflineMode && (
          <div
            className="mb-3 rounded-full px-3 py-[5px] inline-flex items-center gap-1.5 text-s-12 font-semibold border"
            style={{
              backgroundColor: colorWithAlpha(tokens.accent, 0.12),
              borderColor: colorWithAlpha(tokens.accent, 0.35),
              color: tokens.accent,
            }}
          >
            <WifiOff size={13} aria-hidden="true" />
            <span>{offlineReason ? `Оффлайн-режим • ${offlineReason}` : 'Оффлайн-режим (демо-данные)'}</span>
          </div>
        )}

        {/* Header */}
        <span
          className="text-s-12 font-semibold uppercase tracking-[1px] text-center"
          style={{ color: tokens.accent }}
        >
          ИИС БГУИР
        </span>
        <h1
          className="font-semibold text-center mt-1 mb-6 leading-[1.15]"
          style={{
            fontSize: 'calc(32px * var(--text-scale, 1))',
            color: tokens.text,
          }}
        >
          Личный кабинет
        </h1>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="w-full flex flex-col gap-[12px]" noValidate>
          <div
            className="w-full h-[52px] rounded-[18px] px-4 border flex items-center transition-colors"
            style={{
              backgroundColor: tokens.card,
              borderColor: focusedField === 'username' ? tokens.accent : tokens.border,
            }}
          >
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError(null);
              }}
              onFocus={() => setFocusedField('username')}
              onBlur={() => setFocusedField((prev) => (prev === 'username' ? null : prev))}
              placeholder="Номер зачетки"
              aria-label="Номер зачетки"
              autoComplete="username"
              className="w-full bg-transparent outline-none text-s-15"
              style={{ color: tokens.text }}
            />
          </div>

          <div
            className="w-full h-[52px] rounded-[18px] px-4 border flex items-center gap-2 transition-colors"
            style={{
              backgroundColor: tokens.card,
              borderColor: focusedField === 'password' ? tokens.accent : tokens.border,
            }}
          >
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField((prev) => (prev === 'password' ? null : prev))}
              placeholder="Пароль"
              aria-label="Пароль"
              autoComplete="current-password"
              className="flex-1 min-w-0 bg-transparent outline-none text-s-15"
              style={{ color: tokens.text }}
            />
            <button
              type="button"
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              onClick={() => {
                triggerHaptic('impact', 'light');
                setShowPassword((prev) => !prev);
              }}
              className="p-1.5 rounded-full bg-transparent border-0 cursor-pointer shrink-0 flex items-center justify-center"
              style={{ color: tokens.textSecondary }}
            >
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>

          {error && (
            <p
              role="alert"
              className="text-s-13 font-medium text-center px-2 mt-1"
              style={{ color: '#FF453A' }}
            >
              {error}
            </p>
          )}

          <AppleButtonPrimary
            type="submit"
            disabled={isLoading}
            isDarkTheme={isDarkTheme}
            accentColor={tokens.accent}
            className="w-full h-[48px] mt-2"
          >
            {isLoading ? 'Вход...' : 'Войти'}
          </AppleButtonPrimary>
        </form>

        <AppleButtonSecondaryPill
          type="button"
          disabled={isLoading}
          isDarkTheme={isDarkTheme}
          accentColor={tokens.accent}
          onClick={() => void handleGuest()}
          className="w-full h-[48px] mt-3"
        >
          Продолжить без входа
        </AppleButtonSecondaryPill>
      </div>
    </div>
  );
}
