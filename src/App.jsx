import { useEffect, useMemo, useState } from 'react'
import { supabaseConfigured } from './lib/supabase'
import { deleteComponent } from './lib/db'
import { useInventory } from './hooks/useInventory'
import { useCart } from './hooks/useCart'
import { DEVICES, deviceMeta, orderSubBoards, LOW_STOCK_THRESHOLD } from './lib/constants'
import { liveQty, distinctValues, formatNumber } from './lib/format'

import ErrorBoundary from './components/ErrorBoundary'
import SetupScreen from './components/SetupScreen'
import Toolbar from './components/Toolbar'
import ComponentTable from './components/ComponentTable'
import ComponentFormModal from './components/ComponentFormModal'
import TransactionModal from './components/TransactionModal'
import HistoryModal from './components/HistoryModal'
import CartModal from './components/CartModal'
import BatchHistoryModal from './components/BatchHistoryModal'
import { Button } from './components/ui/controls'
import { IconCart, IconHistory } from './components/ui/icons'

export default function App() {
  return supabaseConfigured ? <Dashboard /> : <SetupScreen />
}

function Dashboard() {
  const [device, setDevice] = useState('4G')
  const [subBoard, setSubBoard] = useState(null)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [lowOnly, setLowOnly] = useState(false)

  // modals
  const [formOpen, setFormOpen] = useState(false)
  const [formInitial, setFormInitial] = useState(null)
  const [txnState, setTxnState] = useState(null) // { mode, component }
  const [historyComp, setHistoryComp] = useState(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [batchesOpen, setBatchesOpen] = useState(false)

  // bulk outward: tick rows on any device, queue them, issue them in one go
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const cart = useCart()

  const { components, txnsByComponent, loadedDevice, loading, error, reload } = useInventory(device)

  // true once the data in state actually belongs to the selected device
  const onCurrentDevice = loadedDevice === device

  const rows = useMemo(
    () =>
      components.map((c) => {
        const txns = txnsByComponent[c.id] || []
        return { ...c, _qty: liveQty(c, txns), _txnCount: txns.length }
      }),
    [components, txnsByComponent],
  )

  // sub-boards present for this device (Main Board first)
  const subBoards = useMemo(
    () => orderSubBoards(distinctValues(components, 'sub_board')),
    [components],
  )

  // keep a valid sub-board selected as the device (and its data) changes
  useEffect(() => {
    if (subBoards.length === 0) {
      setSubBoard(null)
      return
    }
    setSubBoard((prev) => (subBoards.includes(prev) ? prev : subBoards[0]))
  }, [subBoards])

  // reset filters when switching context
  useEffect(() => {
    setSearch('')
    setTypeFilter('')
    setLowOnly(false)
  }, [device, subBoard])

  // Selection is per view — ids belong to one device's table, so carrying them
  // across a device or board switch would tick unrelated rows. The cart is what
  // persists; this is just the pending tick list.
  useEffect(() => {
    setSelectedIds(new Set())
  }, [device, subBoard])

  // rows for the selected sub-board
  const boardRows = useMemo(
    () => (subBoard ? rows.filter((r) => r.sub_board === subBoard) : rows),
    [rows, subBoard],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return boardRows.filter((c) => {
      if (typeFilter && c.component !== typeFilter) return false
      if (lowOnly && !(c._qty > 0 && c._qty < LOW_STOCK_THRESHOLD)) return false
      if (!q) return true
      return [c.component, c.value_raw, c.value, c.label, c.part_number, c.package].some(
        (v) => v && String(v).toLowerCase().includes(q),
      )
    })
  }, [boardRows, search, typeFilter, lowOnly])

  // dropdown suggestions drawn from the whole device
  const options = useMemo(
    () => ({
      component: distinctValues(components, 'component'),
      value: distinctValues(components, 'value'),
      voltage: distinctValues(components, 'voltage'),
      rating: distinctValues(components, 'rating'),
      material: distinctValues(components, 'material'),
      tolerance: distinctValues(components, 'tolerance'),
      package: distinctValues(components, 'package'),
    }),
    [components],
  )
  const typesPresent = options.component

  const meta = deviceMeta(device)

  // transaction modal context
  const activeComp = txnState?.component
  const activeTxns = activeComp ? txnsByComponent[activeComp.id] || [] : []
  const activeQty = activeComp ? liveQty(activeComp, activeTxns) : 0
  const openOutwards = useMemo(() => {
    if (!activeComp) return []
    const txns = txnsByComponent[activeComp.id] || []
    return txns
      .filter((t) => t.type === 'outward')
      .map((o) => {
        const returned = txns
          .filter((t) => t.type === 'return' && t.related_txn_id === o.id)
          .reduce((s, t) => s + (Number(t.qty) || 0), 0)
        return { ...o, remaining: (Number(o.qty_sent) || 0) - returned }
      })
      .filter((o) => o.remaining > 0) // fully-returned outwards can't take more returns
  }, [activeComp, txnsByComponent])

  // A component can be added to any device, so jump the view to wherever it
  // landed — otherwise the user saves and sees nothing change.
  async function handleSaved(savedDevice, savedSubBoard) {
    if (savedDevice && savedDevice !== device) {
      if (savedSubBoard) setSubBoard(savedSubBoard)
      setDevice(savedDevice) // useInventory reloads on device change
      return
    }
    if (savedSubBoard && savedSubBoard !== subBoard) setSubBoard(savedSubBoard)
    await reload()
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // "All" acts only on what's currently shown — ticking a header box must never
  // queue rows the user can't see, and un-ticking it must not silently drop
  // selections made under a different search or filter.
  function toggleAll(on) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const r of filtered) {
        if (on) next.add(r.id)
        else next.delete(r.id)
      }
      return next
    })
  }

  // Resolved against every row of the device, not the filtered view — a search
  // typed after ticking would otherwise drop the hidden picks without a word.
  function addSelectedToCart() {
    const picked = rows.filter((r) => selectedIds.has(r.id))
    if (picked.length === 0) return
    cart.addMany(device, picked)
    setSelectedIds(new Set())
  }

  // Devices whose batch committed leave the cart; anything that failed stays
  // queued so a retry can't issue the same stock twice.
  async function handleCartDone(doneDevices) {
    if (doneDevices.length > 0) {
      cart.removeDevices(doneDevices)
      if (doneDevices.includes(device)) await reload()
    }
  }

  async function handleDelete(c) {
    if (!window.confirm(`Delete "${c.component} — ${c.value_raw || c.label || ''}" and all its transactions?`)) return
    try {
      await deleteComponent(device, c.id)
      await reload()
    } catch (e) {
      window.alert(e.message || String(e))
    }
  }

  const historyTxns = historyComp ? txnsByComponent[historyComp.id] || [] : []
  const historyQty = historyComp ? liveQty(historyComp, historyTxns) : 0

  const hasData = components.length > 0

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              {/* BASE_URL keeps the logo resolving under a subpath deploy (e.g. /BOM/) */}
              <img src={`${import.meta.env.BASE_URL}BridgeThings.png`} alt="BridgeThings" className="h-7 w-auto shrink-0 sm:h-8" />
              <span className="h-8 w-px shrink-0 bg-line" />
              <div className="min-w-0">
                <h1 className="text-lg font-semibold leading-tight text-ink">BOM</h1>
                <p className="truncate text-xs text-mute">Water Meter Board Inventory</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setBatchesOpen(true)}
                title="Bulk outward history"
                className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line bg-surface2 px-3 py-2 text-sm font-medium text-mute transition hover:bg-raise hover:text-ink"
              >
                <IconHistory width={15} height={15} />
                <span className="hidden md:inline">Batches</span>
              </button>
              <button
                onClick={() => setCartOpen(true)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  cart.count > 0
                    ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15'
                    : 'border-line bg-surface2 text-mute hover:bg-raise hover:text-ink'
                }`}
              >
                <IconCart width={15} height={15} />
                <span className="hidden sm:inline">Cart</span>
                {cart.count > 0 && (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-white">
                    {cart.count}
                  </span>
                )}
              </button>
              <div className="hidden items-center gap-2 text-xs font-medium text-mute lg:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-faint" />
                <span>Supabase connected</span>
              </div>
            </div>
          </div>

          {/* Device tabs — underline indicator */}
          {/* negative margin keeps the first tab flush with the header gutter
              while the padding turns the gaps into real tap area */}
          <div className="-mx-3 flex gap-1">
            {DEVICES.map((d) => {
              const active = d.key === device
              return (
                <button
                  key={d.key}
                  onClick={() => setDevice(d.key)}
                  className={`relative px-3 pb-3 pt-1 text-sm font-semibold transition ${
                    active ? 'text-ink' : 'text-faint hover:text-mute'
                  }`}
                >
                  {d.label}
                  {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        {/* Only the content area is inside this boundary, so a crash in one device's
            data leaves the header and device tabs clickable. Keying it on `device`
            makes switching device remount a fresh boundary — without that, the crashed
            state would persist and keep showing the fallback on a device that renders fine. */}
        <ErrorBoundary key={device} nested>
          {!onCurrentDevice && error ? (
            <ErrorCard title="Couldn’t load data" message={error} />
          ) : !onCurrentDevice ? (
            <div className="py-24 text-center text-sm text-faint">Loading {device}…</div>
          ) : !hasData ? (
            <ErrorCard
              title="No data yet"
              message="Your database is connected but this device has no components. Run supabase/schema.sql then supabase/seed.sql in the Supabase SQL Editor (or `node scripts/seed-api.mjs`), then refresh."
            />
          ) : (
            <>
              {/* Board heading + sub-board segmented control */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-base font-semibold text-ink">{meta.blurb}</h2>
                  <span className="text-sm tabular-nums text-faint">{formatNumber(boardRows.length)} components</span>
                </div>
                {subBoards.length > 1 && (
                  <div className="inline-flex divide-x divide-line overflow-hidden rounded-lg ring-1 ring-line">
                    {subBoards.map((b) => (
                      <button
                        key={b}
                        onClick={() => setSubBoard(b)}
                        className={`px-3.5 py-1.5 text-sm font-medium transition ${
                          b === subBoard ? 'bg-surface2 text-ink' : 'bg-surface text-mute hover:bg-surface2/60 hover:text-ink'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Toolbar */}
              <div className="mt-5">
                <Toolbar
                  search={search}
                  onSearch={setSearch}
                  typeFilter={typeFilter}
                  onTypeFilter={setTypeFilter}
                  types={typesPresent}
                  lowOnly={lowOnly}
                  onToggleLow={() => setLowOnly((v) => !v)}
                  onAdd={() => { setFormInitial(null); setFormOpen(true) }}
                  onRefresh={reload}
                  loading={loading}
                  selectMode={selectMode}
                  onToggleSelectMode={() => {
                    setSelectMode((v) => !v)
                    setSelectedIds(new Set())
                  }}
                />
              </div>

              {selectMode && (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-primary/8 px-4 py-3 ring-1 ring-primary/25">
                  <span className="text-sm font-medium text-ink">
                    {selectedIds.size === 0 ? 'Tick the items you want to issue' : `${selectedIds.size} selected`}
                  </span>
                  <span className="text-xs text-mute">Queued items stay in the cart while you switch device.</span>
                  <div className="ml-auto flex items-center gap-2">
                    {selectedIds.size > 0 && (
                      <Button variant="soft" onClick={() => setSelectedIds(new Set())}>Clear</Button>
                    )}
                    <Button variant="primary" onClick={addSelectedToCart} disabled={selectedIds.size === 0}>
                      Add to cart
                    </Button>
                  </div>
                </div>
              )}

              {/* Result count */}
              <div className="mt-4 mb-2 flex items-center justify-between text-xs text-faint">
                <span>
                  Showing <span className="font-semibold text-mute">{filtered.length}</span> of {boardRows.length}
                  {subBoard ? ` · ${subBoard}` : ''}
                </span>
                {error && <span className="text-coral">{error}</span>}
              </div>

              <ComponentTable
                rows={filtered}
                onInward={(c) => setTxnState({ mode: 'inward', component: c })}
                onOutward={(c) => setTxnState({ mode: 'outward', component: c })}
                onReturn={(c) => setTxnState({ mode: 'return', component: c })}
                onHistory={(c) => setHistoryComp(c)}
                onEdit={(c) => { setFormInitial(c); setFormOpen(true) }}
                onDelete={handleDelete}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleAll={toggleAll}
              />
            </>
          )}
        </ErrorBoundary>
      </main>

      {/* Modals */}
      <ComponentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        device={device}
        subBoard={subBoard}
        initial={formInitial}
        options={options}
      />

      <TransactionModal
        open={Boolean(txnState)}
        onClose={() => setTxnState(null)}
        onSaved={reload}
        device={device}
        mode={txnState?.mode}
        component={activeComp}
        currentQty={activeQty}
        openOutwards={openOutwards}
      />

      <BatchHistoryModal open={batchesOpen} onClose={() => setBatchesOpen(false)} />

      <CartModal
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        lines={cart.lines}
        onSetQty={cart.setQty}
        onRemove={cart.removeLine}
        onDone={handleCartDone}
      />

      <HistoryModal
        open={Boolean(historyComp)}
        onClose={() => setHistoryComp(null)}
        onChanged={reload}
        device={device}
        component={historyComp}
        txns={historyTxns}
        currentQty={historyQty}
      />
    </div>
  )
}

function ErrorCard({ title, message }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-line bg-surface p-8 text-center">
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="mt-2 text-sm text-mute">{message}</p>
    </div>
  )
}
