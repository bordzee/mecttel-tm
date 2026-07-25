import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import { GroupStandingsTable } from '../components/GroupStandingsTable'
import { GroupStageNavigator } from '../components/GroupStageNavigator'
import { KnockoutBracket } from '../components/KnockoutBracket'
import { BackLink, CenteredState, EmptyMessage, ErrorMessage } from '../components/ui/primitives'
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
import type { Tournament, TournamentEvent, Group, GroupMatch, KnockoutMatch, TournamentEntry, KnockoutRound } from '../types'

function roundShortLabel(round: KnockoutRound): string {
  if (round === 'quarter') return 'Quarters'
  if (round === 'semi') return 'Semis'
  return 'Final'
}

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
  const [error, setError] = useState('')
  const loadSeq = useRef(0)

  const fetchEventData = useCallback(async () => {
    if (!tournamentId || !eventId) return
    const seq = ++loadSeq.current
    try {
      const [t, ev, g, gm, km, e] = await Promise.all([
        fetchTournament(tournamentId),
        fetchEvent(tournamentId, eventId),
        fetchGroups(eventId),
        fetchGroupMatches(eventId),
        fetchKnockoutMatches(eventId),
        fetchEntries(eventId),
      ])
      if (seq !== loadSeq.current) return
      const m = await fetchGroupMembers(eventId, g.map((x) => x.id))
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
    fetchEventData()
    return () => {
      loadSeq.current++
    }
  }, [fetchEventData])

  useRealtimeEvent(eventId, fetchEventData)

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
          <p className="text-sm text-slate-500">This division may have ended or is not public yet.</p>
        </CenteredState>
      </AppLayout>
    )
  }

  if (!tournament || !event) {
    return (
      <AppLayout>
        <EmptyMessage>Loading…</EmptyMessage>
      </AppLayout>
    )
  }

  const eventName = getEventDisplayName(event)
  const subtitle = activeKnockoutRound
    ? `${eventName} · ${roundShortLabel(activeKnockoutRound)}`
    : eventName

  return (
    <AppLayout bleed>
      <div className="px-4 pt-2 pb-6 space-y-0">
        <div className="space-y-1 py-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-tt-pulse shrink-0" aria-hidden />
            <h1 className="font-heading text-lg font-bold text-slate-900">{tournament.name}</h1>
          </div>
          <p className="text-sm text-slate-500">{subtitle}</p>
          <BackLink to={`/tournaments/${tournamentId}/events/${eventId}`}>← {eventName}</BackLink>
        </div>

        {stageTabs.length > 0 && (
          <GroupStageNavigator tabs={stageTabs} activeId={activeStage} onChange={setActiveStage} />
        )}

        <div className="space-y-4 pt-4">
          {activeGroupStage && (
            <GroupStandingsTable
              label={activeGroupStage.group.label}
              rows={activeGroupStage.rows}
              manualRanks={activeGroupStage.hasManualRanks}
              manualRankNote={activeGroupStage.group.manual_rank_note}
            />
          )}

          {activeKnockoutRound && activeKnockoutMatches.length > 0 && (
            <KnockoutBracket matches={activeKnockoutMatches} round={activeKnockoutRound} />
          )}

          {stageTabs.length === 0 && (
            <EmptyMessage>No group or knockout data yet.</EmptyMessage>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
