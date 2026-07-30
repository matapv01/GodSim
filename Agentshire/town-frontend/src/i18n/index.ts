import zhCN from './zh-CN'
import en from './en'
import vi from './vi'

type LocaleMap = Record<string, string>
const locales: Record<string, LocaleMap> = { 'zh-CN': zhCN, en, vi }

let current = 'vi'

export function initLocale(): void {
  const params = new URLSearchParams(location.search)
  const fromUrl = params.get('lang')

  let fromStorage: string | null = null
  try {
    const raw = localStorage.getItem('agentshire_settings')
    if (raw) {
      const s = JSON.parse(raw)
      if (typeof s.language === 'string') fromStorage = s.language
    }
  } catch { /* ignore */ }

  const resolved = fromUrl || fromStorage || 'vi'
  if (locales[resolved]) current = resolved
}

export function getLocale(): string { return current }

export function setLocale(lang: string): void {
  if (locales[lang]) current = lang
}

export function t(key: string, vars?: Record<string, string>): string {
  let text = locales[current]?.[key] ?? locales.en?.[key] ?? locales['zh-CN']?.[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
    }
  }
  return text
}
