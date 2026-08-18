import { useEffect, useMemo, useState } from 'react'
import {
  CaptionText,
  EmptyMessage,
  FormLabel,
  ParticipantsTitle,
  SeededStarIcon,
  SelectInput,
  TextInput,
} from './ui/primitives'
import { getEntryDisplayName } from '../lib/displayNames'
import { getComparableNames, normalizeEntryName } from '../lib/entryValidation'
import {
  getEntryOrganization,
  getEntrySeededFilterStatus,
  isEntrySeeded,
} from '../lib/groupLayout'
import type { EventType, TournamentEntry } from '../types'

export function PublicParticipantsList({
  title = 'Participants',
  entries,
  eventType,
  rostersByTeamId,
  maxSlots,
}: {
  title?: string
  entries: TournamentEntry[]
  eventType: EventType
  rostersByTeamId?: Map<string, string[]>
  maxSlots?: number
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const countLabel =
    maxSlots != null ? `${entries.length} / ${maxSlots}` : String(entries.length)

  const orgOptions = useMemo(() => {
    const names = new Set<string>()
    for (const entry of entries) {
      const org = getEntryOrganization(entry)
      if (org?.trim()) names.add(org.trim())
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [entries])

  const filteredEntries = useMemo(() => {
    const query = normalizeEntryName(search)
    return entries.filter((entry) => {
      if (query) {
        const matchesSearch = getComparableNames(entry).some((name) => name.includes(query))
        if (!matchesSearch) return false
      }
      if (filter === 'all') return true
      if (filter === 'seeded') return getEntrySeededFilterStatus(entry) === 'seeded'
      if (filter === 'non-seeded') return getEntrySeededFilterStatus(entry) === 'non-seeded'
      if (filter === 'not-set') return getEntrySeededFilterStatus(entry) === 'not-set'
      if (filter.startsWith('org:')) {
        return getEntryOrganization(entry) === filter.slice(4)
      }
      return true
    })
  }, [entries, search, filter])

  useEffect(() => {
    if (!filter.startsWith('org:')) return
    const org = filter.slice(4)
    if (!orgOptions.includes(org)) setFilter('all')
  }, [filter, orgOptions])

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <ParticipantsTitle>{title}</ParticipantsTitle>
        <span className="text-[13px] font-semibold text-text-steel tabular-nums">{countLabel}</span>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          aria-label="Search participants"
          disabled={entries.length === 0}
        />

        <div>
          <FormLabel>Filter</FormLabel>
          <SelectInput
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter participants"
            disabled={entries.length === 0}
          >
            <option value="all">All participants</option>
            {orgOptions.length > 0 && (
              <optgroup label="Organization">
                {orgOptions.map((org) => (
                  <option key={org} value={`org:${org}`}>
                    {org}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Seeded status">
              <option value="seeded">Seeded</option>
              <option value="non-seeded">Non-seeded</option>
              <option value="not-set">Seeded not set</option>
            </optgroup>
          </SelectInput>
        </div>

        {(search.trim() || filter !== 'all') && entries.length > 0 && (
          <CaptionText>
            Showing {filteredEntries.length} of {entries.length}
          </CaptionText>
        )}

        <div className="h-[min(420px,50vh)] overflow-y-auto space-y-2 pr-0.5">
          {entries.length === 0 ? (
            <EmptyMessage>No entries submitted yet.</EmptyMessage>
          ) : filteredEntries.length === 0 ? (
            <EmptyMessage>No participants match your search or filter.</EmptyMessage>
          ) : (
            <ul className="space-y-2">
              {filteredEntries.map((entry) => (
                <PublicParticipantRow
                  key={entry.id}
                  entry={entry}
                  eventType={eventType}
                  roster={entry.team_id ? rostersByTeamId?.get(entry.team_id) : undefined}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

function PublicParticipantRow({
  entry,
  eventType,
  roster,
}: {
  entry: TournamentEntry
  eventType: EventType
  roster?: string[]
}) {
  const name = getEntryDisplayName(entry)
  const org = getEntryOrganization(entry)
  const seeded = isEntrySeeded(entry)
  const pairDetail =
    entry.entry_type === 'pair' && entry.pair && entry.pair.pair_name
      ? `${entry.pair.player_a} / ${entry.pair.player_b}`
      : null

  return (
    <li className="bg-card-raised rounded-xl border border-border px-3 py-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-text-primary truncate">{name}</p>
          {pairDetail && <p className="text-sm text-text-steel mt-0.5">{pairDetail}</p>}
          {org && <p className="text-sm text-text-steel mt-0.5">{org}</p>}
          {eventType === 'team' && roster && roster.length > 0 && (
            <p className="text-sm text-text-steel mt-1">{roster.join(' · ')}</p>
          )}
        </div>
        {seeded && (
          <span className="shrink-0 inline-flex self-center" title="Seeded" aria-label="Seeded">
            <SeededStarIcon size={18} />
          </span>
        )}
      </div>
    </li>
  )
}
