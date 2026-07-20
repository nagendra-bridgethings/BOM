import { useState } from 'react'
import Modal from './ui/Modal'
import { Button } from './ui/controls'
import { IconHistory, IconTrash, IconInward, IconOutward, IconReturn } from './ui/icons'
import { TXN_META } from '../lib/constants'
import { formatDate, formatNumber, txnDelta } from '../lib/format'
import { deleteTransaction } from '../lib/db'
import QtyBadge from './QtyBadge'

const ICONS = { inward: <IconInward width={14} height={14} />, outward: <IconOutward width={14} height={14} />, return: <IconReturn width={14} height={14} /> }

export default function HistoryModal({ open, onClose, onChanged, device, component, txns = [], currentQty }) {
  const [busyId, setBusyId] = useState(null)
  const opening = Number(component?.opening_quantity) || 0

  // running balance, oldest -> newest
  let bal = opening
  const rows = txns.map((t) => {
    bal += txnDelta(t)
    return { ...t, balance: bal }
  })
  const display = [...rows].reverse() // newest first

  async function handleDelete(id) {
    if (!window.confirm('Delete this transaction? Stock will be recalculated.')) return
    setBusyId(id)
    try {
      await deleteTransaction(device, id)
      await onChanged?.()
    } catch (e) {
      window.alert(e.message || String(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      closable={!busyId}
      maxWidth="max-w-2xl"
      icon={<IconHistory />}
      title={`History — ${component?.component || ''}`}
      subtitle={component?.value_raw || component?.label || ''}
      footer={<Button variant="soft" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-surface2 px-4 py-3 text-sm ring-1 ring-line">
          <div className="flex items-center gap-2">
            <span className="text-mute">Opening</span>
            <span className="font-semibold tabular-nums text-ink">{formatNumber(opening)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-mute">Transactions</span>
            <span className="font-semibold tabular-nums text-ink">{txns.length}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-mute">In hand</span>
            <QtyBadge qty={currentQty} note={component?.quantity_note} hasActivity={txns.length > 0} />
          </div>
        </div>

        {display.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line py-10 text-center text-sm text-faint">
            No transactions yet. Use Inward, Outward or Return to start the trail.
          </div>
        ) : (
          <ul className="divide-y divide-line2 overflow-hidden rounded-xl ring-1 ring-line">
            {display.map((t) => {
              const meta = TXN_META[t.type]
              const delta = txnDelta(t)
              return (
                <li key={t.id} className="flex items-center gap-3 bg-surface px-4 py-3">
                  <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${meta.tone}`}>
                    {ICONS[t.type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium text-ink">{meta.label}</span>
                      <span className="whitespace-nowrap text-xs text-faint">{formatDate(t.txn_date)}</span>
                      {t.type === 'outward' && t.qty_needed != null && (
                        <span className="whitespace-nowrap rounded bg-raise px-1.5 py-0.5 text-[11px] text-mute">
                          needed {formatNumber(t.qty_needed)}
                        </span>
                      )}
                    </div>
                    {t.reason && <p className="truncate text-xs text-mute">{t.reason}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`text-sm font-semibold tabular-nums ${delta >= 0 ? 'text-teal' : 'text-coral'}`}>
                      {delta >= 0 ? '+' : '−'}{formatNumber(Math.abs(delta))}
                    </div>
                    <div className="text-[11px] tabular-nums text-faint">bal {formatNumber(t.balance)}</div>
                  </div>
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={busyId === t.id}
                    className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg p-1.5 text-faint transition hover:bg-coral/12 hover:text-coral disabled:opacity-50 xl:min-h-0 xl:min-w-0"
                    title="Delete transaction"
                  >
                    <IconTrash width={15} height={15} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Modal>
  )
}
