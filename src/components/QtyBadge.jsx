import { LOW_STOCK_THRESHOLD } from '../lib/constants'

// Colour-coded live quantity. `note` (e.g. 'NC') shows when there's no activity
// and no counted opening stock. Semantics: healthy = teal, low = sun,
// depleted = coral.
export default function QtyBadge({ qty, note, hasActivity, size = 'md' }) {
  const pad = size === 'lg' ? 'px-3 py-1 text-base min-w-[3.5rem]' : 'px-2.5 py-0.5 text-sm min-w-[2.75rem]'

  const neutral = 'bg-surface2 text-faint ring-line'

  // Not-counted / unknown opening stock, never touched -> show the note (e.g. NC).
  if (note && !hasActivity && (qty === 0 || qty === null)) {
    return (
      <span className={`inline-flex items-center justify-center rounded-md font-semibold ring-1 ring-inset ${neutral} ${pad}`}>
        {note}
      </span>
    )
  }

  let tone
  if (qty <= 0 && !hasActivity)
    tone = neutral // untouched zero -> neutral, not "out of stock"
  else if (qty <= 0) tone = 'bg-coral/10 text-coral ring-coral/20'
  else if (qty < LOW_STOCK_THRESHOLD) tone = 'bg-sun/10 text-sun ring-sun/20'
  else tone = 'bg-teal/10 text-teal ring-teal/20'

  return (
    <span className={`inline-flex items-center justify-center rounded-md font-semibold tabular-nums ring-1 ring-inset ${tone} ${pad}`}>
      {Number(qty).toLocaleString()}
    </span>
  )
}
