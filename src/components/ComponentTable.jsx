import QtyBadge from './QtyBadge'
import Menu from './ui/Menu'
import { valueChips } from '../lib/format'
import { LOW_STOCK_THRESHOLD } from '../lib/constants'
import { IconInward, IconOutward, IconReturn, IconHistory, IconEdit, IconTrash } from './ui/icons'

// Labelled stock-movement button. Direction colour lives on the icon
// (teal = inward, coral = outward, neutral = return) so it reads at a glance.
function MoveBtn({ label, tone, onClick, children }) {
  const t = {
    teal: { icon: 'text-teal', hover: 'hover:border-teal/40 hover:bg-teal/8' },
    coral: { icon: 'text-coral', hover: 'hover:border-coral/40 hover:bg-coral/8' },
    neutral: { icon: 'text-faint', hover: 'hover:border-line hover:bg-surface2' },
  }[tone]
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-mute transition hover:text-ink ${t.hover}`}
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

export default function ComponentTable({ rows, onInward, onOutward, onReturn, onHistory, onEdit, onDelete }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-surface py-16 text-center">
        <p className="text-sm font-medium text-mute">No components match</p>
        <p className="mt-1 text-sm text-faint">Try clearing the search, or add a new component.</p>
      </div>
    )
  }

  return (
    <div className="max-h-[75vh] overflow-auto rounded-lg bg-surface ring-1 ring-line">
      <table className="w-full min-w-[1080px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 border-b border-line bg-surface2/95 backdrop-blur">
          <tr>
            <th className={`${th} w-14 border-l-2 border-l-transparent`}>#</th>
            <th className={th}>Component</th>
            <th className={th}>Value</th>
            <th className={th}>Label</th>
            <th className={th}>Package</th>
            <th className={th}>Part No.</th>
            <th className={`${th} text-right`}>In Hand</th>
            <th className={`${th} pr-4 text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line2">
          {rows.map((c) => {
            const chips = valueChips(c)
            return (
              <tr key={c.id} className="transition hover:bg-surface2/70">
                <td className={`${td} ${stripeFor(c)} tabular-nums text-faint`}>{c.s_no ?? c.s_no_raw ?? '—'}</td>
                <td className={td}>
                  <div className="font-semibold text-ink">{c.component || '—'}</div>
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
                <td className={`${td} max-w-[180px]`}>
                  <span className="text-xs text-mute break-words">{c.label || '—'}</span>
                </td>
                <td className={td}>
                  <span className="rounded bg-surface2 px-1.5 py-0.5 font-mono text-[11px] text-ink/80 ring-1 ring-line2">{c.package || '—'}</span>
                </td>
                <td className={td}>
                  <span className="font-mono text-xs text-mute">{c.part_number || '—'}</span>
                </td>
                <td className={`${td} text-right`}>
                  <QtyBadge qty={c._qty} note={c.quantity_note} hasActivity={c._txnCount > 0} />
                </td>
                <td className={`${td} pr-3`}>
                  <div className="flex items-center justify-end gap-1.5">
                    <MoveBtn label="Inward" tone="teal" onClick={() => onInward(c)}><IconInward width={14} height={14} /></MoveBtn>
                    <MoveBtn label="Outward" tone="coral" onClick={() => onOutward(c)}><IconOutward width={14} height={14} /></MoveBtn>
                    <MoveBtn label="Return" tone="neutral" onClick={() => onReturn(c)}><IconReturn width={14} height={14} /></MoveBtn>
                    <Menu
                      items={[
                        { label: 'History', icon: <IconHistory width={15} height={15} />, onClick: () => onHistory(c) },
                        { label: 'Edit', icon: <IconEdit width={15} height={15} />, onClick: () => onEdit(c) },
                        { divider: true },
                        { label: 'Delete', icon: <IconTrash width={15} height={15} />, danger: true, onClick: () => onDelete(c) },
                      ]}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
