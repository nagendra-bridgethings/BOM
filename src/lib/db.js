import { supabase } from './supabase'
import { DEVICE_TABLES, tablesFor } from './constants'

// Separate tables per device (4G / RS485 / LORA). Every call takes the active
// device so it hits the right pair of tables:
//   bom_<device>_components  +  bom_<device>_transactions

// ----- reads -------------------------------------------------------------
export async function fetchComponents(device) {
  const { components } = tablesFor(device)
  const { data, error } = await supabase
    .from(components)
    .select('*')
    .order('sort_order', { ascending: true })
    .order('s_no', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function fetchTransactions(device, componentIds) {
  if (!componentIds || componentIds.length === 0) return []
  const { transactions } = tablesFor(device)
  const { data, error } = await supabase
    .from(transactions)
    .select('*')
    .in('component_id', componentIds)
    .order('txn_date', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

// ----- writes ------------------------------------------------------------
const COMPONENT_FIELDS = [
  'sub_board', 's_no', 's_no_raw', 'component', 'value_raw', 'value',
  'voltage', 'rating', 'material', 'tolerance', 'label', 'package',
  'part_number', 'identification_number', 'supply_form',
  'opening_quantity', 'quantity_note',
  'sort_order',
]

function pickComponent(obj) {
  const out = {}
  for (const f of COMPONENT_FIELDS) if (f in obj) out[f] = obj[f]
  return out
}

// Next serial number for a sub-board and next device-wide sort_order.
// Read at save time so it's correct even for a device whose rows aren't loaded.
export async function nextRowMeta(device, subBoard) {
  const { components } = tablesFor(device)
  const { data, error } = await supabase.from(components).select('s_no, sort_order, sub_board')
  if (error) throw error
  const rows = data || []
  const maxSNo = rows
    .filter((r) => r.sub_board === subBoard)
    .reduce((m, r) => Math.max(m, Number(r.s_no) || 0), 0)
  const maxOrder = rows.reduce((m, r) => Math.max(m, Number(r.sort_order) || 0), 0)
  return { nextSNo: maxSNo + 1, nextSortOrder: maxOrder + 1 }
}

export async function insertComponent(device, payload) {
  const { components } = tablesFor(device)
  const { data, error } = await supabase
    .from(components)
    .insert(pickComponent(payload))
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateComponent(device, id, patch) {
  const { components } = tablesFor(device)
  const { data, error } = await supabase
    .from(components)
    .update(pickComponent(patch))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteComponent(device, id) {
  const { components } = tablesFor(device)
  const { error } = await supabase.from(components).delete().eq('id', id)
  if (error) throw error
}

export async function insertTransaction(device, payload) {
  const { transactions } = tablesFor(device)
  const row = {
    component_id: payload.component_id,
    type: payload.type,
    qty: payload.qty ?? null,
    qty_needed: payload.qty_needed ?? null,
    qty_sent: payload.qty_sent ?? null,
    related_txn_id: payload.related_txn_id ?? null,
    txn_date: payload.txn_date,
    reason: payload.reason ?? null,
  }
  const { data, error } = await supabase
    .from(transactions)
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return data
}

// One insert for every row of a device — PostgREST applies a multi-row insert in
// a single statement, so a device's batch lands whole or not at all. It cannot
// span devices (they are separate tables, and the client has no cross-table
// transaction), so a bulk outward commits per device and reports which succeeded.
export async function insertTransactions(device, rows) {
  if (!rows || rows.length === 0) return []
  const { transactions } = tablesFor(device)
  const { data, error } = await supabase.from(transactions).insert(rows).select()
  if (error) throw error
  return data
}

// Past bulk outwards, newest first. A batch is identified by batch_id, which
// only the cart writes — single-item outwards leave it null, so nothing here has
// to guess from matching dates or reason text. One batch can span devices, so
// every device is read and the rows are grouped by id afterwards.
export async function fetchBatches(limit = 300) {
  const perDevice = await Promise.all(
    Object.keys(DEVICE_TABLES).map(async (device) => {
      const { components, transactions } = tablesFor(device)
      const { data: txns, error } = await supabase
        .from(transactions)
        .select('*')
        .not('batch_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      if (!txns || txns.length === 0) return []

      const ids = [...new Set(txns.map((t) => t.component_id))]
      const { data: comps, error: cErr } = await supabase
        .from(components)
        .select('id, component, value_raw, value, sub_board, s_no, s_no_raw, package')
        .in('id', ids)
      if (cErr) throw cErr
      const byId = Object.fromEntries((comps || []).map((c) => [c.id, c]))
      return txns.map((t) => ({ ...t, device, component: byId[t.component_id] || null }))
    }),
  )

  const batches = new Map()
  for (const row of perDevice.flat()) {
    if (!batches.has(row.batch_id)) {
      batches.set(row.batch_id, {
        batch_id: row.batch_id,
        txn_date: row.txn_date,
        reason: row.reason,
        created_at: row.created_at,
        lines: [],
      })
    }
    const b = batches.get(row.batch_id)
    b.lines.push(row)
    // a batch is written device by device, so keep the earliest stamp as its time
    if (row.created_at < b.created_at) b.created_at = row.created_at
  }

  return [...batches.values()]
    .map((b) => ({
      ...b,
      devices: [...new Set(b.lines.map((l) => l.device))],
      totalUnits: b.lines.reduce((s, l) => s + (Number(l.qty_sent) || 0), 0),
    }))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
}

// Components + transactions for one device, for computing live stock outside the
// loaded device — the cart spans devices and has to check all of them.
export async function fetchDeviceStock(device) {
  const components = await fetchComponents(device)
  const txns = await fetchTransactions(device, components.map((c) => c.id))
  const byComponent = {}
  for (const t of txns) (byComponent[t.component_id] ||= []).push(t)
  return { components, byComponent }
}

export async function deleteTransaction(device, id) {
  const { transactions } = tablesFor(device)
  // Refuse to orphan returns booked against this txn — deleting the outward
  // would leave its returns still counting toward stock (overstating in-hand).
  // The DB FK (NO ACTION, see harden-return-fk.sql) backstops this atomically;
  // this check just gives a friendlier message than a raw FK violation.
  const { data: deps, error: depErr } = await supabase
    .from(transactions)
    .select('id')
    .eq('related_txn_id', id)
    .limit(1)
  if (depErr) throw depErr
  if (deps && deps.length) {
    throw new Error('This outward has return(s) linked to it. Delete those returns first, then delete the outward.')
  }
  const { error } = await supabase.from(transactions).delete().eq('id', id)
  if (error) throw error
}
