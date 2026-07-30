import { useRef, useState, useCallback, useEffect } from 'react'

export interface ChatItem {
  id: string
  agentId: string
  timestamp: number
  kind: 'text' | 'media' | 'tool' | 'status'
  role?: 'user' | 'assistant'
  text?: string
  source?: string
  mediaType?: 'image' | 'video' | 'audio' | 'file'
  filePath?: string
  fileUrl?: string
  fileName?: string
  mimeType?: string
  fileSize?: number
  caption?: string
  imageData?: string
  phase?: 'start' | 'end'
  toolUseId?: string
  toolName?: string
  input?: Record<string, unknown>
  outputText?: string
  isError?: boolean
  status?: string
}

export interface LegacyHistoryMessage {
  role: 'user' | 'assistant'
  text: string
  timestamp: number
  type?: 'text' | 'image' | 'video' | 'audio' | 'file'
  imageData?: string
  mimeType?: string
  fileUrl?: string
  fileName?: string
  fileSize?: number
}

interface UseWebSocketOptions {
  url: string
  townSessionId: string
  enabled: boolean
  onHistoryItems?: (agentId: string, items: ChatItem[], hasMore: boolean, cursor: string) => void
  onDeltaItems?: (agentId: string, items: ChatItem[]) => void
  onNewMessages?: (agentId: string, messages: LegacyHistoryMessage[]) => void
  onAgentEvent?: (event: any) => void
}

const RECONNECT_DELAY = 3000
const MAX_RECONNECTS = 10

export function useWebSocket({ url, townSessionId, enabled, onHistoryItems, onDeltaItems, onNewMessages, onAgentEvent }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const onHistoryItemsRef = useRef(onHistoryItems)
  const onDeltaItemsRef = useRef(onDeltaItems)
  const onNewMessagesRef = useRef(onNewMessages)
  const onAgentEventRef = useRef(onAgentEvent)
  onHistoryItemsRef.current = onHistoryItems
  onDeltaItemsRef.current = onDeltaItems
  onNewMessagesRef.current = onNewMessages
  onAgentEventRef.current = onAgentEvent
  const reconnectCount = useRef(0)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cleanedUp = useRef(false)

  useEffect(() => {
    if (!enabled || !url) return
    cleanedUp.current = false

    function connect() {
      if (cleanedUp.current) return
      if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return

      try {
        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
          if (cleanedUp.current) { ws.close(); return }
          setConnected(true)
          reconnectCount.current = 0
          console.log(`[Chat WS] Connected, binding session: ${townSessionId}`)
          ws.send(JSON.stringify({ type: 'town_session_init', townSessionId }))
        }

        ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data)
            if (data.type === 'chat_history') {
              if (data.format === 'items' && Array.isArray(data.items)) {
                onHistoryItemsRef.current?.(data.agentId ?? 'steward', data.items, data.hasMore ?? false, data.cursor ?? '')
              }
            } else if (data.type === 'chat_delta' && Array.isArray(data.items)) {
              onDeltaItemsRef.current?.(data.agentId ?? 'steward', data.items)
            } else if (data.type === 'chat_new_messages') {
              onNewMessagesRef.current?.(data.agentId ?? 'steward', data.messages ?? [])
            } else if (data.type === 'agent_event' && data.event) {
              onAgentEventRef.current?.(data.event)
            }
          } catch { /* ignore malformed */ }
        }

        ws.onclose = () => {
          if (cleanedUp.current) return
          setConnected(false)
          wsRef.current = null
          scheduleReconnect()
        }

        ws.onerror = () => {
          setConnected(false)
        }
      } catch {
        setConnected(false)
        scheduleReconnect()
      }
    }

    function scheduleReconnect() {
      if (cleanedUp.current) return
      if (reconnectCount.current >= MAX_RECONNECTS) return
      reconnectCount.current++
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY)
    }

    connect()

    return () => {
      cleanedUp.current = true
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
      reconnectCount.current = 0
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
      setConnected(false)
    }
  }, [url, townSessionId, enabled])

  const sendChat = useCallback((text: string) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'chat', body: [{ kind: 'text', text }] }))
  }, [])

  const sendCitizenChat = useCallback((npcId: string, message: string) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'citizen_chat', npcId, message }))
  }, [])

  const sendMultimodal = useCallback((
    parts: Array<{ kind: string; text?: string; data?: string; mimeType?: string; fileName?: string }>,
    target?: { agentId?: string; npcId?: string },
  ) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({
      type: 'multimodal',
      parts,
      ...(target?.agentId ? { agentId: target.agentId } : {}),
      ...(target?.npcId ? { npcId: target.npcId } : {}),
    }))
  }, [])

  const requestHistory = useCallback((agentId: string, cursor?: string) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'chat_history_request', agentId, format: 'items', limit: 50, ...(cursor ? { cursor } : {}) }))
  }, [])

  const bindChatAgent = useCallback((agentId: string) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'chat_agent_bind', agentId }))
  }, [])

  const sendAbort = useCallback(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'abort' }))
  }, [])

  const sendCommand = useCallback((command: string, args: string) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'command', command, args }))
  }, [])

  return { connected, sendChat, sendCitizenChat, sendMultimodal, sendAbort, sendCommand, requestHistory, bindChatAgent }
}
