import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconDots } from './icons'

const PANEL_W = 160 // w-40

// Lightweight overflow menu: a trigger button + a dropdown of actions.
// The panel is portaled to <body> with fixed positioning so it can never be
// clipped by an overflow container (e.g. the table's scroll wrapper).
// Closes on outside-click, Escape, scroll or resize.
export default function Menu({ items, label = 'More actions' }) {
  const [rect, setRect] = useState(null) // trigger rect while open
  const wrapRef = useRef(null)
  const panelRef = useRef(null)
  const open = Boolean(rect)

  function toggle() {
    setRect((r) => (r ? null : wrapRef.current.getBoundingClientRect()))
  }

  useEffect(() => {
    if (!open) return
    const close = () => setRect(null)
    const onDown = (e) => {
      if (wrapRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      close()
    }
    const onKey = (e) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const panel = open
    ? createPortal(
        <div
          ref={panelRef}
          className="bom-menu-in fixed z-50 w-40 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg shadow-black/10"
          style={{
            top: Math.min(rect.bottom + 4, window.innerHeight - 8 - (items.length * 36 + 8)),
            left: Math.max(8, Math.min(rect.right - PANEL_W, window.innerWidth - PANEL_W - 8)),
          }}
        >
          {items.map((it, i) =>
            it.divider ? (
              <div key={`d${i}`} className="my-1 h-px bg-line2" />
            ) : (
              <button
                key={it.label}
                onClick={() => { setRect(null); it.onClick?.() }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition ${
                  it.danger ? 'text-coral hover:bg-coral/12' : 'text-mute hover:bg-raise hover:text-ink'
                }`}
              >
                {it.icon && <span className="shrink-0">{it.icon}</span>}
                {it.label}
              </button>
            ),
          )}
        </div>,
        document.body,
      )
    : null

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        title={label}
        aria-label={label}
        onClick={toggle}
        className={`rounded-md p-1.5 transition ${open ? 'bg-raise text-ink' : 'text-faint hover:bg-raise hover:text-ink'}`}
      >
        <IconDots width={16} height={16} />
      </button>
      {panel}
    </div>
  )
}
