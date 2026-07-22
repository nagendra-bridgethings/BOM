import { useEffect, useMemo, useState } from 'react'
import Modal from './ui/Modal'
import { Field, NumberInput, DateInput, TextArea, Button } from './ui/controls'
import { IconCart, IconTrash, IconWarning } from './ui/icons'
import { DEVICES, MAX_QTY } from '../lib/constants'
import { formatNumber, liveQty, todayISO } from '../lib/format'
import { fetchDeviceStock, insertTransactions } from '../lib/db'

const deviceOrder = (d) => {
  const i = DEVICES.findIndex((x) => x.key === d)
  return i === -1 ? 99 : i
}

export default function CartModal({ open, onClose, lines, onSetQty, onRemove, onDone }) {
  const [date, setDate] = useState(todayISO())
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  // live in-hand per device::id, re-read on open — a cart can sit for an hour
  // while other people move stock, so the snapshot taken at add time is not safe
  // to validate against.
  const [stock, setStock] = useState(null)
  const [stockError, setStockError] = useState(null)

  const devicesInCart = useMemo(
    () => [...new Set(lines.map((l) => l.device))].sort((a, b) => deviceOrder(a) - deviceOrder(b)),
    [lines],
  )

  useEffect(() => {
    if (!open) return
    setError(null)
    setSaving(false)
    setStock(null)
    setStockError(null)
    let cancelled = false
    ;(async () => {
      try {
        const entries = {}
        for (const device of devicesInCart) {
          const { components, byComponent } = await fetchDeviceStock(device)
          for (const c of components) {
            entries[`${device}::${c.id}`] = liveQty(c, byComponent[c.id] || [])
          }
        }
        if (!cancelled) setStock(entries)
      } catch (e) {
        if (!cancelled) setStockError(e.message || String(e))
      }
    })()
    return () => {
      cancelled = true
    }
    // devicesInCart is derived from lines; re-reading on every edit would refetch
    // on each keystroke, so this deliberately only runs when the modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const inHand = (l) => stock?.[`${l.device}::${l.id}`]

  const grouped = useMemo(() => {
    const g = new Map()
    for (const l of lines) {
      if (!g.has(l.device)) g.set(l.device, [])
      g.get(l.device).push(l)
    }
    return [...g.entries()].sort((a, b) => deviceOrder(a[0]) - deviceOrder(b[0]))
  }, [lines])

  const filled = lines.filter((l) => String(l.sending).trim() !== '')
  const shortfalls = filled.filter((l) => {
    const q = inHand(l)
    return q != null && Number(l.sending) > q
  })

  // rows removed from the DB (or from a device) since they were queued
  const missing = stock ? lines.filter((l) => inHand(l) == null) : []

  function validate() {
    if (lines.length === 0) return 'The cart is empty.'
    for (const l of lines) {
      const label = `${l.component}${l.value_raw ? ` ${l.value_raw}` : ''}`
      const sending = String(l.sending).trim()
      const needed = String(l.needed).trim()
      if (needed === '' || sending === '') return `Enter both quantities for ${label}.`
      const ns = Number(sending)
      const nn = Number(needed)
      if (!Number.isFinite(ns) || !Number.isFinite(nn)) return `The quantities for ${label} are not valid numbers.`
      if (ns <= 0 || nn <= 0) return `Quantities for ${label} must be greater than zero.`
      if (ns > MAX_QTY || nn > MAX_QTY) {
        return `Quantities for ${label} are too large — enter ${formatNumber(MAX_QTY)} or less.`
      }
    }
    if (!date) return 'Select a date.'
    if (!reason.trim()) return 'Enter a reason / reference for this batch.'
    return null
  }

  async function handleSubmit() {
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    if (missing.length > 0) {
      setError(`${missing.length} item(s) no longer exist in the database — remove them before recording.`)
      return
    }
    setSaving(true)
    setError(null)

    // One id for the whole issue, shared across every device it touches — that
    // is what lets batch history show a 4G + LORA pick as a single entry.
    const batchId = crypto.randomUUID()
    const done = []
    const failed = []
    for (const [device, items] of grouped) {
      const rows = items.map((l) => ({
        component_id: l.id,
        type: 'outward',
        qty_sent: Number(l.sending),
        qty_needed: Number(l.needed),
        txn_date: date,
        reason: reason.trim(),
        batch_id: batchId,
      }))
      try {
        await insertTransactions(device, rows)
        done.push(device)
      } catch (e) {
        failed.push({ device, message: e.message || String(e) })
      }
    }

    setSaving(false)
    // Devices that committed leave the cart; the rest stay queued so a retry
    // can't double-issue what already went out.
    onDone(done, failed)
    if (failed.length === 0) {
      onClose?.()
      return
    }
    setError(
      `Recorded for ${done.length ? done.join(', ') : 'no device'}. Failed for ` +
        `${failed.map((f) => `${f.device} (${f.message})`).join('; ')}. ` +
        'The failed items are still in the cart — fix the problem and record again.',
    )
  }

  const totalUnits = filled.reduce((s, l) => s + (Number(l.sending) || 0), 0)

  return (
    <Modal
      open={open}
      onClose={onClose}
      closable={!saving}
      maxWidth="max-w-3xl"
      icon={<IconCart />}
      title="Bulk outward"
      subtitle={
        lines.length
          ? `${lines.length} item${lines.length === 1 ? '' : 's'} across ${devicesInCart.join(', ')}`
          : 'Nothing queued yet'
      }
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={saving}>Close</Button>
          <Button variant="danger" onClick={handleSubmit} disabled={saving || lines.length === 0}>
            {saving ? 'Recording…' : `Record outward${filled.length ? ` (${formatNumber(totalUnits)} units)` : ''}`}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {lines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line py-12 text-center">
            <p className="text-sm font-medium text-mute">The cart is empty</p>
            <p className="mt-1 text-sm text-faint">
              Use <span className="font-medium text-mute">Select</span> above the table to tick items, on any device.
            </p>
          </div>
        ) : (
          <>
            {stockError && (
              <p className="rounded-lg bg-sun/12 px-3 py-2 text-xs text-sun ring-1 ring-sun/25">
                Couldn’t re-check current stock ({stockError}) — the in-hand figures below may be out of date.
              </p>
            )}

            {grouped.map(([device, items]) => (
              <div key={device}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">{device}</span>
                  <span className="h-px flex-1 bg-line2" />
                  <span className="text-[11px] text-faint">{items.length}</span>
                </div>
                <ul className="divide-y divide-line2 overflow-hidden rounded-xl ring-1 ring-line">
                  {items.map((l) => {
                    const q = inHand(l)
                    const gone = stock && q == null
                    const short = q != null && String(l.sending).trim() !== '' && Number(l.sending) > q
                    return (
                      <li key={`${l.device}::${l.id}`} className="bg-surface px-4 py-3">
                        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <span className="text-xs tabular-nums text-faint">{l.s_no ?? l.s_no_raw ?? '—'}</span>
                              <span className="text-sm font-semibold text-ink">{l.component || '—'}</span>
                              <span className="text-sm text-ink/80">{l.value_raw || '—'}</span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-faint">
                              <span>{l.sub_board}</span>
                              {l.package && <span className="font-mono">{l.package}</span>}
                              {l.supply_form && (
                                <span className="rounded bg-surface2 px-1.5 py-0.5 text-[11px] text-mute ring-1 ring-line2">
                                  {l.supply_form}
                                </span>
                              )}
                              {gone ? (
                                <span className="text-coral">no longer in the database</span>
                              ) : (
                                <span>in hand <span className="tabular-nums text-mute">{q == null ? '…' : formatNumber(q)}</span></span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-end gap-2">
                            <Field label="Needed" className="w-24">
                              <NumberInput
                                value={l.needed}
                                onChange={(e) => {
                                  const v = e.target.value
                                  onSetQty(l.device, l.id, 'needed', v)
                                  // sending follows needed until it is edited on its own,
                                  // so only reel items need a second number typed
                                  if (String(l.sending).trim() === '' || l.sending === l.needed) {
                                    onSetQty(l.device, l.id, 'sending', v)
                                  }
                                }}
                                min="0"
                                placeholder="0"
                              />
                            </Field>
                            <Field label="Sending" className="w-24">
                              <NumberInput
                                value={l.sending}
                                onChange={(e) => onSetQty(l.device, l.id, 'sending', e.target.value)}
                                min="0"
                                placeholder="0"
                                className={short ? 'border-coral text-coral' : ''}
                              />
                            </Field>
                            <button
                              onClick={() => onRemove(l.device, l.id)}
                              title="Remove from cart"
                              className="mb-1 inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg p-1.5 text-faint transition hover:bg-coral/12 hover:text-coral"
                            >
                              <IconTrash width={15} height={15} />
                            </button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}

            {shortfalls.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-coral/12 px-3 py-2 text-xs text-coral ring-1 ring-coral/30">
                <IconWarning width={14} height={14} className="mt-0.5 shrink-0" />
                <span>
                  {shortfalls.length} item{shortfalls.length === 1 ? '' : 's'} send more than what is in hand.
                  Recording will take {shortfalls.length === 1 ? 'it' : 'them'} negative.
                </span>
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 rounded-xl bg-surface2 p-4 ring-1 ring-line sm:grid-cols-3">
              <Field label="Date" required className="sm:col-span-1">
                <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field
                label="Reason / reference"
                required
                hint="Applies to every item in this batch."
                className="sm:col-span-2"
              >
                <TextArea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Production batch B-07"
                />
              </Field>
            </div>
          </>
        )}

        {error && (
          <div className="rounded-lg bg-coral/12 px-3 py-2 text-sm text-coral ring-1 ring-coral/30">{error}</div>
        )}
      </div>
    </Modal>
  )
}
