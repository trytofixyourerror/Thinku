import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { type ReactNode, useEffect } from 'react'

export default function Modal(props: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    if (!props.open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [props.open, props.onClose])

  if (!props.open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm" onClick={props.onClose} />
      <div
        className={cn(
          'relative w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50',
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div className="font-[Fraunces] text-lg tracking-tight">{props.title}</div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-full border border-zinc-800 bg-zinc-900/50 p-2 text-zinc-300 hover:bg-zinc-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{props.children}</div>
      </div>
    </div>
  )
}

