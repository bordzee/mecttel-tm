import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import { PublicParticipantsList } from '../components/PublicParticipantsList'
import { PublicBracketsView } from '../components/PublicBracketsView'
import { GroupStageNavigator } from '../components/GroupStageNavigator'
import {
  BackLink,
  ConfigRowsCard,
  EmptyMessage,
  EventPageTitle,
  InfoNoteCard,
  Pill,
  TagPill,
  WarningBanner,
} from '../components/ui/primitives'
import { formatSetRulesSummary, normalizeSetRules } from '../components/SetRulesPicker'
import { loadTeamRostersByTeamId } from '../lib/entryDisplay'
import { fetchTournament, fetchEvent, fetchEntries, fetchGroups } from '../lib/tournamentService'
import { entrySortKey, getStartLayoutOptions } from '../lib/groupLayout'
import { isFirebaseConfigured } from '../lib/firebase'
import { EVENT_TYPE_LABELS } from '../lib/constants'
import { getCategoryDisplay, getEventDisplayName } from '../lib/displayNames'
import { useMinLoading } from '../hooks/useMinLoading'
import { EventDetailSkeleton } from '../components/ui/Skeleton'
import { StatusPopups } from '../components/ui/StatusPopups'
import type { Tournament, TournamentEvent, TournamentEntry } from '../types'

type PublicDivisionTab = 'participants' | 'brackets'

function mapFetchError(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'Failed to load division'
  if (msg.includes('permission') || msg.includes('insufficient')) {
    return 'This division is not public yet or has ended.'
  }
  if (msg.includes('not found') || msg.includes('Not found')) {
    return 'This division was not found or has been removed.'
  }
  return msg
}

export function EventDetailPage() {
  const { tournamentId, eventId } = useParams<{ tournamentId: string; eventId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [event, setEvent] = useState<TournamentEvent | null>(null)
  const [entries, setEntries] = useState<TournamentEntry[]>([])
  const [groupCount, setGroupCount] = useState(0)
  const [rostersByTeamId, setRostersByTeamId] = useState<Map<string, string[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const showSkeleton = useMinLoading(loading)
  const [error, setError] = useState('')
  const [errorDismissed, setErrorDismissed] = useState(false)

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }
    if (!tournamentId || !eventId) {
      setError('Division not found')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    setTournament(null)
    setEvent(null)
    setEntries([])
    setGroupCount(0)

    Promise.all([
      fetchTournament(tournamentId),
      fetchEvent(tournamentId, eventId),
      fetchEntries(tournamentId, eventId),
    ])
      .then(async ([t, e, entriesList]) => {
        setTournament(t)
        setEvent(e)
        setEntries(entriesList)
        if (e.event_type === 'team') {
          setRostersByTeamId(await loadTeamRostersByTeamId(entriesList))
        } else {
          setRostersByTeamId(new Map())
        }
        if (e.status === 'ongoing') {
          const groups = await fetchGroups(tournamentId, eventId)
          setGroupCount(groups.length)
        }
        setError('')
      })
      .catch((e) => setError(mapFetchError(e)))
      .finally(() => setLoading(false))
  }, [tournamentId, eventId])

  useEffect(() => {
    setErrorDismissed(false)
  }, [error])

  const layoutPreview = useMemo(() => {
    if (!event || entries.length < 2) return []
    if (event.config.group_count && event.config.entries_per_group) return []
    return getStartLayoutOptions(entries.length, event.config).slice(0, 4)
  }, [event, entries.length])

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => entrySortKey(a) - entrySortKey(b)),
    [entries],
  )

  if (!isFirebaseConfigured) {
    return (
      <AppLayout>
        <WarningBanner>
          Firebase is not configured — live division data is unavailable.
        </WarningBanner>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        {!errorDismissed ? (
          <StatusPopups error={error} onErrorDismiss={() => setErrorDismissed(true)} />
        ) : (
          <EmptyMessage>{error}</EmptyMessage>
        )}
      </AppLayout>
    )
  }

  if (showSkeleton || !tournament || !event) {
    return (
      <AppLayout>
        <EventDetailSkeleton />
      </AppLayout>
    )
  }

  const cfg = event.config
  const groupLayout =
    cfg.entries_per_group && cfg.group_count
      ? cfg.group_sizes
        ? `${cfg.group_count} groups (${cfg.group_sizes.join('+')})`
        : `${cfg.group_count} groups of ${cfg.entries_per_group}`
      : null

  const entriesLabel =
    cfg.total_slots != null ? `${entries.length} / ${cfg.total_slots}` : String(entries.length)

  const setRules = normalizeSetRules(cfg.set_rules)
  const setRulesSummary = formatSetRulesSummary(setRules)

  const configRows = [
    { label: 'Entries', value: entriesLabel },
    ...(groupLayout ? [{ label: 'Group layout', value: groupLayout }] : []),
    { label: 'Advance per group', value: String(cfg.advance_count) },
    {
      label: 'Knockout',
      value: cfg.knockout_bracket === 'block' ? 'Block' : 'Cross',
    },
    { label: 'Group stage', value: setRulesSummary.group },
    { label: 'Knockout stage', value: setRulesSummary.knockout },
    { label: 'Finals', value: setRulesSummary.finals },
    ...(cfg.team_format ? [{ label: 'Team format', value: cfg.team_format }] : []),
  ]

  const publicTabs: { id: PublicDivisionTab; label: string }[] = [
    { id: 'participants', label: 'Participants' },
  ]
  if (event.status === 'ongoing' && groupCount > 0) {
    publicTabs.push({ id: 'brackets', label: 'Brackets' })
  }

  const tabParam = searchParams.get('tab')
  const activePublicTab: PublicDivisionTab =
    tabParam === 'brackets' && publicTabs.some((t) => t.id === 'brackets')
      ? 'brackets'
      : 'participants'

  const setPublicTab = (tab: PublicDivisionTab) => {
    if (tab === 'brackets') {
      setSearchParams({ tab: 'brackets' }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
  }

  return (
    <AppLayout bleed={activePublicTab === 'brackets'}>
      <div className={activePublicTab === 'brackets' ? 'px-4 pt-2 pb-6 space-y-4' : 'space-y-[18px]'}>
        <BackLink to={`/tournaments/${tournamentId}`}>{tournament.name}</BackLink>

        <EventPageTitle>{getEventDisplayName(event)}</EventPageTitle>

        <div className="flex flex-wrap gap-1.5">
          <TagPill>{EVENT_TYPE_LABELS[event.event_type]}</TagPill>
          {event.category && (
            <TagPill>{getCategoryDisplay(event.category)}</TagPill>
          )}
          {!event.category && cfg.category_label && (
            <TagPill>{cfg.category_label}</TagPill>
          )}
          {event.status === 'ongoing' && <Pill variant="live">Live</Pill>}
          {event.status === 'upcoming' && <Pill variant="upcoming">Registration open</Pill>}
        </div>

        {activePublicTab === 'participants' && (
          <>
            <ConfigRowsCard rows={configRows} />

            {layoutPreview.length > 0 && event.status === 'upcoming' && (
              <InfoNoteCard>
                <p className="font-semibold text-text-bluewhite mb-1">Possible group layouts ({entries.length} entries)</p>
                <p>{layoutPreview.map((o) => o.label).join(' · ')}</p>
                <p className="mt-1 text-text-steel">Final layout is chosen when the group stage is generated.</p>
              </InfoNoteCard>
            )}
          </>
        )}

        {publicTabs.length > 1 && (
          <GroupStageNavigator
            tabs={publicTabs}
            activeId={activePublicTab}
            onChange={(id) => setPublicTab(id as PublicDivisionTab)}
          />
        )}

        {activePublicTab === 'participants' && (
          <PublicParticipantsList
            entries={sortedEntries}
            eventType={event.event_type}
            rostersByTeamId={rostersByTeamId}
            maxSlots={cfg.total_slots}
          />
        )}

        {activePublicTab === 'brackets' && tournamentId && eventId && (
          <PublicBracketsView tournamentId={tournamentId} eventId={eventId} />
        )}
      </div>
    </AppLayout>
  )
}
