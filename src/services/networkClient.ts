/**
 * Exact replica of Kotlin NetworkClient.kt:
 * - Persistent Cookie Store backed by localStorage
 * - Automatic re-login on 401 Unauthorized
 * - User-Agent header and credentials injection
 * - Retry and fallback handling
 */

export const BASE_URL = '/api/v1'
export const FALLBACK_DIRECT_BASE = 'https://iis.bsuir.by/api/v1'
export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

class NetworkClientService {
  private cookies: Map<string, string> = new Map()

  constructor() {
    this.loadCookiesFromStorage()
  }

  private loadCookiesFromStorage() {
    try {
      const saved = localStorage.getItem('app_network_cookies')
      if (saved) {
        const pairs = saved.split('; ')
        pairs.forEach(p => {
          const [k, v] = p.split('=')
          if (k && v) this.cookies.set(k.trim(), v.trim())
        })
      }
    } catch (e) {
      console.warn('Failed to load cookies', e)
    }
  }

  private saveCookiesToStorage() {
    try {
      const arr: string[] = []
      this.cookies.forEach((v, k) => {
        arr.push(`${k}=${v}`)
      })
      localStorage.setItem('app_network_cookies', arr.join('; '))
    } catch (e) {
      console.warn('Failed to save cookies', e)
    }
  }

  public getCookieHeader(): string {
    const arr: string[] = []
    this.cookies.forEach((v, k) => {
      arr.push(`${k}=${v}`)
    })
    const manualToken = localStorage.getItem('app_auth_token')
    if (manualToken && !arr.some(c => c.includes(manualToken))) {
      arr.push(manualToken)
    }
    return arr.join('; ')
  }

  public saveCookiesFromResponse(res: Response) {
    // Check Set-Cookie if exposed, or custom response headers
    try {
      const setCookie = res.headers.get('set-cookie')
      if (setCookie) {
        setCookie.split(',').forEach(c => {
          const main = c.split(';')[0]
          const [k, v] = main.split('=')
          if (k && v) this.cookies.set(k.trim(), v.trim())
        })
        this.saveCookiesToStorage()
      }
    } catch {}
  }

  public buildHeaders(extraHeaders: HeadersInit = {}): HeadersInit {
    const headers: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': USER_AGENT
    }
    const cookieStr = this.getCookieHeader()
    if (cookieStr) {
      headers['Cookie'] = cookieStr
      // Also send Authorization header if token looks like JWT or session
      if (!cookieStr.includes('=')) {
        headers['Authorization'] = `Bearer ${cookieStr}`
      }
    }
    return { ...headers, ...extraHeaders }
  }

  /**
   * Execute request with automatic 401 Re-login (matches Kotlin executeWithAuth)
   */
  async executeWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = this.buildHeaders(options.headers || {})
    let res = await fetch(url, { ...options, headers })

    if (res.status === 401) {
      const username = localStorage.getItem('gradebook_number') || localStorage.getItem('gradebook')
      const password = localStorage.getItem('saved_password')

      if (username && password) {
        const loggedIn = await this.login(username, password)
        if (loggedIn) {
          const retryHeaders = this.buildHeaders(options.headers || {})
          res = await fetch(url, { ...options, headers: retryHeaders })
        }
      }
    }

    this.saveCookiesFromResponse(res)
    return res
  }

  /**
   * Login into IIS BSUIR (matches Kotlin login in NetworkClient.kt)
   */
  async login(username: string, password: string): Promise<boolean> {
    try {
      const payload = {
        username: username.trim(),
        password: password
      }
      const url = `${BASE_URL}/auth/login`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': USER_AGENT
        },
        body: JSON.stringify(payload)
      }).catch(() => {
        return fetch(`${FALLBACK_DIRECT_BASE}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Accept': 'application/json, text/plain, */*'
          },
          body: JSON.stringify(payload)
        })
      })

      if (res && res.ok) {
        this.saveCookiesFromResponse(res)
        const bodyText = await res.text()
        let token = ''
        try {
          const json = JSON.parse(bodyText)
          if (json.fio) localStorage.setItem('app_user_fio', json.fio)
          const grp = json.group || json.studentGroup?.name || ''
          if (grp) {
            localStorage.setItem('app_selected_group', grp)
            localStorage.setItem('login_group', grp)
          }
          if (json.photoUrl) localStorage.setItem('app_user_photo', json.photoUrl)
          if (json.token) token = json.token
        } catch {}

        if (!token) {
          const cookieHdr = this.getCookieHeader()
          token = cookieHdr || bodyText
        }

        localStorage.setItem('app_auth_token', token)
        localStorage.setItem('gradebook_number', username)
        localStorage.setItem('saved_password', password)
        return true
      }
    } catch (e) {
      console.error('Login error', e)
    }
    return false
  }

  clearCookies() {
    this.cookies.clear()
    localStorage.removeItem('app_network_cookies')
    localStorage.removeItem('app_auth_token')
    localStorage.removeItem('saved_password')
  }
}

export const NetworkClient = new NetworkClientService()
