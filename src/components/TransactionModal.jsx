import { useEffect, useMemo, useState } from 'react'
import Modal from './ui/Modal'
import { Field, NumberInput, DateInput, TextArea, Button } from './ui/controls'
import { IconInward, IconOutward, IconReturn } from './ui/icons'
import { TXN_META } from '../lib/constants'
import { formatDate, formatNumber, todayISO } from '../lib/format'
import { insertTransaction } from '../lib/db'

const ICONS = { inward: <IconInward />, outward: <IconOutward />, return: <IconReturn /> }

export default function TransactionModal({ open, onClose, onSaved, device, mode, component, currentQty, openOutwards = [] }) {
  const meta = TXN_META[mode] || TXN_META.inward
  const [qty, setQty] = useState('')
  const [needed, setNeeded] = useState('')
  const [relatedId, setRelatedId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setQty(''); setNeeded(''); setRelatedId(''); setReason('')
    setDate(todayISO()); setError(null); setSaving(false)
  }, [open, mode])

  const numQty = Number(qty) || 0
  const resulting = useMemo(() => {
    if (mode === 'outward') return currentQty - numQty
    return currentQty + numQty
  }, [mode, currentQty, numQty])

  const exceeds = mode === 'outward' && numQty > currentQty

  function onPickOutward(id) {
    setRelatedId(id)
    const o = openOutwards.find((x) => x.id === id)
    if (o && o.remaining != null) setQty(String(o.remaining))
  }

  async function handleSave() {
    if (numQty <= 0) {
      setError('Enter a quantity greater than zero.')
      return
    }
    if (mode === 'outward' && (needed === '' || Number(needed) <= 0)) {
      setError('Enter the quantity needed.')
      return
    }
    if (mode === 'return' && openOutwards.length > 0 && !relatedId) {
      setError('Select which outward this return is against.')
      return
    }
    if (mode === 'return' && relatedId) {
      const o = openOutwards.find((x) => x.id === relatedId)
      if (o && o.remaining != null && numQty > o.remaining) {
        setError(`Only ${formatNumber(o.remaining)} still out on that outward — a return can't exceed it.`)
        return
      }
    }
    if (!date) {
      setError('Select a date.')
      return
    }
    if (!reason.trim()) {
      setError('Enter a reason / reference.')
      return
    }
    setSaving(true)
    setError(null)
    const payload = { component_id: component.id, type: mode, txn_date: date, reason: reason.trim() || null }
    if (mode === 'inward') payload.qty = numQty
    else if (mode === 'return') { payload.qty = numQty; payload.related_txn_id = relatedId || null }
    else if (mode === 'outward') { payload.qty_sent = numQty; payload.qty_needed = needed === '' ? null : Number(needed) }
    try {
      await insertTransaction(device, payload)
      await onSaved?.()
      onClose?.()
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  const qtyLabel = mode === 'inward' ? 'Quantity received' : mode === 'return' ? 'Quantity returned' : 'Quantity sending'

  return (
    <Modal
      open={open}
      onClose={onClose}
      closable={!saving}
      maxWidth="max-w-md"
      icon={ICONS[mode]}
      title={`${meta.label} — ${component?.component || ''}`}
      subtitle={component?.value_raw || component?.value || component?.label || ''}
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            variant={mode === 'outward' ? 'danger' : mode === 'return' ? 'primary' : 'emerald'}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : `Record ${meta.label}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-surface2 px-4 py-3 ring-1 ring-line">
          <span className="text-sm text-mute">Current in hand</span>
          <span className="text-lg font-semibold tabular-nums text-ink">{formatNumber(currentQty)}</span>
        </div>

        {mode === 'outward' && (
          <p className="rounded-lg bg-sun/12 px-3 py-2 text-xs text-sun ring-1 ring-sun/25">
            Whole reels can’t be cut — <b>Sending</b> is the amount that actually leaves stock. Record the unused
            part later with <b>Return</b>.
          </p>
        )}

        {mode === 'return' && openOutwards.length > 0 && (
          <Field label="Against which outward?" required>
            <select
              value={relatedId}
              onChange={(e) => onPickOutward(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface2 px-3 py-2 text-base text-ink outline-none focus:border-primary sm:text-sm focus:ring-2 focus:ring-primary/25"
            >
              <option value="" disabled>Select an outward…</option>
              {openOutwards.map((o) => (
                <option key={o.id} value={o.id}>
                  {formatDate(o.txn_date)} · sent {formatNumber(o.qty_sent)}
                  {o.remaining != null ? ` · ${formatNumber(o.remaining)} out` : ''}
                  {o.reason ? ` · ${o.reason}` : ''}
                </option>
              ))}
            </select>
          </Field>
        )}

        {mode === 'outward' && (
          <Field label="Quantity needed" hint="How much the job actually needs" required>
            <NumberInput value={needed} onChange={(e) => setNeeded(e.target.value)} placeholder="e.g. 200" min="0" />
          </Field>
        )}

        <Field label={qtyLabel} required>
          <NumberInput value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" min="0" autoFocus />
        </Field>

        <Field label="Date" required>
          <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>

        <Field label="Reason / reference" required>
          <TextArea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              mode === 'inward' ? 'e.g. PO#1234 stock received'
                : mode === 'outward' ? 'e.g. Production batch B-07'
                : 'e.g. Unused reel returned from batch B-07'
            }
          />
        </Field>

        {numQty > 0 && (
          <div className={`flex items-center justify-between rounded-lg px-4 py-3 ring-1 ${exceeds ? 'bg-coral/12 ring-coral/30' : 'bg-surface2 ring-line'}`}>
            <span className="text-sm text-mute">In hand after {meta.label.toLowerCase()}</span>
            <span className={`text-lg font-semibold tabular-nums ${exceeds ? 'text-coral' : 'text-ink'}`}>
              {formatNumber(resulting)}
            </span>
          </div>
        )}
        {exceeds && (
          <p className="text-xs text-coral">Sending more than the current stock — this will go negative.</p>
        )}

        {error && (
          <div className="rounded-lg bg-coral/12 px-3 py-2 text-sm text-coral ring-1 ring-coral/30">{error}</div>
        )}
      </div>
    </Modal>
  )
}
