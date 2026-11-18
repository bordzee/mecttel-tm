import { useEffect, useRef, useState } from 'react'
import { CaptionText, FormLabel, TextInput } from './ui/primitives'
import { participantFilterLabel } from '../lib/participantFilters'

function FilterIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  )
}

export function ParticipantFilterToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  orgOptions,
  disabled = false,
  totalCount,
  filteredCount,
}: {
  search: string
  onSearchChange: (value: string) => void
  filter: string
  onFilterChange: (value: string) => void
  orgOptions: string[]
  disabled?: boolean
  totalCount: number
  filteredCount: number
}) {
  const [filterOpen, setFilterOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const filterActive = filter !== 'all'

  useEffect(() => {
    if (!filterOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [filterOpen])

  const selectFilter = (value: string) => {
    onFilterChange(value)
    setFilterOpen(false)
  }

  const filterOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'All participants' },
    ...orgOptions.map((org) => ({ value: `org:${org}`, label: org })),
    { value: 'seeded', label: 'Seeded' },
    { value: 'non-seeded', label: 'Non-seeded' },
    { value: 'not-set', label: 'Seeded not set' },
  ]

  return (
    <div className="space-y-2 shrink-0" ref={panelRef}>
      <div className="flex gap-2 items-stretch">
        <div className="flex-1 min-w-0">
          <TextInput
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name…"
            aria-label="Search participants"
            disabled={disabled}
          />
        </div>
        <button
          type="button"
          aria-label="Filter participants"
          aria-expanded={filterOpen}
          aria-haspopup="true"
          disabled={disabled}
          onClick={() => setFilterOpen((open) => !open)}
          className={`h-12 w-12 shrink-0 rounded-xl border flex items-center justify-center transition-colors ${
            filterActive
              ? 'border-brand-500 bg-brand-500/15 text-accent-text'
              : 'border-border bg-card-raised text-text-bluewhite hover:border-border-strong'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <FilterIcon />
        </button>
      </div>

      {filterOpen && (
        <div className="rounded-xl border border-border-strong bg-navy/60 p-2 space-y-2 shadow-lg">
          <FormLabel>Filter by</FormLabel>
          <div className="flex flex-wrap gap-1.5">
            {filterOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => selectFilter(opt.value)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filter === opt.value
                    ? 'bg-brand-500 text-on-accent'
                    : 'bg-card border border-border text-text-bluewhite hover:border-border-strong'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {filterActive && (
            <p className="text-xs text-text-steel">
              Active: {participantFilterLabel(filter)}
            </p>
          )}
        </div>
      )}

      {(search.trim() || filterActive) && totalCount > 0 && (
        <CaptionText>
          Showing {filteredCount} of {totalCount}
        </CaptionText>
      )}
    </div>
  )
}
