import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface TownViewProps {
  visible: boolean
}

export function TownView({ visible }: TownViewProps) {
  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return `town.html?${params.toString()}`
  }, [])

  return (
    <iframe
      src={iframeSrc}
      title="Agentshire Town"
      className={cn(
        'absolute inset-0 w-full h-full border-0',
        visible ? 'block' : 'hidden',
      )}
      allow="autoplay; microphone"
    />
  )
}
