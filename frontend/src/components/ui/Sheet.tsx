import { useEffect } from 'react'
import type { ReactNode } from 'react'

interface SheetProps {
  title: string
  onClose: () => void
  children: ReactNode
  width?: string
}

const Sheet = ({ title, onClose, children, width = 'md:max-w-md' }: SheetProps) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-surface/85" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className={`w-full ${width} bg-card border border-line rounded-t-lg md:rounded-lg p-4 number-tick`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-widest text-muted">{title}</p>
          <button type="button" onClick={onClose} className="text-muted hover:text-white text-xs uppercase tracking-widest pointer-coarse:min-h-11 px-2">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default Sheet
