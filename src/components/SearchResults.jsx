import QtyBadge from './QtyBadge'
import { valueChips } from '../lib/format'
import { LOW_STOCK_THRESHOLD } from '../lib/constants'
import { IconCart, IconCheck } from './ui/icons'

// Cross-device search results. Deliberately a list rather than the main grid:
// every row has to carry its device and board (the same part exists on several),
// and stacking that into the 8-column table would push the actions off-screen —
// the width problem that already cost the ⋯ menu once.

function stripeFor(c) {
  if (c._qty <= 0 && c._txnCount > 0) return 'border-l-2 border-l-coral'
  if (c._qty > 0 && c._qty < LOW_STOCK_THRESHOLD) return 'border-l-2 border-l-sun'
  return 'border-l-2 border-l-transparent'
}

export default function SearchResults({ groups, total, query, loading, error, onGoTo, onAddToCart, inCart }) {
  if (error) {
    return (
      <div className="rounded-xl border border-line bg-surface p-8 text-center">
        <p className="text-base font-semibold text-ink">Couldn’t search every device</p>
        <p className="mt-2 text-sm text-mute">{error}</p>
      </div>
    )
  }

  if (loading && total === 0) {
    return <div className="py-16 text-center text-sm text-faint">Searching all devices…</div>
  }

  if (total === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-surface py-16 text-center">
        <p className="text-sm font-medium text-mute">Nothing matches “{query}”</p>
        <p className="mt-1 text-sm text-faint">Searched 4G, RS485 and LORA, every board.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {groups.map(({ device, boards }) => (
        <div key={device}>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">{device}</span>
            <span className="h-px flex-1 bg-line2" />
            <span className="text-[11px] tabular-nums text-faint">
              {boards.reduce((s, b) => s + b.rows.length, 0)}
            </span>
          </div>

          <div className="space-y-3">
            {boards.map(({ board, rows }) => (
              <div key={board}>
                <p className="mb-1.5 text-xs font-medium text-mute">{board}</p>
                <ul className="divide-y divide-line2 overflow-hidden rounded-xl ring-1 ring-line">
                  {rows.map((c) => {
                    const chips = valueChips(c)
                    const queued = inCart(device, c.id)
                    return (
                      <li
                        key={c.id}
                        className={`flex flex-wrap items-center gap-x-4 gap-y-2 bg-surface px-4 py-3 ${stripeFor(c)}`}
                      >
                        <button
                          onClick={() => onGoTo(device, board, c)}
                          title="Open on its board"
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="text-xs tabular-nums text-faint">{c.s_no ?? c.s_no_raw ?? '—'}</span>
                            <span className="text-sm font-semibold text-ink">{c.component || '—'}</span>
                            <span className="text-sm text-ink/85">{c.value || c.value_raw || '—'}</span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
                            {c.package && <span className="font-mono text-ink/70">{c.package}</span>}
                            {c.part_number && <span className="font-mono">{c.part_number}</span>}
                            {c.label && <span className="break-words">{c.label}</span>}
                            {chips.map((ch, i) => (
                              <span key={i} className="rounded bg-surface2 px-1.5 py-0.5 text-[11px] text-mute ring-1 ring-line2">
                                {ch}
                              </span>
                            ))}
                          </div>
                        </button>

                        <div className="flex shrink-0 items-center gap-2">
                          <QtyBadge qty={c._qty} note={c.quantity_note} hasActivity={c._txnCount > 0} />
                          <button
                            onClick={() => onAddToCart(device, c)}
                            disabled={queued}
                            title={queued ? 'Already in the cart' : 'Add to cart'}
                            className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                              queued
                                ? 'border-primary/30 bg-primary/10 text-primary'
                                : 'border-line bg-surface text-mute hover:border-primary/40 hover:bg-primary/5 hover:text-ink'
                            }`}
                          >
                            {queued ? <IconCheck width={14} height={14} /> : <IconCart width={14} height={14} />}
                            {queued ? 'In cart' : 'Cart'}
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
