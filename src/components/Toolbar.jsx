import { Button } from './ui/controls'
import { IconSearch, IconPlus, IconRefresh, IconFilter, IconChevronDown } from './ui/icons'

export default function Toolbar({
  search, onSearch, typeFilter, onTypeFilter, types,
  lowOnly, onToggleLow, onAdd, onRefresh, loading,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="relative w-full min-w-[180px] flex-1 sm:w-auto">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-faint">
          <IconSearch />
        </span>
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search component, value, label, part no…"
          className="w-full rounded-lg border border-line bg-surface2 py-2 pl-9 pr-3 text-base text-ink outline-none sm:text-sm transition placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/25"
        />
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-faint">
          <IconFilter width={15} height={15} />
        </span>
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilter(e.target.value)}
          className="appearance-none rounded-lg border border-line bg-surface2 py-2 pl-8 pr-8 text-base text-mute outline-none sm:text-sm focus:border-primary focus:ring-2 focus:ring-primary/25"
        >
          <option value="">All components</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-faint">
          <IconChevronDown width={14} height={14} />
        </span>
      </div>

      <button
        onClick={onToggleLow}
        className={`rounded-lg border px-3 py-2 text-sm font-medium  transition ${
          lowOnly
            ? 'border-sun/40 bg-sun/12 text-sun'
            : 'border-line bg-surface2 text-mute hover:bg-raise hover:text-ink'
        }`}
      >
        Low stock
      </button>

      <button
        onClick={onRefresh}
        title="Refresh"
        className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-line bg-surface2 p-2 text-faint transition hover:bg-raise hover:text-ink xl:min-h-0 xl:min-w-0"
      >
        <IconRefresh className={loading ? 'animate-spin' : ''} />
      </button>

      <Button variant="primary" onClick={onAdd} className="ml-auto sm:ml-0">
        <IconPlus /> Add component
      </Button>
    </div>
  )
}
