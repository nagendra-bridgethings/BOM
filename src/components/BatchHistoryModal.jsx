import { useEffect, useState } from 'react'
import Modal from './ui/Modal'
import { Button } from './ui/controls'
import { IconHistory, IconChevronDown } from './ui/icons'
import { formatDate, formatNumber } from '../lib/format'
import { fetchBatches } from '../lib/db'

export default function BatchHistoryModal({ open, onClose }) {
  const [batches, setBatches] = useState(null)
  const [error, setError] = useState(null)
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    if (!open) return
    setBatches(null)
    setError(null)
    setOpenId(null)
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchBatches()
        if (!cancelled) setBatches(data)
      } catch (e) {
        if (!cancelled) setError(e.message || String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="max-w-3xl"
      icon={<IconHistory />}
      title="Bulk outward history"
      subtitle={batches ? `${batches.length} batch${batches.length === 1 ? '' : 'es'}` : 'Loading…'}
      footer={<Button variant="soft" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-3">
        {error && (
          <div className="rounded-lg bg-coral/12 px-3 py-2 text-sm text-coral ring-1 ring-coral/30">
            {error}
          </div>
        )}

        {!batches && !error && (
          <div className="py-12 text-center text-sm text-faint">Loading…</div>
        )}

        {batches && batches.length === 0 && (
          <div className="rounded-xl border border-dashed border-line py-12 text-center">
            <p className="text-sm font-medium text-mute">No bulk outwards yet</p>
            <p className="mt-1 text-sm text-faint">
              Anything issued through the cart shows up here as one batch.
            </p>
          </div>
        )}

        {batches?.map((b) => {
          const expanded = openId === b.batch_id
          return (
            <div key={b.batch_id} className="overflow-hidden rounded-xl ring-1 ring-line">
              <button
                onClick={() => setOpenId(expanded ? null : b.batch_id)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-3 bg-surface px-4 py-3 text-left transition hover:bg-surface2/70"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-ink">{formatDate(b.txn_date)}</span>
                    {b.devices.map((d) => (
                      <span
                        key={d}
                        className="rounded bg-surface2 px-1.5 py-0.5 text-[11px] font-medium text-mute ring-1 ring-line2"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                  {b.reason && <p className="mt-0.5 truncate text-xs text-mute">{b.reason}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold tabular-nums text-coral">
                    −{formatNumber(b.totalUnits)}
                  </div>
                  <div className="text-[11px] text-faint">
                    {b.lines.length} item{b.lines.length === 1 ? '' : 's'}
                  </div>
                </div>
                <IconChevronDown
                  width={16}
                  height={16}
                  className={`shrink-0 text-faint transition ${expanded ? 'rotate-180' : ''}`}
                />
              </button>

              {expanded && (
                <ul className="divide-y divide-line2 border-t border-line2">
                  {b.lines.map((l) => (
                    <li key={l.id} className="flex items-center gap-3 bg-surface2/40 px-4 py-2.5">
                      <span className="w-12 shrink-0 text-[11px] font-medium text-faint">{l.device}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-xs tabular-nums text-faint">
                            {l.component?.s_no ?? l.component?.s_no_raw ?? '—'}
                          </span>
                          <span className="text-sm font-medium text-ink">
                            {l.component?.component || 'Deleted component'}
                          </span>
                          <span className="text-xs text-mute">
                            {l.component?.value_raw || l.component?.value || ''}
                          </span>
                        </div>
                        {l.component?.sub_board && (
                          <p className="text-[11px] text-faint">{l.component.sub_board}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold tabular-nums text-coral">
                          −{formatNumber(l.qty_sent)}
                        </div>
                        {l.qty_needed != null && (
                          <div className="text-[11px] tabular-nums text-faint">
                            needed {formatNumber(l.qty_needed)}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
