import { supabase } from './supabase'
import { tablesFor } from './constants'

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
  'part_number', 'opening_quantity', 'quantity_note',
  'sort_order',
]

function pickComponent(obj) {
  const out = {}
  for (const f of COMPONENT_FIELDS) if (f in obj) out[f] = obj[f]
  return out
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
