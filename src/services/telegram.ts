/* Telegram WebApp integration & native bridge */

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string
        initDataUnsafe: {
          user?: {
            id: number
            first_name: string
            last_name?: string
            username?: string
            photo_url?: string
          }
        }
        themeParams: {
          bg_color?: string
          secondary_bg_color?: string
          text_color?: string
          hint_color?: string
          link_color?: string
          button_color?: string
          button_text_color?: string
        }
        isExpanded: boolean
        viewportHeight: number
        viewportStableHeight: number
        headerColor: string
        backgroundColor: string
        ready: () => void
        expand: () => void
        close: () => void
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void
          selectionChanged: () => void
        }
        BackButton: {
          isVisible: boolean
          show: () => void
          hide: () => void
          onClick: (callback: () => void) => void
          offClick: (callback: () => void) => void
        }
      }
    }
  }
}

export const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined

export const haptic = {
  click: () => {
    try {
      tg?.HapticFeedback?.selectionChanged()
    } catch {}
  },
  light: () => {
    try {
      tg?.HapticFeedback?.impactOccurred('light')
    } catch {}
  },
  medium: () => {
    try {
      tg?.HapticFeedback?.impactOccurred('medium')
    } catch {}
  },
  heavy: () => {
    try {
      tg?.HapticFeedback?.impactOccurred('heavy')
    } catch {}
  },
  success: () => {
    try {
      tg?.HapticFeedback?.notificationOccurred('success')
    } catch {}
  },
  error: () => {
    try {
      tg?.HapticFeedback?.notificationOccurred('error')
    } catch {}
  }
}
