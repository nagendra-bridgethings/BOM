import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchComponents, fetchTransactions } from '../lib/db'

// Loads all components + their transactions for a device (across its sub-boards)
// and groups txns by component id. Returns a `reload` fn to call after any
// mutation. Sub-board selection is done client-side in the view.
//
// `loadedDevice` is the device the current `components`/`txnsByComponent` actually
// belong to — the view uses it to avoid showing (or writing to) one device while
// another device's data is still what's in state. A request-sequence ref discards
// any out-of-order (stale) response so only the latest reload commits.
export function useInventory(device) {
  const [components, setComponents] = useState([])
  const [txnsByComponent, setTxnsByComponent] = useState({})
  const [loadedDevice, setLoadedDevice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const reqId = useRef(0)

  const reload = useCallback(async () => {
    if (!device) {
      setComponents([])
      setTxnsByComponent({})
      setLoadedDevice(null)
      return
    }
    const myReq = ++reqId.current // claim the latest slot
    setLoading(true)
    setError(null)
    try {
      const comps = await fetchComponents(device)
      const txns = await fetchTransactions(device, comps.map((c) => c.id))
      if (myReq !== reqId.current) return // superseded by a newer reload -> discard
      const grouped = {}
      for (const t of txns) {
        ;(grouped[t.component_id] ||= []).push(t)
      }
      setComponents(comps)
      setTxnsByComponent(grouped)
      setLoadedDevice(device)
    } catch (e) {
      if (myReq !== reqId.current) return
      setError(e.message || String(e))
    } finally {
      if (myReq === reqId.current) setLoading(false)
    }
  }, [device])

  useEffect(() => {
    reload()
  }, [reload])

  return { components, txnsByComponent, loadedDevice, loading, error, reload }
}
