import { useEffect, useMemo, useState } from 'react'
import Modal from './ui/Modal'
import Combobox from './ui/Combobox'
import { Field, TextInput, NumberInput, Button } from './ui/controls'
import { IconChip } from './ui/icons'
import { COMPONENT_TYPES, DEVICES, DEVICE_SUB_BOARDS, FIELD_META, MAX_QTY, SUPPLY_FORMS, valueFieldsFor } from '../lib/constants'
import { formatNumber } from '../lib/format'
import { insertComponent, updateComponent, nextRowMeta } from '../lib/db'

const EMPTY = {
  device: '', sub_board: '', component: '', value: '', voltage: '', rating: '', material: '',
  tolerance: '', label: '', package: '', part_number: '', identification_number: '', supply_form: '',
  opening_quantity: '', quantity_note: '',
}

function buildValueRaw(form) {
  const fields = valueFieldsFor(form.component)
  if (fields.length <= 1) return (form.value || '').trim()
  const parts = fields.map((f) => (form[f] || '').trim()).filter(Boolean)
  return parts.join(', ')
}

const selectCls =
  'w-full rounded-lg border border-line bg-surface2 px-3 py-2 text-base text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm'

export default function ComponentFormModal({ open, onClose, onSaved, device, subBoard, initial, options }) {
  const isEdit = Boolean(initial)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [openingBad, setOpeningBad] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setOpeningBad(false)
    if (initial) {
      setForm({
        device,
        sub_board: initial.sub_board ?? subBoard ?? '',
        component: initial.component ?? '',
        value: initial.value ?? '',
        voltage: initial.voltage ?? '',
        rating: initial.rating ?? '',
        material: initial.material ?? '',
        tolerance: initial.tolerance ?? '',
        label: initial.label ?? '',
        package: initial.package ?? '',
        part_number: initial.part_number ?? '',
        identification_number: initial.identification_number ?? '',
        supply_form: initial.supply_form ?? '',
        opening_quantity: initial.opening_quantity ?? '',
        quantity_note: initial.quantity_note ?? '',
      })
    } else {
      setForm({ ...EMPTY, device, sub_board: subBoard ?? '' })
    }
    // Seed only when the modal opens (or targets a different row) — reloads while
    // the modal is open must not wipe in-progress input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial])

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: typeof v === 'string' ? v : v?.target?.value ?? v }))
  const valueFields = useMemo(() => valueFieldsFor(form.component), [form.component])
  const componentOptions = useMemo(() => {
    const set = new Set([...(options?.component || []), ...COMPONENT_TYPES])
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [options])

  const subBoardOptions = useMemo(() => {
    const opts = new Set(DEVICE_SUB_BOARDS[form.device] || [])
    if (form.sub_board) opts.add(form.sub_board) // keep an existing row's board selectable
    return [...opts]
  }, [form.device, form.sub_board])

  // Switching device switches the whole table the row lands in, so the
  // sub-board has to move to one that device actually has.
  function onPickDevice(e) {
    const d = e.target.value
    setForm((f) => ({ ...f, device: d, sub_board: (DEVICE_SUB_BOARDS[d] || [])[0] || '' }))
  }

  async function handleSave() {
    const compTrim = form.component.trim()
    if (!compTrim) {
      setError('Component type is required.')
      return
    }
    if (!form.sub_board) {
      setError('Select a sub-board.')
      return
    }
    const openingQty = form.opening_quantity === '' ? 0 : Number(form.opening_quantity)
    if (openingBad || !Number.isFinite(openingQty) || openingQty < 0) {
      setError('Opening stock is not a valid number — please re-enter it.')
      return
    }
    if (openingQty > MAX_QTY) {
      setError(`Opening stock is too large — enter ${formatNumber(MAX_QTY)} or less.`)
      return
    }
    setSaving(true)
    setError(null)
    // snap to the canonical option so 'capacitor'/'Capacitor ' don't create duplicates
    const component = componentOptions.find((o) => o.toLowerCase() === compTrim.toLowerCase()) || compTrim
    const parametric = valueFields.length > 1
    const targetDevice = form.device || device
    const targetBoard = form.sub_board
    const boardChanged = isEdit && targetBoard !== initial.sub_board

    const payload = {
      sub_board: targetBoard,
      component,
      value: (form.value || '').trim() || null,
      voltage: parametric ? (form.voltage || '').trim() || null : null,
      rating: parametric ? (form.rating || '').trim() || null : null,
      material: parametric ? (form.material || '').trim() || null : null,
      tolerance: parametric ? (form.tolerance || '').trim() || null : null,
      label: (form.label || '').trim() || null,
      package: (form.package || '').trim() || null,
      part_number: (form.part_number || '').trim() || null,
      identification_number: (form.identification_number || '').trim() || null,
      supply_form: form.supply_form || null,
      opening_quantity: openingQty,
      quantity_note: (form.quantity_note || '').trim() || null,
    }

    // value_raw is the original spec cell and often holds detail no column parsed
    // out (an ESR figure, a vendor part no.) that buildValueRaw can't rebuild, so
    // re-derive it only when a parsed sub-field actually differs — comparing the
    // derived string rewrites even on a no-op combobox re-commit. Omitting the key
    // leaves the column alone, since pickComponent copies only what's present.
    const writeValueRaw =
      !isEdit || valueFields.some((f) => (form[f] || '').trim() !== (initial[f] ?? '').trim())
    if (writeValueRaw) payload.value_raw = buildValueRaw(form) || null

    try {
      if (isEdit) {
        // s_no / s_no_raw are omitted so an existing row keeps its serial;
        // only a board move needs re-ordering to the end of the new board.
        if (boardChanged) {
          const { nextSNo, nextSortOrder } = await nextRowMeta(targetDevice, targetBoard)
          payload.sort_order = nextSortOrder
          payload.s_no = nextSNo
          payload.s_no_raw = String(nextSNo)
        }
        await updateComponent(targetDevice, initial.id, payload)
      } else {
        // serial and position are assigned automatically from existing data
        const { nextSNo, nextSortOrder } = await nextRowMeta(targetDevice, targetBoard)
        payload.s_no = nextSNo
        payload.s_no_raw = String(nextSNo)
        payload.sort_order = nextSortOrder
        await insertComponent(targetDevice, payload)
      }
      await onSaved?.(targetDevice, targetBoard)
      onClose?.()
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      closable={!saving}
      maxWidth="max-w-2xl"
      icon={<IconChip />}
      title={isEdit ? 'Edit component' : 'Add component'}
      subtitle={isEdit ? `${form.device} · ${form.sub_board}` : 'Choose the board it belongs to'}
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add component'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-12">
          <Field
            label="Device"
            required
            className="col-span-2 sm:col-span-3"
            hint={isEdit ? 'Moving between devices isn’t supported' : undefined}
          >
            <select value={form.device} onChange={onPickDevice} disabled={isEdit} className={selectCls}>
              {DEVICES.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Sub-board" required className="col-span-2 sm:col-span-3">
            <select value={form.sub_board} onChange={set('sub_board')} className={selectCls}>
              {subBoardOptions.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </Field>
          <Field label="Component" required className="col-span-2 sm:col-span-3">
            <Combobox value={form.component} onChange={set('component')} options={componentOptions} placeholder="e.g. Capacitor" />
          </Field>
          <Field label="Package (Type)" className="col-span-2 sm:col-span-3">
            <Combobox value={form.package} onChange={set('package')} options={options?.package || []} placeholder="e.g. C0402" />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">Value</span>
            <span className="h-px flex-1 bg-line2" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {valueFields.map((f) => (
              <Field key={f} label={FIELD_META[f].label} className={valueFields.length === 1 ? 'col-span-2 sm:col-span-4' : ''}>
                <Combobox
                  value={form[f]}
                  onChange={set(f)}
                  options={options?.[f] || []}
                  placeholder={FIELD_META[f].placeholder}
                />
              </Field>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Label (designators)" className="col-span-2 sm:col-span-3">
            <TextInput value={form.label} onChange={set('label')} placeholder="e.g. C4,C5,C25,C26" />
          </Field>
          <Field label="Part Number" hint="Distributor code" className="col-span-2 sm:col-span-1">
            <TextInput value={form.part_number} onChange={set('part_number')} placeholder="e.g. C60474" />
          </Field>
          <Field label="Identification No." hint="Manufacturer’s own number" className="col-span-2 sm:col-span-1">
            <TextInput
              value={form.identification_number}
              onChange={set('identification_number')}
              placeholder="e.g. GRM155R71C104KA88D"
            />
          </Field>
          <Field label="Supply form" hint="Blank if it doesn’t apply" className="col-span-2 sm:col-span-1">
            <select value={form.supply_form} onChange={set('supply_form')} className={selectCls}>
              <option value="">—</option>
              {SUPPLY_FORMS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-xl bg-surface2 p-4 ring-1 ring-line">
          <Field
            label={isEdit ? 'Opening stock' : 'Opening stock (starting quantity)'}
            hint={isEdit ? 'Base amount before inward/outward activity.' : 'S.No is assigned automatically.'}
          >
            <NumberInput
              value={form.opening_quantity}
              onChange={(e) => {
                setOpeningBad(Boolean(e.target?.validity?.badInput))
                set('opening_quantity')(e)
              }}
              min="0"
              placeholder="0"
            />
          </Field>
          <Field label="Qty note" hint="e.g. NC when not counted">
            <TextInput value={form.quantity_note} onChange={set('quantity_note')} placeholder="—" />
          </Field>
        </div>

        {error && (
          <div className="rounded-lg bg-coral/12 px-3 py-2 text-sm text-coral ring-1 ring-coral/30">{error}</div>
        )}
      </div>
    </Modal>
  )
}
