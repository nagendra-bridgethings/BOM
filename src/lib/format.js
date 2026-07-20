// Compute the live quantity in hand for a component given its transactions.
export function liveQty(component, txns = []) {
  let q = Number(component.opening_quantity) || 0
  for (const t of txns) {
    if (t.type === 'inward') q += Number(t.qty) || 0
    else if (t.type === 'outward') q -= Number(t.qty_sent) || 0
    else if (t.type === 'return') q += Number(t.qty) || 0
  }
  return q
}

// The signed delta a single transaction applies to stock.
export function txnDelta(t) {
  if (t.type === 'inward') return Number(t.qty) || 0
  if (t.type === 'return') return Number(t.qty) || 0
  if (t.type === 'outward') return -(Number(t.qty_sent) || 0)
  return 0
}

// Small parsed chips (voltage / rating / material / tolerance) for the value cell.
export function valueChips(c) {
  return [c.voltage, c.rating, c.material, c.tolerance].filter(Boolean)
}

// Distinct, sorted, non-empty values of a field across a list of components.
export function distinctValues(components, field) {
  const set = new Set()
  for (const c of components) {
    const v = c[field]
    if (v !== null && v !== undefined && String(v).trim() !== '') set.add(String(v))
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

export function formatDate(d) {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d + 'T00:00:00') : new Date(d)
  if (Number.isNaN(date.getTime())) return String(d)
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function todayISO() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60000)
  return local.toISOString().slice(0, 10)
}

export function formatNumber(n) {
  if (n === null || n === undefined || n === '') return '—'
  return Number(n).toLocaleString()
}
