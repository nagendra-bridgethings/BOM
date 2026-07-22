// Finding the same physical part across devices.
//
// Each device has its own table, so a part used on more than one board exists as
// several unrelated rows. These build the link between them.
//
// Identity is component + value + package, matched case- and spacing-insensitively.
// Package is part of the key on purpose: a 100nF in C0402 and a 100nF in C0805 are
// different parts that cannot substitute for each other. Part numbers are left out
// — they are blank on many rows and differ between suppliers for the same part.

const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

export function sharedKey(c) {
  const component = norm(c.component)
  // `value` is the parsed figure; fall back to the raw spec cell for rows that
  // were never split into sub-fields
  const value = norm(c.value || c.value_raw)
  // Without both a type and a value there is nothing meaningful to match on —
  // this is what keeps Sample Board, Bare PCBs and the like from all colliding.
  if (!component || !value) return null
  return `${component}|${value}|${norm(c.package)}`
}

// key -> [{ device, board, row }], keeping only keys that appear more than once.
export function buildSharedIndex(allDevices) {
  const map = new Map()
  if (!allDevices) return map
  for (const [device, bucket] of Object.entries(allDevices)) {
    for (const c of bucket?.components || []) {
      const k = sharedKey(c)
      if (!k) continue
      if (!map.has(k)) map.set(k, [])
      map.get(k).push({ device, board: c.sub_board, row: c })
    }
  }
  for (const [k, list] of map) if (list.length < 2) map.delete(k)
  return map
}

// What to say on a row: where else this part lives, and a label for the chip.
// `device` is the device the row itself belongs to, so it can be excluded.
export function sharedInfo(index, c, device) {
  const k = sharedKey(c)
  if (!k) return null
  const all = index.get(k)
  if (!all) return null
  const others = all.filter((l) => !(l.device === device && l.row.id === c.id))
  if (others.length === 0) return null

  const otherDevices = [...new Set(others.map((o) => o.device))].filter((d) => d !== device)
  // The same part listed twice on one board splits its stock in two, so one row
  // reads 0 while the other holds everything. That misleads far more than a part
  // being shared across devices does, so it leads the label.
  const duplicates = others.filter((o) => o.device === device && o.board === c.sub_board)

  const label = duplicates.length
    ? `Listed ${duplicates.length + 1}× on this board`
    : otherDevices.length
      ? `Also in ${otherDevices.join(', ')}`
      : `Also on ${[...new Set(others.map((o) => o.board))].join(', ')}`

  return { all, others, otherDevices, duplicates, label }
}
