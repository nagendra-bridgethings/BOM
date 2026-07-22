// Grouping a board's rows that describe the same part.
//
// Identity is component + value, matched case- and spacing-insensitively. Package
// is not part of it: every 100nF capacitor on a board belongs to one entry
// regardless of footprint, with the footprints listed underneath. The footprint
// still shows on each nested row, since a C0603 will not fit a C0402 pad. Part
// numbers are left out too — blank on many rows, and different suppliers give the
// same part different codes.
//
// Grouping never crosses a device or a board. Each tab shows its own device only,
// so a nested row is always a row that was taken out of the list directly above
// it — never a reference to somewhere the user cannot see.

const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

export function sharedKey(c) {
  const component = norm(c.component)
  // `value` is the parsed figure; fall back to the raw spec cell for rows that
  // were never split into sub-fields
  const value = norm(c.value || c.value_raw)
  // Without both a type and a value there is nothing meaningful to match on —
  // this is what keeps Sample Board, Bare PCBs and the like from all colliding.
  if (!component || !value) return null
  return `${component}|${value}`
}

// Where a part exists across ALL devices, keyed on the part alone. Separate from
// the board index above: that one groups rows within a list, this one answers
// "where else do we hold this?" and deliberately reaches past the current tab.
export function buildCrossIndex(allDevices) {
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
  return map
}

// The devices other than this one that also carry the part, or null if none do.
export function crossDeviceInfo(index, c, device) {
  const k = sharedKey(c)
  if (!k) return null
  const all = index.get(k)
  if (!all || all.length < 2) return null
  const elsewhere = all.filter((l) => l.device !== device)
  if (elsewhere.length === 0) return null
  return {
    all,
    elsewhere,
    devices: [...new Set(elsewhere.map((l) => l.device))],
  }
}
