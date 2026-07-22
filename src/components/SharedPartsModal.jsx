import Modal from './ui/Modal'
import QtyBadge from './QtyBadge'
import { Button } from './ui/controls'
import { IconLayers, IconCart, IconCheck } from './ui/icons'
import { DEVICES } from '../lib/constants'
import { formatNumber, liveQty } from '../lib/format'

const deviceOrder = (d) => {
  const i = DEVICES.findIndex((x) => x.key === d)
  return i === -1 ? 99 : i
}

// Every board that carries the same part. Stock is shown per location and never
// summed — each device keeps its own table and its own physical stock, so a
// combined figure would imply a shared bin that doesn't exist.
export default function SharedPartsModal({ open, onClose, part, locations = [], stock, onGoTo, onAddToCart, inCart }) {
  const sorted = [...locations].sort(
    (a, b) => deviceOrder(a.device) - deviceOrder(b.device) || a.board.localeCompare(b.board),
  )

  // boards carrying this part on more than one row — the split-stock case
  const splitBoards = [
    ...new Set(
      sorted
        .filter((l, _, arr) => arr.filter((o) => o.device === l.device && o.board === l.board).length > 1)
        .map((l) => `${l.device} · ${l.board}`),
    ),
  ]

  const qtyOf = (loc) => {
    const bucket = stock?.[loc.device]
    if (!bucket) return null
    return liveQty(loc.row, bucket.byComponent[loc.row.id] || [])
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="max-w-2xl"
      icon={<IconLayers />}
      title={part ? `${part.component} · ${part.value || part.value_raw || ''}` : 'Shared part'}
      subtitle={
        part
          ? `${part.package || 'no package'} — used on ${sorted.length} board${sorted.length === 1 ? '' : 's'}`
          : ''
      }
      footer={<Button variant="soft" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4">
        {splitBoards.length > 0 && (
          <p className="rounded-lg bg-sun/12 px-3 py-2 text-xs text-sun ring-1 ring-sun/25">
            This part is listed more than once on {splitBoards.join(' and ')}, so its stock is split across
            separate rows — one can read zero while another holds the lot. Worth merging them.
          </p>
        )}

        <ul className="divide-y divide-line2 overflow-hidden rounded-xl ring-1 ring-line">
          {sorted.map((loc) => {
            const qty = qtyOf(loc)
            const queued = inCart(loc.device, loc.row.id)
            return (
              <li key={`${loc.device}::${loc.row.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-surface px-4 py-3">
                <button onClick={() => onGoTo(loc.device, loc.board)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-semibold text-ink">{loc.device}</span>
                    <span className="text-sm text-mute">{loc.board}</span>
                    <span className="text-xs tabular-nums text-faint">
                      #{loc.row.s_no ?? loc.row.s_no_raw ?? '—'}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
                    {loc.row.label && <span className="break-words">{loc.row.label}</span>}
                    {loc.row.part_number && <span className="font-mono">{loc.row.part_number}</span>}
                    {loc.row.supply_form && (
                      <span className="rounded bg-surface2 px-1.5 py-0.5 text-[11px] text-mute ring-1 ring-line2">
                        {loc.row.supply_form}
                      </span>
                    )}
                  </div>
                </button>

                <div className="flex shrink-0 items-center gap-2">
                  {qty == null ? (
                    <span className="text-xs text-faint">…</span>
                  ) : (
                    <QtyBadge qty={qty} note={loc.row.quantity_note} hasActivity />
                  )}
                  <button
                    onClick={() => onAddToCart(loc.device, loc.row)}
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

        <p className="text-xs text-faint">
          Matched on component, value and package. Each board holds its own stock — the figures above are
          separate, not a combined total
          {sorted.some((l) => qtyOf(l) != null) &&
            ` (${formatNumber(sorted.reduce((s, l) => s + (qtyOf(l) || 0), 0))} across all of them)`}
          .
        </p>
      </div>
    </Modal>
  )
}
