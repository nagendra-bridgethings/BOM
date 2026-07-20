import { useEffect } from 'react'
import { IconClose } from './icons'

export default function Modal({ open, onClose, closable = true, title, subtitle, icon, children, footer, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && closable && onClose?.()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose, closable])

  if (!open) return null

  // Backdrop click closes — but not clicks on the overlay's own scrollbar
  // (clientWidth/Height exclude scrollbars; the overlay is fixed at 0,0).
  function onBackdropDown(e) {
    if (!closable || e.target !== e.currentTarget) return
    const el = e.currentTarget
    if (e.clientX >= el.clientWidth || e.clientY >= el.clientHeight) return
    onClose?.()
  }

  return (
    <div
      className="bom-fade-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={onBackdropDown}
    >
      {/* my-auto centres when the panel fits and top-aligns (scrollable) when it overflows */}
      <div className={`bom-pop-in my-auto w-full ${maxWidth} rounded-xl bg-surface shadow-xl shadow-black/15 ring-1 ring-line`}>
        <div className="flex items-start gap-3 border-b border-line2 px-6 py-4">
          {icon && (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface2 text-mute ring-1 ring-line">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-sm text-mute">{subtitle}</p>}
          </div>
          <button
            onClick={() => closable && onClose?.()}
            disabled={!closable}
            className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg p-1.5 text-faint transition hover:bg-raise hover:text-ink disabled:opacity-40 xl:min-h-0 xl:min-w-0"
            aria-label="Close"
          >
            <IconClose />
          </button>
        </div>

        <div className="px-6 py-5">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-line2 bg-surface2/60 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
