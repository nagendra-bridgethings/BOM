import { useEffect, useMemo, useRef, useState } from 'react'
import { IconChevronDown, IconPlus } from './icons'

// A creatable dropdown: pick an existing option OR just type a new value.
export default function Combobox({
  value = '',
  onChange,
  options = [],
  placeholder = '',
  disabled = false,
  allowCreate = true,
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const wrapRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    const base = q
      ? options.filter((o) => o.toLowerCase().includes(q))
      : options
    return base.slice(0, 60)
  }, [options, value])

  const exactMatch = options.some((o) => o.toLowerCase() === value.trim().toLowerCase())
  const showCreate = allowCreate && value.trim() !== '' && !exactMatch

  const commit = (v) => {
    onChange?.(v)
    setOpen(false)
    setActive(-1)
  }

  const onKeyDown = (e) => {
    if (disabled) return
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      if (active >= 0 && filtered[active]) {
        e.preventDefault()
        commit(filtered[active])
      } else {
        setOpen(false)
      }
    } else if (e.key === 'Escape') {
      // consume the key while the list is open so the parent Modal doesn't close too
      if (open) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        setActive(-1)
      }
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            onChange?.(e.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          // onFocus alone won't fire if the input is already focused — on touch
          // that leaves no way to reopen the list after picking/closing it
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-line bg-surface2 py-2 pl-3 pr-8 text-base text-ink sm:text-sm outline-none transition placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="absolute inset-y-0 right-0 flex items-center pr-2 text-faint hover:text-mute"
        >
          <IconChevronDown />
        </button>
      </div>

      {open && (filtered.length > 0 || showCreate) && (
        <ul
          ref={listRef}
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-line bg-surface py-1 text-sm shadow-lg shadow-black/10"
        >
          {showCreate && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(value.trim())}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-mute hover:bg-raise"
              >
                <IconPlus width={14} height={14} className="text-primary" />
                <span>
                  Add “<span className="font-medium text-ink">{value.trim()}</span>”
                </span>
              </button>
            </li>
          )}
          {filtered.map((o, i) => (
            <li key={o}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(o)}
                onMouseEnter={() => setActive(i)}
                className={`block w-full truncate px-3 py-2 text-left ${
                  i === active ? 'bg-raise text-ink' : 'text-mute hover:bg-raise'
                } ${o.toLowerCase() === value.trim().toLowerCase() ? 'font-medium text-ink' : ''}`}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
