import { useEffect, useMemo, useState } from 'react'
import Modal from './ui/Modal'
import Combobox from './ui/Combobox'
import { Field, TextInput, NumberInput, Button } from './ui/controls'
import { IconChip } from './ui/icons'
import { COMPONENT_TYPES, FIELD_META, valueFieldsFor } from '../lib/constants'
import { insertComponent, updateComponent } from '../lib/db'

const EMPTY = {
  sub_board: '', s_no: '', component: '', value: '', voltage: '', rating: '', material: '',
  tolerance: '', label: '', package: '', part_number: '',
  opening_quantity: '', quantity_note: '',
}

function buildValueRaw(form) {
  const fields = valueFieldsFor(form.component)
  if (fields.length <= 1) return (form.value || '').trim()
  const parts = fields.map((f) => (form[f] || '').trim()).filter(Boolean)
  return parts.join(', ')
}

export default function ComponentFormModal({ open, onClose, onSaved, device, subBoard, subBoards = [], initial, options, nextSNoByBoard = {}, nextSortOrder }) {
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
        sub_board: initial.sub_board ?? subBoard ?? '',
        // load the raw serial so non-numeric S.No values ('32b') round-trip losslessly
        s_no: initial.s_no_raw ?? (initial.s_no != null ? String(initial.s_no) : ''),
        component: initial.component ?? '',
        value: initial.value ?? '',
        voltage: initial.voltage ?? '',
        rating: initial.rating ?? '',
        material: initial.material ?? '',
        tolerance: initial.tolerance ?? '',
        label: initial.label ?? '',
        package: initial.package ?? '',
        part_number: initial.part_number ?? '',
        opening_quantity: initial.opening_quantity ?? '',
        quantity_note: initial.quantity_note ?? '',
      })
    } else {
      const board = subBoard ?? ''
      setForm({ ...EMPTY, s_no: nextSNoByBoard[board] ?? '', sub_board: board })
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
    const opts = new Set(subBoards)
    if (subBoard) opts.add(subBoard)
    if (form.sub_board) opts.add(form.sub_board)
    return [...opts]
  }, [subBoards, subBoard, form.sub_board])

  // Picking a different sub-board while adding refreshes the suggested S.No
  // to that board's next number.
  function onPickSubBoard(e) {
    const b = e.target.value
    setForm((f) => (isEdit ? { ...f, sub_board: b } : { ...f, sub_board: b, s_no: nextSNoByBoard[b] ?? '' }))
  }

  async function handleSave() {
    const compTrim = form.component.trim()
    if (!compTrim) {
      setError('Component type is required.')
      return
    }
    const openingQty = form.opening_quantity === '' ? 0 : Number(form.opening_quantity)
    if (openingBad || !Number.isFinite(openingQty) || openingQty < 0) {
      setError('Opening stock is not a valid number — please re-enter it.')
      return
    }
    setSaving(true)
    setError(null)
    // snap to the canonical option so 'capacitor'/'Capacitor ' don't create duplicates
    const component = componentOptions.find((o) => o.toLowerCase() === compTrim.toLowerCase()) || compTrim
    const parametric = valueFields.length > 1
    const rawSNo = String(form.s_no ?? '').trim()
    const targetBoard = form.sub_board || subBoard
    // moving to another board re-appends the row there; plain edits keep their order
    const boardChanged = isEdit && targetBoard !== initial.sub_board
    const payload = {
      ...(!isEdit || boardChanged ? { sort_order: nextSortOrder ?? 0 } : {}),
      sub_board: targetBoard,
      s_no: /^\d+$/.test(rawSNo) ? parseInt(rawSNo, 10) : null,
      s_no_raw: rawSNo || null,
      component,
      value: (form.value || '').trim() || null,
      voltage: parametric ? (form.voltage || '').trim() || null : null,
      rating: parametric ? (form.rating || '').trim() || null : null,
      material: parametric ? (form.material || '').trim() || null : null,
      tolerance: parametric ? (form.tolerance || '').trim() || null : null,
      value_raw: buildValueRaw(form) || null,
      label: (form.label || '').trim() || null,
      package: (form.package || '').trim() || null,
      part_number: (form.part_number || '').trim() || null,
      opening_quantity: openingQty,
      quantity_note: (form.quantity_note || '').trim() || null,
    }
    try {
      if (isEdit) await updateComponent(device, initial.id, payload)
      else await insertComponent(device, payload)
      await onSaved?.()
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
      subtitle={`${device} Water-Meter Board`}
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
          <Field label="Sub-board" required className="col-span-2 sm:col-span-3">
            <select
              value={form.sub_board}
              onChange={onPickSubBoard}
              className="w-full rounded-lg border border-line bg-surface2 px-3 py-2 text-base text-ink outline-none focus:border-primary sm:text-sm focus:ring-2 focus:ring-primary/25"
            >
              {subBoardOptions.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </Field>
          <Field label="S.No" className="col-span-2 sm:col-span-2">
            <TextInput value={form.s_no} onChange={set('s_no')} placeholder="#" />
          </Field>
          <Field label="Component" required className="col-span-2 sm:col-span-4">
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
          <Field label="Label (designators)" className="col-span-2">
            <TextInput value={form.label} onChange={set('label')} placeholder="e.g. C4,C5,C25,C26" />
          </Field>
          <Field label="Part Number" className="col-span-2 sm:col-span-1">
            <TextInput value={form.part_number} onChange={set('part_number')} placeholder="e.g. C60474" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-xl bg-surface2 p-4 ring-1 ring-line">
          <Field
            label={isEdit ? 'Opening stock' : 'Opening stock (starting quantity)'}
            hint={isEdit ? 'Base amount before inward/outward activity.' : undefined}
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
