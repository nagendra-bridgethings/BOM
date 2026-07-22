import { useEffect, useRef, useState } from 'react'
import { fetchDeviceStock } from '../lib/db'
import { DEVICES } from '../lib/constants'

// Every device's components and live stock, for searching across 4G / RS485 /
// LORA at once. The main view only ever loads the selected device, so a search
// spanning all three needs its own read.
//
// Loaded lazily and only while `enabled` — the whole set is ~191 components, but
// there is no reason to pay for it on a session where nobody searches. The fetch
// runs when `enabled` flips on, so each new search session starts from fresh
// stock rather than a snapshot that could be an hour old.
export function useAllDevices(enabled) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const reqId = useRef(0)

  useEffect(() => {
    if (!enabled) return
    const myReq = ++reqId.current
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const entries = await Promise.all(
          DEVICES.map(async (d) => [d.key, await fetchDeviceStock(d.key)]),
        )
        if (myReq !== reqId.current) return // a newer search session superseded this
        setData(Object.fromEntries(entries))
      } catch (e) {
        if (myReq !== reqId.current) return
        setError(e.message || String(e))
      } finally {
        if (myReq === reqId.current) setLoading(false)
      }
    })()
  }, [enabled])

  return { data, loading, error }
}
