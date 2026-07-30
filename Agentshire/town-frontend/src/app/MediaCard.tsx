import { cn } from '@/lib/utils'
import { FileText, Film, Music, File, Download } from 'lucide-react'

interface MediaCardProps {
  type: 'image' | 'video' | 'audio' | 'file'
  text?: string
  imageData?: string
  mimeType?: string
  fileUrl?: string
  fileName?: string
  fileSize?: number
  onImageClick?: (src: string) => void
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}K`
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`
}

function getFileIcon(fileName?: string) {
  const ext = fileName?.split('.').pop()?.toLowerCase() ?? ''
  if (['md', 'txt', 'json', 'csv', 'log'].includes(ext)) return <FileText size={20} strokeWidth={1.5} />
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return <Film size={20} strokeWidth={1.5} />
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)) return <Music size={20} strokeWidth={1.5} />
  return <File size={20} strokeWidth={1.5} />
}

function buildOpenUrl(fileUrl?: string, fileName?: string, mimeType?: string): string | undefined {
  if (!fileUrl) return fileUrl
  const ext = fileName?.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'md' || mimeType === 'text/markdown') {
    return `/viewer.html?file=${encodeURIComponent(fileUrl)}`
  }
  return fileUrl
}

export function MediaCard(props: MediaCardProps) {
  const { type, imageData, mimeType, fileUrl, fileName, fileSize, onImageClick } = props
  const openUrl = buildOpenUrl(fileUrl, fileName, mimeType)
  if (type === 'image') {
    const src = imageData ? `data:${mimeType ?? 'image/png'};base64,${imageData}` : fileUrl
    if (!src) return null
    return (
      <div className="max-w-[320px]">
        <img
          src={src}
          alt={fileName ?? 'image'}
          className="rounded-lg max-w-full max-h-[400px] object-contain cursor-pointer hover:opacity-90 transition-opacity"
          loading="lazy"
          onClick={() => onImageClick?.(src)}
        />
        {props.text && (
          <div className="text-[13px] mt-1.5 leading-relaxed">{props.text}</div>
        )}
      </div>
    )
  }

  if (type === 'video') {
    return (
      <div className="max-w-[400px]">
        <video
          controls
          preload="metadata"
          className="rounded-lg max-w-full max-h-[300px]"
          src={fileUrl}
        />
        {fileName && (
          <div className="text-[11px] text-text-quaternary mt-1.5 truncate">{fileName}</div>
        )}
      </div>
    )
  }

  if (type === 'audio') {
    return (
      <div className="min-w-[240px] max-w-[360px]">
        <audio controls preload="metadata" className="w-full" src={fileUrl} />
        {fileName && (
          <div className="text-[11px] text-text-quaternary mt-1.5 truncate">{fileName}</div>
        )}
      </div>
    )
  }

  return (
    <a
      href={openUrl}
      target="_blank"
      rel="noopener noreferrer"
      download={fileName?.toLowerCase().endsWith('.md') || mimeType === 'text/markdown' ? undefined : fileName}
      aria-label={`下载 ${fileName ?? '文件'}`}
      className={cn(
        'group flex items-center gap-3 px-4 py-3 rounded-xl min-w-[200px] max-w-[320px]',
        'bg-bg-elevated border border-border-subtle',
        'hover:bg-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.12)] transition-colors cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--town-cyan)]',
        'no-underline',
      )}
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[rgba(255,255,255,0.06)] text-text-secondary shrink-0">
        {getFileIcon(fileName)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-text-primary font-medium truncate">
          {fileName ?? 'file'}
        </div>
        {fileSize != null && fileSize > 0 && (
          <div className="text-[11px] text-text-quaternary mt-0.5">
            {formatFileSize(fileSize)}
          </div>
        )}
      </div>
      <div className="flex items-center justify-center w-8 h-8 rounded-md shrink-0 transition-colors text-text-tertiary group-hover:text-text-primary group-hover:bg-[rgba(255,255,255,0.08)]">
        <Download size={16} strokeWidth={1.5} />
      </div>
    </a>
  )
}
