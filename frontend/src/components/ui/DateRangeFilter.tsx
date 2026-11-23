'use client'

import { CalendarDays } from 'lucide-react'

export type DateRange = { preset: string; from: string; to: string }

export const ALL_TIME: DateRange = { preset: 'all', from: '', to: '' }

const iso = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 10)
}

const PRESETS: { value: string; label: string; range?: () => [string, string] }[] = [
  { value: 'all', label: 'All time' },
  { value: 'this_month', label: 'This month', range: () => { const n = new Date(); return [iso(new Date(n.getFullYear(), n.getMonth(), 1)), iso(n)] } },
  { value: 'last_month', label: 'Last month', range: () => { const n = new Date(); return [iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)), iso(new Date(n.getFullYear(), n.getMonth(), 0))] } },
  { value: '30d', label: 'Last 30 days', range: () => { const n = new Date(); const s = new Date(n); s.setDate(n.getDate() - 29); return [iso(s), iso(n)] } },
  { value: '90d', label: 'Last 90 days', range: () => { const n = new Date(); const s = new Date(n); s.setDate(n.getDate() - 89); return [iso(s), iso(n)] } },
  { value: 'this_year', label: 'This year', range: () => { const n = new Date(); return [iso(new Date(n.getFullYear(), 0, 1)), iso(n)] } },
  { value: 'custom', label: 'Custom range' },
]

/** True if a 'YYYY-MM-DD' (or ISO timestamp) date falls inside the range. Empty range = everything. */
export function inRange(date: string | null | undefined, r: DateRange) {
  if (!r.from && !r.to) return true
  if (!date) return false
  const d = String(date).slice(0, 10)
  return (!r.from || d >= r.from) && (!r.to || d <= r.to)
}

interface Props {
  value: DateRange
  onChange: (r: DateRange) => void
  label?: string
}

export function DateRangeFilter({ value, onChange, label = 'Date' }: Props) {
  const choose = (preset: string) => {
    const p = PRESETS.find((x) => x.value === preset)
    if (p?.range) { const [from, to] = p.range(); onChange({ preset, from, to }) }
    else if (preset === 'custom') onChange({ preset, from: value.from, to: value.to })
    else onChange(ALL_TIME)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <select
          aria-label={`${label} range`}
          value={value.preset}
          onChange={(e) => choose(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white py-2 pl-8 pr-8 text-sm"
        >
          {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
      {value.preset === 'custom' && (
        <>
          <input
            type="date"
            aria-label={`${label} from`}
            value={value.from}
            max={value.to || undefined}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
          />
          <span className="text-sm text-gray-500">to</span>
          <input
            type="date"
            aria-label={`${label} to`}
            value={value.to}
            min={value.from || undefined}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
          />
        </>
      )}
    </div>
  )
}
