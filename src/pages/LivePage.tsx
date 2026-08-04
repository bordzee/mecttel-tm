import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import { GroupStandingsTable } from '../components/GroupStandingsTable'
import { GroupStageNavigator } from '../components/GroupStageNavigator'
import { KnockoutBracket } from '../components/KnockoutBracket'
import { BackLink, CenteredState, EmptyMessage, ErrorMessage, PageTitle } from '../components/ui/primitives'
import {
  fetchTournament,
  fetchEvent,
  fetchGroups,
  fetchGroupMembers,
  fetchGroupMatches,
  fetchKnockoutMatches,
  fetchEntries,
} from '../lib/tournamentService'
import { resolveGroupStandings } from '../lib/standings'
import { getEventDisplayName } from '../lib/displayNames'
import { buildKnockoutStageTabs, isKnockoutStage, knockoutRoundFromStageId } from '../lib/knockoutTabs'
import { useRealtimeEvent } from '../hooks/useRealtimeEvent'
import { isFirebaseConfigured } from '../lib/firebase'
import type { Tournament, TournamentEvent, Group, GroupMatch, KnockoutMatch, TournamentEntry } from '../types'

export function LivePage() {
  const { tournamentId, eventId } = useParams<{ tournamentId: string; eventId: string }>()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [event, setEvent] = useState<TournamentEvent | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [groupMatches, setGroupMatches] = useState<GroupMatch[]>([])
  const [knockoutMatches, setKnockoutMatches] = useState<KnockoutMatch[]>([])
  const [entries, setEntries] = useState<TournamentEntry[]>([])
  const [members, setMembers] = useState<{ group_id: string; entry_id: string }[]>([])
  const [activeStage, setActiveStage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const loadSeq = useRef(0)

  const fetchEventData = useCallback(async () => {
    if (!tournamentId || !eventId) return
    const seq = ++loadSeq.current
    try {
      const [t, ev, g, gm, km, e] = await Promise.all([
        fetchTournament(tournamentId),
        fetchEvent(tournamentId, eventId),
        fetchGroups(tournamentId, eventId),
        fetchGroupMatches(tournamentId, eventId),
        fetchKnockoutMatches(tournamentId, eventId),
        fetchEntries(tournamentId, eventId),
      ])
      if (seq !== loadSeq.current) return
      const m = await fetchGroupMembers(tournamentId, eventId, g.map((x) => x.id))
      if (seq !== loadSeq.current) return
      setTournament(t)
      setEvent(ev)
      setGroups(g)
      setGroupMatches(gm)
      setKnockoutMatches(km)
      setEntries(e)
      setMembers(m.map((x) => ({ group_id: x.group_id, entry_id: x.entry_id })))
      setError('')
    } catch (e) {
      if (seq !== loadSeq.current) return
      setError(e instanceof Error ? e.message : 'Failed to load live data')
    }
  }, [tournamentId, eventId])

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setError('Firebase is not configured')
      setLoading(false)
      return
    }
    if (!tournamentId || !eventId) {
      setError('Division not found')
      setLoading(false)
      return
    }
    setLoading(true)
    setTournament(null)
    setEvent(null)
    fetchEventData().finally(() => setLoading(false))
    return () => {
      loadSeq.current++
    }
  }, [fetchEventData, tournamentId, eventId])

  useRealtimeEvent(
    isFirebaseConfigured ? tournamentId : undefined,
    isFirebaseConfigured ? eventId : undefined,
    fetchEventData,
    (msg) => setError(msg),
  )

  const entryMap = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries])

  const groupStageData = useMemo(() => {
    return groups.map((group) => {
      const entryIds = members.filter((m) => m.group_id === group.id).map((m) => m.entry_id)
      const matches = groupMatches.filter((m) => m.group_id === group.id)
      const pending = matches.filter((m) => m.status !== 'completed')
      return {
        group,
        pendingCount: pending.length,
        rows: resolveGroupStandings(entryIds, matches, entryMap, group.manual_rank_order),
        hasManualRanks: !!group.manual_rank_order?.length,
      }
    })
  }, [groups, members, groupMatches, entryMap])

  const stageTabs = useMemo(() => {
    const tabs = groupStageData.map(({ group, pendingCount }) => ({
      id: group.id,
      label: `Group ${group.label}`,
      pendingCount,
    }))
    tabs.push(...buildKnockoutStageTabs(knockoutMatches))
    return tabs
  }, [groupStageData, knockoutMatches])

  useEffect(() => {
    if (!stageTabs.length) return
    setActiveStage((prev) => (stageTabs.some((t) => t.id === prev) ? prev : stageTabs[0].id))
  }, [stageTabs])

  const activeGroupStage = groupStageData.find((g) => g.group.id === activeStage)
  const activeKnockoutRound = isKnockoutStage(activeStage) ? knockoutRoundFromStageId(activeStage) : null
  const activeKnockoutMatches = activeKnockoutRound
    ? knockoutMatches.filter((m) => m.round === activeKnockoutRound)
    : []

  if (error) {
    return (
      <AppLayout>
        <CenteredState>
          <ErrorMessage>{error}</ErrorMessage>
          <p className="text-sm text-text-steel">This division may have ended or is not public yet.</p>
        </CenteredState>
      </AppLayout>
    )
  }

  if (!tournament || !event) {
    return (
      <AppLayout>
        <EmptyMessage>{loading ? 'Loading…' : 'Division not found'}</EmptyMessage>
      </AppLayout>
    )
  }

  if (event.status !== 'ongoing') {
    return (
      <AppLayout>
        <CenteredState>
          <PageTitle>{getEventDisplayName(event)}</PageTitle>
          <p className="text-sm text-text-steel">
            This division is not live yet. Check back when it has started.
          </p>
          <Link
            to={`/tournaments/${tournamentId}/events/${eventId}`}
            className="text-sm font-semibold text-brand-500 hover:underline"
          >
            View division details
          </Link>
        </CenteredState>
      </AppLayout>
    )
  }

  const eventName = getEventDisplayName(event)
  const isKnockoutView = !!activeKnockoutRound

  return (
    <AppLayout bleed>
      <div className="px-4 pt-2 pb-6 space-y-4">
        <BackLink to={`/tournaments/${tournamentId}/events/${eventId}`}>{eventName}</BackLink>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-live animate-tt-pulse shrink-0" aria-hidden />
            <span className="text-xs font-bold text-live uppercase tracking-wide">Live</span>
          </div>
          <PageTitle>{eventName}</PageTitle>
          {isKnockoutView && (
            <p className="text-sm text-text-steel">{tournament.name}</p>
          )}
        </div>

        {stageTabs.length > 0 && (
          <GroupStageNavigator tabs={stageTabs} activeId={activeStage} onChange={setActiveStage} />
        )}

        <div className="space-y-4">
          {activeGroupStage && (
            <GroupStandingsTable
              label={activeGroupStage.group.label}
              rows={activeGroupStage.rows}
              manualRanks={activeGroupStage.hasManualRanks}
              manualRankNote={activeGroupStage.group.manual_rank_note}
              externalHeader
            />
          )}

          {activeKnockoutRound && activeKnockoutMatches.length > 0 && (
            <KnockoutBracket
              matches={activeKnockoutMatches}
              round={activeKnockoutRound}
              hideRoundTitle
            />
          )}

          {activeKnockoutRound && activeKnockoutMatches.length === 0 && (
            <EmptyMessage>No knockout matches in this round yet.</EmptyMessage>
          )}

          {stageTabs.length === 0 && (
            <EmptyMessage>No group or knockout data yet.</EmptyMessage>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
