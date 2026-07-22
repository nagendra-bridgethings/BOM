import { useEffect, useRef, useState } from 'react'
import { fetchDeviceStock } from '../lib/db'
import { DEVICES } from '../lib/constants'

// Every device's components and live stock, for searching across 4G / RS485 /
// LORA at once. The main view only ever loads the selected device, so a search
// spanning all three needs its own read.
//
// Also backs the shared-part index — knowing a component sits on more than one
// board means knowing what every board holds, so this now loads on mount rather
// than only when a search begins.
//
// `version` forces a re-read: bump it after anything that adds, removes or moves
// stock, so the figures here don't drift from the device on screen.
export function useAllDevices(enabled, version = 0) {
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
  }, [enabled, version])

  return { data, loading, error }
}
