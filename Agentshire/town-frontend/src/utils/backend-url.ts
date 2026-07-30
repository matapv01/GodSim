export function getConfiguredWsUrl(): string {
  return import.meta.env.VITE_AGENTSHIRE_WS_URL?.trim() || ''
}

export function getBackendHttpBase(): string {
  const wsUrl = getConfiguredWsUrl()
  if (!wsUrl) return ''
  try {
    const url = new URL(wsUrl)
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
    url.pathname = ''
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

export function backendUrl(path: string): string {
  const base = getBackendHttpBase()
  if (!base || /^https?:\/\//i.test(path)) return path
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(backendUrl(path), init)
}
