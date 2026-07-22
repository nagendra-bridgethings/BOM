import { useCallback, useEffect, useState } from 'react'

// A cart of components queued for one bulk outward. It spans all three devices,
// so each line carries its own `device` and a display snapshot (component, value,
// board, serial) — the cart has to render rows belonging to a device whose data
// isn't currently loaded. Live stock is re-read when the cart is opened, never
// taken from the snapshot.
//
// Persisted to localStorage: building a picking list takes real time, and losing
// it to an accidental refresh would be worse than the feature is worth. It is
// per-browser, not shared between people — there are no accounts to share it by.

const KEY = 'bom.cart.v1'

// device + component id is the identity — the same physical part on two devices
// is two separate rows in two separate tables.
const lineKey = (device, id) => `${device}::${id}`

function readStored() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    // guard against a hand-edited or half-written value
    return Array.isArray(parsed) ? parsed.filter((l) => l && l.device && l.id) : []
  } catch {
    return []
  }
}

export function useCart() {
  const [lines, setLines] = useState(readStored)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines))
    } catch {
      // a full or blocked storage quota must not break the cart itself
    }
  }, [lines])

  // Follow the same cart in other tabs. Without this a tab holds whatever it read
  // at mount, so recording a pick in one tab leaves the other still showing it —
  // and recording there again issues the same stock twice. `storage` fires only
  // in the tabs that did NOT write, which is exactly the set that is now stale.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== KEY && e.key !== null) return // null = storage cleared wholesale
      setLines(readStored())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Adds only what isn't already queued, so re-selecting a row can't duplicate
  // it or wipe a quantity that was already typed against it.
  const addMany = useCallback((device, components) => {
    setLines((prev) => {
      const seen = new Set(prev.map((l) => lineKey(l.device, l.id)))
      const additions = components
        .filter((c) => !seen.has(lineKey(device, c.id)))
        .map((c) => ({
          device,
          id: c.id,
          sub_board: c.sub_board,
          s_no: c.s_no ?? null,
          s_no_raw: c.s_no_raw ?? null,
          component: c.component ?? '',
          value_raw: c.value_raw ?? c.value ?? '',
          package: c.package ?? '',
          // shown while picking — a reel can't be cut, which is exactly when
          // `sending` has to differ from `needed`
          supply_form: c.supply_form ?? '',
          needed: '',
          sending: '',
        }))
      return additions.length ? [...prev, ...additions] : prev
    })
  }, [])

  const removeLine = useCallback((device, id) => {
    setLines((prev) => prev.filter((l) => lineKey(l.device, l.id) !== lineKey(device, id)))
  }, [])

  // Drops whole devices at once — used after a partial submit, where some
  // devices committed and the rest must stay queued for a retry.
  const removeDevices = useCallback((devices) => {
    const drop = new Set(devices)
    setLines((prev) => prev.filter((l) => !drop.has(l.device)))
  }, [])

  const setQty = useCallback((device, id, field, value) => {
    setLines((prev) =>
      prev.map((l) =>
        lineKey(l.device, l.id) === lineKey(device, id) ? { ...l, [field]: value } : l,
      ),
    )
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const has = useCallback(
    (device, id) => lines.some((l) => lineKey(l.device, l.id) === lineKey(device, id)),
    [lines],
  )

  return { lines, addMany, removeLine, removeDevices, setQty, clear, has, count: lines.length }
}
