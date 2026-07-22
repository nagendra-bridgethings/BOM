import { Fragment, useState } from 'react'
import QtyBadge from './QtyBadge'
import Menu from './ui/Menu'
import { valueChips } from '../lib/format'
import { LOW_STOCK_THRESHOLD } from '../lib/constants'
import { IconInward, IconOutward, IconReturn, IconHistory, IconEdit, IconTrash, IconLayers, IconChevronDown } from './ui/icons'

// Labelled stock-movement button. Direction colour lives on the icon
// (teal = inward, coral = outward, neutral = return) so it reads at a glance.
function MoveBtn({ label, tone, onClick, className = '', children }) {
  const t = {
    teal: { icon: 'text-teal', hover: 'hover:border-teal/40 hover:bg-teal/8' },
    coral: { icon: 'text-coral', hover: 'hover:border-coral/40 hover:bg-coral/8' },
    neutral: { icon: 'text-faint', hover: 'hover:border-line hover:bg-surface2' },
  }[tone]
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-2 py-2 text-xs font-medium text-mute transition hover:text-ink 2xl:px-2.5 2xl:py-1.5 ${t.hover} ${className}`}
    >
      <span className={t.icon}>{children}</span>
      {label}
    </button>
  )
}

const th = 'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-faint'
const td = 'px-3 py-2.5 align-middle'

// left severity stripe: red = depleted (had activity, now ≤0), amber = low stock
function stripeFor(c) {
  if (c._qty <= 0 && c._txnCount > 0) return 'border-l-2 border-l-coral'
  if (c._qty > 0 && c._qty < LOW_STOCK_THRESHOLD) return 'border-l-2 border-l-sun'
  return 'border-l-2 border-l-transparent'
}

function rowMenu(c, { onHistory, onEdit, onDelete }) {
  return [
    { label: 'History', icon: <IconHistory width={15} height={15} />, onClick: () => onHistory(c) },
    { label: 'Edit', icon: <IconEdit width={15} height={15} />, onClick: () => onEdit(c) },
    { divider: true },
    { label: 'Delete', icon: <IconTrash width={15} height={15} />, danger: true, onClick: () => onDelete(c) },
  ]
}

// module-level so the default prop keeps a stable identity between renders
const EMPTY_SELECTION = new Set()

// Marks a part that exists on other boards too, and opens the list of them.
function SharedChip({ info, expanded, onClick }) {
  if (!info) return null
  // a split listing on one board is a data problem, not just a cross-reference
  const dupe = info.duplicates.length > 0
  return (
    <button
      onClick={onClick}
      aria-expanded={expanded}
      title={dupe ? 'Stock for this part is split across more than one row' : 'Show the other boards that use this part'}
      className={`mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 transition ${
        dupe
          ? 'bg-sun/12 text-sun ring-sun/30 hover:bg-sun/20'
          : 'bg-primary/8 text-primary ring-primary/25 hover:bg-primary/15'
      }`}
    >
      <IconLayers width={11} height={11} />
      {info.label}
      <IconChevronDown width={11} height={11} className={expanded ? 'rotate-180' : ''} />
    </button>
  )
}

// In select mode the checkbox takes the place of the action buttons rather than
// sitting beside them — the row is already tight on a phone, and a fourth control
// would push the ⋯ menu out of reach.
function SelectBox({ checked, onChange, label }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="size-5 shrink-0 cursor-pointer accent-primary"
    />
  )
}

export default function ComponentTable({
  rows, onInward, onOutward, onReturn, onHistory, onEdit, onDelete,
  selectMode = false, selectedIds = EMPTY_SELECTION, onToggleSelect, onToggleAll,
  sharedFor,
}) {
  // which rows have their other-board instances open, by component id
  const [expanded, setExpanded] = useState(() => new Set())
  const toggleExpanded = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-surface py-16 text-center">
        <p className="text-sm font-medium text-mute">No components match</p>
        <p className="mt-1 text-sm text-faint">Try clearing the search, or add a new component.</p>
      </div>
    )
  }

  const handlers = { onHistory, onEdit, onDelete }
  const allSelected = selectMode && rows.length > 0 && rows.every((r) => selectedIds.has(r.id))

  return (
    <>
      {/* ---- Phones: card list (a 9-column grid is unusable under ~768px) ---- */}
      <ul className="space-y-2 2xl:hidden">
        {rows.map((c) => {
          const chips = valueChips(c)
          return (
            <li
              key={c.id}
              className={`rounded-lg p-3 ring-1 ${stripeFor(c)} ${
                selectMode && selectedIds.has(c.id) ? 'bg-primary/5 ring-primary/30' : 'bg-surface ring-line'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs tabular-nums text-faint">{c.s_no ?? c.s_no_raw ?? '—'}</span>
                    <span className="font-semibold text-ink">{c.component || '—'}</span>
                  </div>
                  <div className="mt-0.5 text-sm font-medium text-ink/90">{c.value || c.value_raw || '—'}</div>
                  <SharedChip
                    info={sharedFor?.(c)}
                    expanded={expanded.has(c.id)}
                    onClick={() => toggleExpanded(c.id)}
                  />
                  {chips.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {chips.map((ch, i) => (
                        <span key={i} className="rounded bg-surface2 px-1.5 py-0.5 text-[11px] text-mute ring-1 ring-line2">{ch}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  <QtyBadge qty={c._qty} note={c.quantity_note} hasActivity={c._txnCount > 0} />
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span className="text-faint">
                  Package <span className="ml-1 font-mono text-ink/80">{c.package || '—'}</span>
                </span>
                <span className="text-faint">
                  Part <span className="ml-1 font-mono text-mute">{c.part_number || '—'}</span>
                </span>
                {c.supply_form && (
                  <span className="rounded bg-surface2 px-1.5 py-0.5 text-[11px] text-mute ring-1 ring-line2">
                    {c.supply_form}
                  </span>
                )}
              </div>
              {c.identification_number && (
                <p className="mt-1 break-words font-mono text-xs text-mute">{c.identification_number}</p>
              )}
              {c.label && <p className="mt-1 break-words text-xs text-mute">{c.label}</p>}

              {selectMode ? (
                <label className="mt-3 flex cursor-pointer items-center gap-2.5 border-t border-line2 pt-2.5 text-sm text-mute">
                  <SelectBox
                    checked={selectedIds.has(c.id)}
                    onChange={() => onToggleSelect(c.id)}
                    label={`Select ${c.component || 'component'}`}
                  />
                  {selectedIds.has(c.id) ? 'Selected' : 'Select'}
                </label>
              ) : (
                <div className="mt-3 flex items-center gap-1.5 border-t border-line2 pt-2.5">
                  <MoveBtn label="Inward" tone="teal" className="flex-1" onClick={() => onInward(c)}><IconInward width={14} height={14} /></MoveBtn>
                  <MoveBtn label="Outward" tone="coral" className="flex-1" onClick={() => onOutward(c)}><IconOutward width={14} height={14} /></MoveBtn>
                  <MoveBtn label="Return" tone="neutral" className="flex-1" onClick={() => onReturn(c)}><IconReturn width={14} height={14} /></MoveBtn>
                  <Menu items={rowMenu(c, handlers)} />
                </div>
              )}

              {expanded.has(c.id) && (
                <ul className="mt-2 space-y-2 border-t border-line2 pt-2.5">
                  {sharedFor?.(c)?.others.map((o) => (
                    <li key={`${o.device}::${o.row.id}`} className="rounded-lg border-l-2 border-l-primary/40 bg-surface2/60 p-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            {!o.sameBoard && (
                              <>
                                <span className="text-sm font-medium text-ink">{o.device}</span>
                                <span className="text-xs text-mute">{o.board}</span>
                              </>
                            )}
                            <span className="text-xs tabular-nums text-faint">
                              #{o.row.s_no ?? o.row.s_no_raw ?? '—'}
                            </span>
                            <span className="text-sm text-ink/85">
                              {o.row.value || o.row.value_raw || '—'}
                            </span>
                          </div>
                          {o.row.label && <p className="mt-0.5 break-words text-xs text-faint">{o.row.label}</p>}
                        </div>
                        <div className="shrink-0">
                          {o.qty == null ? (
                            <span className="text-xs text-faint">…</span>
                          ) : (
                            <QtyBadge qty={o.qty} note={o.row.quantity_note} hasActivity={o.txnCount > 0} />
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <MoveBtn label="Inward" tone="teal" className="flex-1" onClick={() => onInward(o.row, o.device)}><IconInward width={14} height={14} /></MoveBtn>
                        <MoveBtn label="Outward" tone="coral" className="flex-1" onClick={() => onOutward(o.row, o.device)}><IconOutward width={14} height={14} /></MoveBtn>
                        <MoveBtn label="Return" tone="neutral" className="flex-1" onClick={() => onReturn(o.row, o.device)}><IconReturn width={14} height={14} /></MoveBtn>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>

      {/* ---- Tablet / desktop: full data grid ---- */}
      <div className="hidden max-h-[75vh] overflow-auto rounded-lg bg-surface ring-1 ring-line 2xl:block">
        <table className="w-full min-w-[1120px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 border-b border-line bg-surface2/95 backdrop-blur">
            <tr>
              <th className={`${th} w-14 border-l-2 border-l-transparent`}>#</th>
              <th className={th}>Component</th>
              <th className={th}>Value</th>
              <th className={th}>Label</th>
              <th className={th}>Package</th>
              <th className={th}>Part No.</th>
              <th className={th}>ID No.</th>
              <th className={th}>Supply</th>
              <th className={`${th} text-right`}>In Hand</th>
              <th className={`${th} pr-4 text-right`}>
                {selectMode ? (
                  <label className="inline-flex cursor-pointer items-center gap-2 normal-case">
                    <SelectBox
                      checked={allSelected}
                      onChange={() => onToggleAll(!allSelected)}
                      label="Select all shown"
                    />
                    All
                  </label>
                ) : (
                  'Actions'
                )}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line2">
            {rows.map((c) => {
              const chips = valueChips(c)
              const shared = sharedFor?.(c)
              const isOpen = expanded.has(c.id)
              return (
                <Fragment key={c.id}>
                <tr
                  className={`transition ${
                    selectMode && selectedIds.has(c.id) ? 'bg-primary/5' : 'hover:bg-surface2/70'
                  }`}
                >
                  <td className={`${td} ${stripeFor(c)} tabular-nums text-faint`}>{c.s_no ?? c.s_no_raw ?? '—'}</td>
                  <td className={td}>
                    <div className="font-semibold text-ink">{c.component || '—'}</div>
                    <SharedChip info={shared} expanded={isOpen} onClick={() => toggleExpanded(c.id)} />
                  </td>
                  <td className={`${td} max-w-[240px]`}>
                    <div className="font-medium text-ink/90">{c.value || c.value_raw || '—'}</div>
                    {chips.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {chips.map((ch, i) => (
                          <span key={i} className="rounded bg-surface2 px-1.5 py-0.5 text-[11px] text-mute ring-1 ring-line2">{ch}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className={`${td} max-w-[190px]`}>
                    <span className="break-words text-xs text-mute">{c.label || '—'}</span>
                  </td>
                  <td className={td}>
                    <span className="rounded bg-surface2 px-1.5 py-0.5 font-mono text-[11px] text-ink/80 ring-1 ring-line2">{c.package || '—'}</span>
                  </td>
                  <td className={td}>
                    <span className="font-mono text-xs text-mute">{c.part_number || '—'}</span>
                  </td>
                  <td className={`${td} max-w-[170px]`}>
                    <span className="block break-words font-mono text-xs text-mute">
                      {c.identification_number || '—'}
                    </span>
                  </td>
                  <td className={td}>
                    {c.supply_form ? (
                      <span className="whitespace-nowrap rounded bg-surface2 px-1.5 py-0.5 text-[11px] text-mute ring-1 ring-line2">
                        {c.supply_form}
                      </span>
                    ) : (
                      <span className="text-xs text-faint">—</span>
                    )}
                  </td>
                  <td className={`${td} text-right`}>
                    <QtyBadge qty={c._qty} note={c.quantity_note} hasActivity={c._txnCount > 0} />
                  </td>
                  <td className={`${td} pr-3`}>
                    <div className="flex items-center justify-end gap-1.5">
                      {selectMode ? (
                        <SelectBox
                          checked={selectedIds.has(c.id)}
                          onChange={() => onToggleSelect(c.id)}
                          label={`Select ${c.component || 'component'}`}
                        />
                      ) : (
                        <>
                          <MoveBtn label="Inward" tone="teal" onClick={() => onInward(c)}><IconInward width={14} height={14} /></MoveBtn>
                          <MoveBtn label="Outward" tone="coral" onClick={() => onOutward(c)}><IconOutward width={14} height={14} /></MoveBtn>
                          <MoveBtn label="Return" tone="neutral" onClick={() => onReturn(c)}><IconReturn width={14} height={14} /></MoveBtn>
                          <Menu items={rowMenu(c, handlers)} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>

                {/* The same part on other boards, opened under the row it belongs
                    to rather than in a dialog — it reads as part of this entry,
                    which is what it is. Each keeps its own stock and its own
                    actions, since they are separate rows in separate tables. */}
                {isOpen && shared?.others.map((o) => (
                  <tr key={`${o.device}::${o.row.id}`} className="bg-surface2/50">
                    <td className={`${td} border-l-2 border-l-primary/40`} />
                    <td className={td} colSpan={2}>
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-faint">↳</span>
                        {/* a twin on this same board only needs its serial — repeating
                            the device and board it shares with the row above is noise */}
                        {!o.sameBoard && (
                          <>
                            <span className="text-sm font-medium text-ink">{o.device}</span>
                            <span className="text-sm text-mute">{o.board}</span>
                          </>
                        )}
                        <span className="text-xs tabular-nums text-faint">
                          #{o.row.s_no ?? o.row.s_no_raw ?? '—'}
                        </span>
                        <span className="text-sm text-ink/85">
                          {o.row.value || o.row.value_raw || '—'}
                        </span>
                      </div>
                    </td>
                    <td className={`${td} max-w-[190px]`}>
                      <span className="break-words text-xs text-mute">{o.row.label || '—'}</span>
                    </td>
                    <td className={td}>
                      <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink/80 ring-1 ring-line2">
                        {o.row.package || '—'}
                      </span>
                    </td>
                    <td className={td}>
                      <span className="font-mono text-xs text-mute">{o.row.part_number || '—'}</span>
                    </td>
                    <td className={td}>
                      <span className="font-mono text-xs text-mute">{o.row.identification_number || '—'}</span>
                    </td>
                    <td className={td}>
                      {o.row.supply_form ? (
                        <span className="whitespace-nowrap rounded bg-surface px-1.5 py-0.5 text-[11px] text-mute ring-1 ring-line2">
                          {o.row.supply_form}
                        </span>
                      ) : (
                        <span className="text-xs text-faint">—</span>
                      )}
                    </td>
                    <td className={`${td} text-right`}>
                      {o.qty == null ? (
                        <span className="text-xs text-faint">…</span>
                      ) : (
                        <QtyBadge qty={o.qty} note={o.row.quantity_note} hasActivity={o.txnCount > 0} />
                      )}
                    </td>
                    <td className={`${td} pr-3`}>
                      <div className="flex items-center justify-end gap-1.5">
                        <MoveBtn label="Inward" tone="teal" onClick={() => onInward(o.row, o.device)}><IconInward width={14} height={14} /></MoveBtn>
                        <MoveBtn label="Outward" tone="coral" onClick={() => onOutward(o.row, o.device)}><IconOutward width={14} height={14} /></MoveBtn>
                        <MoveBtn label="Return" tone="neutral" onClick={() => onReturn(o.row, o.device)}><IconReturn width={14} height={14} /></MoveBtn>
                        <Menu items={[
                          { label: 'History', icon: <IconHistory width={15} height={15} />, onClick: () => onHistory(o.row, o.device) },
                        ]} />
                      </div>
                    </td>
                  </tr>
                ))}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
