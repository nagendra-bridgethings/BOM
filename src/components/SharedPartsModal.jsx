import Modal from './ui/Modal'
import QtyBadge from './QtyBadge'
import { Button } from './ui/controls'
import { IconLayers, IconCart, IconCheck } from './ui/icons'
import { DEVICES } from '../lib/constants'
import { formatNumber } from '../lib/format'

const deviceOrder = (d) => {
  const i = DEVICES.findIndex((x) => x.key === d)
  return i === -1 ? 99 : i
}

// Every board across every device that carries the same part.
//
// Stock is listed per location and never summed. Each device keeps its own table
// and its own physical stock, so a combined figure would imply a shared bin that
// does not exist — the total at the foot is there to answer "how many do we own
// altogether", which is a different question from "how many can I use here".
export default function SharedPartsModal({ open, onClose, part, locations = [], currentDevice, onGoTo, onAddToCart, inCart, numberOf }) {
  const byDevice = new Map()
  for (const l of [...locations].sort(
    (a, b) => deviceOrder(a.device) - deviceOrder(b.device) || a.board.localeCompare(b.board),
  )) {
    if (!byDevice.has(l.device)) byDevice.set(l.device, [])
    byDevice.get(l.device).push(l)
  }

  const total = locations.reduce((s, l) => s + (Number(l.qty) || 0), 0)

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="max-w-2xl"
      icon={<IconLayers />}
      title={part ? `${part.component} · ${part.value || part.value_raw || ''}` : 'Where this part is used'}
      subtitle={`${locations.length} row${locations.length === 1 ? '' : 's'} across ${byDevice.size} device${byDevice.size === 1 ? '' : 's'}`}
      footer={<Button variant="soft" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4">
        {[...byDevice.entries()].map(([device, list]) => (
          <div key={device}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">{device}</span>
              {device === currentDevice && (
                <span className="rounded bg-surface2 px-1.5 py-0.5 text-[10px] font-medium text-mute ring-1 ring-line2">
                  current
                </span>
              )}
              <span className="h-px flex-1 bg-line2" />
            </div>

            <ul className="divide-y divide-line2 overflow-hidden rounded-xl ring-1 ring-line">
              {list.map((l) => {
                const queued = inCart(l.device, l.row.id)
                return (
                  <li key={`${l.device}::${l.row.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-surface px-4 py-3">
                    <button onClick={() => onGoTo(l.device, l.board)} className="min-w-0 flex-1 text-left">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-xs tabular-nums text-faint">
                          #{numberOf?.(l.device, l.row.id) ?? '↳'}
                        </span>
                        <span className="text-sm font-medium text-ink">{l.board}</span>
                        <span className="font-mono text-xs text-ink/70">{l.row.package || '—'}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
                        {l.row.part_number && <span className="font-mono">{l.row.part_number}</span>}
                        {l.row.label && <span className="break-words">{l.row.label}</span>}
                        {l.row.supply_form && (
                          <span className="rounded bg-surface2 px-1.5 py-0.5 text-[11px] text-mute ring-1 ring-line2">
                            {l.row.supply_form}
                          </span>
                        )}
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-2">
                      <QtyBadge qty={l.qty} note={l.row.quantity_note} hasActivity={l.txnCount > 0} />
                      <button
                        onClick={() => onAddToCart(l.device, l.row)}
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

        <p className="text-xs text-faint">
          Matched on component and value, so footprints differ between rows — check the package before
          substituting. Each board holds its own stock; these are separate figures, not one pool
          ({formatNumber(total)} across all of them).
        </p>
      </div>
    </Modal>
  )
}
