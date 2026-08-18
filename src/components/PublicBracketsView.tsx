import { useCallback, useEffect, useMemo, useState } from 'react'
import { GroupStandingsTable } from './GroupStandingsTable'
import { GroupStageNavigator } from './GroupStageNavigator'
import { KnockoutBracket } from './KnockoutBracket'
import { EmptyMessage } from './ui/primitives'
import { BracketsTabSkeleton } from './ui/Skeleton'
import { useMinLoading } from '../hooks/useMinLoading'
import {
  fetchGroups,
  fetchGroupMembers,
  fetchGroupMatches,
  fetchKnockoutMatches,
  fetchEntries,
} from '../lib/tournamentService'
import { resolveGroupStandings } from '../lib/standings'
import { buildKnockoutStageTabs, isKnockoutStage, knockoutRoundFromStageId } from '../lib/knockoutTabs'
import { useRealtimeEvent } from '../hooks/useRealtimeEvent'
import type { Group, GroupMatch, KnockoutMatch, TournamentEntry } from '../types'

export function PublicBracketsView({
  tournamentId,
  eventId,
}: {
  tournamentId: string
  eventId: string
}) {
  const [groups, setGroups] = useState<Group[]>([])
  const [groupMatches, setGroupMatches] = useState<GroupMatch[]>([])
  const [knockoutMatches, setKnockoutMatches] = useState<KnockoutMatch[]>([])
  const [entries, setEntries] = useState<TournamentEntry[]>([])
  const [members, setMembers] = useState<{ group_id: string; entry_id: string }[]>([])
  const [activeStage, setActiveStage] = useState('')
  const [loading, setLoading] = useState(true)
  const showSkeleton = useMinLoading(loading)
  const [error, setError] = useState('')

  const fetchEventData = useCallback(async () => {
    try {
      const [g, gm, km, e] = await Promise.all([
        fetchGroups(tournamentId, eventId),
        fetchGroupMatches(tournamentId, eventId),
        fetchKnockoutMatches(tournamentId, eventId),
        fetchEntries(tournamentId, eventId),
      ])
      const m = await fetchGroupMembers(tournamentId, eventId, g.map((x) => x.id))
      setGroups(g)
      setGroupMatches(gm)
      setKnockoutMatches(km)
      setEntries(e)
      setMembers(m.map((x) => ({ group_id: x.group_id, entry_id: x.entry_id })))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load brackets')
    }
  }, [tournamentId, eventId])

  useEffect(() => {
    setLoading(true)
    fetchEventData().finally(() => setLoading(false))
  }, [fetchEventData])

  useRealtimeEvent(tournamentId, eventId, fetchEventData, (msg) => setError(msg))

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

  if (showSkeleton) {
    return <BracketsTabSkeleton />
  }

  if (error) {
    return <EmptyMessage>{error}</EmptyMessage>
  }

  if (!stageTabs.length) {
    return <EmptyMessage>No group or knockout data yet.</EmptyMessage>
  }

  return (
    <div className="space-y-4">
      <GroupStageNavigator tabs={stageTabs} activeId={activeStage} onChange={setActiveStage} />

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
    </div>
  )
}
