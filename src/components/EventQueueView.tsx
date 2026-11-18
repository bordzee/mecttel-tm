import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  CaptionText,
  EmptyMessage,
  PanelSectionTitle,
  TagPill,
  TextInput,
} from './ui/primitives'
import { BracketsTabSkeleton } from './ui/Skeleton'
import { StatusPopups } from './ui/StatusPopups'
import { GroupStageNavigator } from './GroupStageNavigator'
import { MatchScoreDialog } from './MatchScoreDialog'
import { QueueAnnouncementDialog } from './QueueAnnouncementDialog'
import { createLiveEventLoader } from '../lib/liveEventData'
import { useMinLoading } from '../hooks/useMinLoading'
import { useRealtimeEvent } from '../hooks/useRealtimeEvent'
import {
  assignMatchTable,
  fetchKnockoutMatches,
  saveGroupMatchResult,
  saveKnockoutMatchResult,
} from '../lib/tournamentService'
import { buildEventMatchQueue } from '../lib/matchQueue'
import {
  buildEventQueueState,
  filterQueueByName,
  findPlayerStatus,
  getTableAnnouncement,
  UP_NEXT_DISPLAY_LIMIT,
  type TableAnnouncement,
} from '../lib/tableAssignment'
import { normalizeTableCount } from '../lib/tableLabels'
import { setRulesStageForRound } from '../lib/knockoutRounds'
import { matchEffectiveRound } from '../lib/knockoutTabs'
import type { QueueMatchView } from '../lib/matchQueue'
import type { GroupMatch, KnockoutMatch, TournamentEntry, TournamentEvent } from '../types'

function matchStageLabel(m: QueueMatchView): string {
  if (m.stage === 'group' && m.groupLabel) return `Group ${m.groupLabel}`
  if (m.stage === 'knockout' && m.round) return m.round.replace('_', ' ').toUpperCase()
  return ''
}

function MatchRow({
  match,
  highlight,
  hideTableBadge = false,
}: {
  match: QueueMatchView
  highlight?: boolean
  hideTableBadge?: boolean
}) {
  return (
    <div className="text-sm text-text-primary">
      <p className={highlight ? 'font-semibold' : 'font-medium'}>
        {match.homeName} vs {match.awayName}
      </p>
      <div className="flex flex-wrap items-center gap-x-2 mt-0.5">
        {matchStageLabel(match) && (
          <span className="text-xs text-text-steel">{matchStageLabel(match)}</span>
        )}
        {!hideTableBadge && match.restReason && (
          <span className="text-xs text-amber">{match.restReason}</span>
        )}
      </div>
    </div>
  )
}

/** A table-tennis table seen from above: green surface, outline, net line down the middle. */
function Court({ match, animate }: { match: QueueMatchView; animate: boolean }) {
  const restWaived = !match.playable && Boolean(match.restReason)
  return (
    <>
    <div
      className={`relative isolate grid grid-cols-2 items-center min-h-[108px] rounded-[10px] bg-court text-on-court px-5 py-3.5 ${
        animate ? 'animate-tt-place' : ''
      }`}
    >
      <span aria-hidden className="absolute inset-2 -z-10 rounded-[5px] border-[1.5px] border-white/55" />
      <span aria-hidden className="absolute top-2 bottom-2 left-1/2 -z-10 w-0.5 -ml-px bg-white/85" />
      <p className="min-w-0 px-3 text-[15px] font-semibold leading-tight [overflow-wrap:anywhere]">
        {match.homeName}
      </p>
      <p className="min-w-0 px-3 text-right text-[15px] font-semibold leading-tight [overflow-wrap:anywhere]">
        {match.awayName}
      </p>
    </div>
    {restWaived && (
      <p className="mt-1.5 text-xs text-amber">
        Rest rule waived: {match.restReason}. No other match could be played.
      </p>
    )}
    </>
  )
}

function PlayerStatusCard({ status }: { status: NonNullable<ReturnType<typeof findPlayerStatus>> }) {
  return (
    <div role="status" className="animate-tt-place rounded-[14px] bg-brand-100 px-5 py-4 space-y-0.5">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-faint">{status.name}</p>
      <p className="text-xl font-semibold tracking-tight text-text-primary">{status.title}</p>
      <p className="text-sm text-text-steel">{status.detail}</p>
    </div>
  )
}

type ScoreTarget = {
  queueMatch: QueueMatchView
  tableNumber: number
}

type QueuePanelTab = 'playing' | 'up-next' | 'waiting'

const QUEUE_PANEL_TABS: { id: QueuePanelTab; label: string }[] = [
  { id: 'playing', label: 'Playing' },
  { id: 'up-next', label: 'Up next' },
  { id: 'waiting', label: 'Waiting' },
]

function tableGridClass(tableCount: number): string {
  if (tableCount >= 3) return 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
  if (tableCount === 2) return 'grid gap-4 grid-cols-1 sm:grid-cols-2'
  return 'grid gap-4 grid-cols-1'
}

export function EventQueueView({
  tournamentId,
  eventId,
  admin = false,
  onRefresh,
}: {
  tournamentId: string
  eventId: string
  admin?: boolean
  onRefresh?: () => void | Promise<void>
}) {
  const [event, setEvent] = useState<TournamentEvent | null>(null)
  const [groups, setGroups] = useState<{ id: string; label: string }[]>([])
  const [groupMatches, setGroupMatches] = useState<GroupMatch[]>([])
  const [knockoutMatches, setKnockoutMatches] = useState<KnockoutMatch[]>([])
  const [entries, setEntries] = useState<TournamentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const showSkeleton = useMinLoading(loading)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [scoreTarget, setScoreTarget] = useState<ScoreTarget | null>(null)
  const [announcement, setAnnouncement] = useState<TableAnnouncement | null>(null)
  const [announcementOpen, setAnnouncementOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [queuePanelTab, setQueuePanelTab] = useState<QueuePanelTab>('playing')
  const persistedTableAssignRef = useRef(new Set<string>())
  const [armed, setArmed] = useState(false)

  // Participants are reused between live updates; see createLiveEventLoader.
  const loader = useRef(createLiveEventLoader({ withMembers: false }))

  const loadQueueData = useCallback(async (options?: { force?: boolean }) => {
    try {
      const live = await loader.current(tournamentId, eventId, options)
      const { event: ev, groups: g, groupMatches: gm, knockoutMatches: km, entries: e } = live
      setEvent(ev)
      setGroups(g.map((x) => ({ id: x.id, label: x.label })))
      setGroupMatches(gm)
      setKnockoutMatches(km)
      setEntries(e)
      setError('')
      return { gm, km, e, g, ev }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue')
      return null
    }
  }, [tournamentId, eventId])

  const fetchEventData = useCallback(async () => {
    await loadQueueData()
  }, [loadQueueData])

  useEffect(() => {
    setLoading(true)
    loadQueueData({ force: true }).finally(() => setLoading(false))
  }, [loadQueueData])

  // Entrance motion is for changes people cause, never for the first paint.
  useEffect(() => {
    if (loading) return
    const id = window.setTimeout(() => setArmed(true), 400)
    return () => window.clearTimeout(id)
  }, [loading])

  useRealtimeEvent(tournamentId, eventId, fetchEventData, (msg) => setError(msg))

  const entryMap = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries])

  const queueBundle = useMemo(() => {
    return buildEventMatchQueue({ groups, groupMatches, knockoutMatches, entryMap })
  }, [groups, groupMatches, knockoutMatches, entryMap])

  const tableCount = normalizeTableCount(event?.config.table_count)

  const baseQueueState = useMemo(() => {
    return buildEventQueueState(queueBundle.ordered, queueBundle.entryWait, tableCount)
  }, [queueBundle, tableCount])

  const queueState = useMemo(() => {
    return filterQueueByName(baseQueueState, search)
  }, [baseQueueState, search])

  const playerStatus = useMemo(
    () => findPlayerStatus(baseQueueState, search, tableCount),
    [baseQueueState, search, tableCount],
  )

  useEffect(() => {
    if (!admin || loading) return

    let cancelled = false
    const persistTableAssignments = async () => {
      let changed = false
      for (const slot of baseQueueState.tables) {
        const m = slot.match
        if (!m || m.assignedTable === slot.tableNumber) continue
        const key = `${m.matchId}@${slot.tableNumber}`
        if (persistedTableAssignRef.current.has(key)) continue
        try {
          await assignMatchTable(m.stage, m.matchId, slot.tableNumber)
          persistedTableAssignRef.current.add(key)
          changed = true
        } catch {
          // Queue still works with estimated tables if persistence fails.
        }
      }
      if (changed && !cancelled) {
        await loadQueueData()
      }
    }

    void persistTableAssignments()
    return () => {
      cancelled = true
    }
  }, [admin, loading, baseQueueState.tables, loadQueueData])

  // Public screen: when a table's finished match is replaced (live update), call the next match.
  // Admins get the same popup right after they save a score, so this is for viewers only.
  const prevTableMatchesRef = useRef<Map<number, string> | null>(null)
  useEffect(() => {
    if (admin || loading) return
    const now = new Map<number, string>()
    for (const slot of baseQueueState.tables) if (slot.match) now.set(slot.tableNumber, slot.match.matchId)
    const prev = prevTableMatchesRef.current
    prevTableMatchesRef.current = now
    if (!prev || !armed) return
    const finished = new Set(
      [...groupMatches, ...knockoutMatches].filter((m) => m.status === 'completed').map((m) => m.id),
    )
    let changedTable: number | null = null
    for (const [table, matchId] of prev) {
      if (now.get(table) !== matchId && finished.has(matchId)) changedTable = table
    }
    if (changedTable === null) return
    setAnnouncement(getTableAnnouncement(changedTable, baseQueueState))
    setAnnouncementOpen(true)
  }, [admin, loading, armed, baseQueueState, groupMatches, knockoutMatches])

  const pendingCount = useMemo(() => {
    const onTables = baseQueueState.tables.filter((slot) => slot.match).length
    return baseQueueState.upNext.length + baseQueueState.onDeck.length + onTables
  }, [baseQueueState])

  const resolveFullMatch = useCallback(
    (queueMatch: QueueMatchView): GroupMatch | KnockoutMatch | null => {
      if (queueMatch.stage === 'group') {
        return groupMatches.find((m) => m.id === queueMatch.matchId) ?? null
      }
      return knockoutMatches.find((m) => m.id === queueMatch.matchId) ?? null
    },
    [groupMatches, knockoutMatches],
  )

  const scoreDialogMatch = scoreTarget ? resolveFullMatch(scoreTarget.queueMatch) : null

  const scoreDialogStage = useMemo(() => {
    if (!scoreDialogMatch || scoreTarget?.queueMatch.stage !== 'knockout') return 'group' as const
    return setRulesStageForRound(matchEffectiveRound(scoreDialogMatch as KnockoutMatch, knockoutMatches))
  }, [scoreDialogMatch, scoreTarget, knockoutMatches])

  const openScoreDialog = async (queueMatch: QueueMatchView, tableNumber: number) => {
    const full = resolveFullMatch(queueMatch)
    if (!full || full.status === 'completed') {
      setError('This match is no longer available to score.')
      return
    }
    try {
      await assignMatchTable(queueMatch.stage, queueMatch.matchId, tableNumber)
    } catch {
      // Non-blocking — queue still works with estimated tables
    }
    setScoreTarget({ queueMatch, tableNumber })
  }

  const refreshAfterSave = async (tableNumber: number) => {
    const loaded = await loadQueueData()
    await onRefresh?.()
    if (!loaded) return

    const map = new Map(loaded.e.map((entry) => [entry.id, entry]))
    const freshQueue = buildEventMatchQueue({
      groups: loaded.g.map((x) => ({ id: x.id, label: x.label })),
      groupMatches: loaded.gm,
      knockoutMatches: loaded.km,
      entryMap: map,
    })
    const freshState = buildEventQueueState(
      freshQueue.ordered,
      freshQueue.entryWait,
      normalizeTableCount(loaded.ev.config.table_count),
    )
    setAnnouncement(getTableAnnouncement(tableNumber, freshState))
    setAnnouncementOpen(true)
  }

  const handleSaveScore = async (data: {
    score_a: number
    score_b: number
    rubber_results: { home: ('W' | 'L' | null)[] } | null
    winner_entry_id: string
    outcome: string
  }) => {
    if (!scoreTarget) return
    const { queueMatch, tableNumber } = scoreTarget
    setSaving(true)
    setError('')
    try {
      if (queueMatch.stage === 'group') {
        await saveGroupMatchResult(queueMatch.matchId, data)
      } else {
        const allKm = await fetchKnockoutMatches(tournamentId, eventId)
        const km = allKm.find((m) => m.id === queueMatch.matchId)
        if (!km) throw new Error('Match not found')
        const stage = setRulesStageForRound(matchEffectiveRound(km, allKm))
        await saveKnockoutMatchResult(queueMatch.matchId, data, stage)
      }
      setScoreTarget(null)
      await refreshAfterSave(tableNumber)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      throw err
    } finally {
      setSaving(false)
    }
  }

  if (showSkeleton) {
    return <BracketsTabSkeleton />
  }

  if (error && !event) {
    return (
      <>
        <StatusPopups error={error} onErrorDismiss={() => setError('')} />
        <EmptyMessage>Match queue could not be loaded.</EmptyMessage>
      </>
    )
  }

  if (pendingCount === 0) {
    return (
      <div className="space-y-3">
        <StatusPopups error={error} onErrorDismiss={() => setError('')} />
        <EmptyMessage>No pending matches — check Brackets for standings.</EmptyMessage>
      </div>
    )
  }

  const phaseLabel =
    queueBundle.phase === 'group'
      ? 'Group stage'
      : queueBundle.phase === 'knockout'
        ? 'Knockout stage'
        : ''

  const upNextVisible = queueState.upNext.slice(0, UP_NEXT_DISPLAY_LIMIT)
  const upNextHiddenCount = queueState.upNext.length - upNextVisible.length
  const onDeckVisible = queueState.onDeck.slice(0, UP_NEXT_DISPLAY_LIMIT)
  const onDeckHiddenCount = queueState.onDeck.length - onDeckVisible.length
  const waitingVisible = queueState.waiting.slice(0, UP_NEXT_DISPLAY_LIMIT)
  const waitingHiddenCount = queueState.waiting.length - waitingVisible.length
  const playingCount = queueState.tables.filter((slot) => slot.match).length

  const queuePanelTabs = QUEUE_PANEL_TABS.map((tab) => ({
    ...tab,
    pendingCount:
      tab.id === 'playing'
        ? playingCount
        : tab.id === 'up-next'
          ? queueState.upNext.length + queueState.onDeck.length
          : queueState.waiting.length,
  }))

  return (
    <div className="space-y-4">
      <StatusPopups error={error} onErrorDismiss={() => setError('')} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <PanelSectionTitle>Match queue</PanelSectionTitle>
          {phaseLabel && (
            <CaptionText>
              {phaseLabel} · {tableCount} table{tableCount === 1 ? '' : 's'} available
            </CaptionText>
          )}
        </div>
        <TagPill>{pendingCount} pending</TagPill>
      </div>

      <TextInput
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Find your match"
        aria-label="Search queue by player name"
        autoComplete="off"
      />

      {playerStatus && <PlayerStatusCard status={playerStatus} />}

      <GroupStageNavigator
        tabs={queuePanelTabs}
        activeId={queuePanelTab}
        onChange={(id) => setQueuePanelTab(id as QueuePanelTab)}
      />

      {queuePanelTab === 'playing' && (
        <section className="space-y-3">
          <div className={tableGridClass(tableCount)}>
            {queueState.tables.map((slot) => (
              <div
                key={slot.tableNumber}
                className="rounded-[14px] bg-card ring-1 ring-border p-4 space-y-3 flex flex-col"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-semibold text-text-primary">{slot.label}</span>
                  {slot.match ? (
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                        slot.match.calledAt ? 'bg-live-bg text-live-text' : 'bg-green-soft text-winner'
                      }`}
                    >
                      {slot.match.calledAt ? 'Called' : 'On court'}
                    </span>
                  ) : (
                    <TagPill>Free</TagPill>
                  )}
                </div>

                {slot.match ? (
                  <>
                    <Court key={slot.match.matchId} match={slot.match} animate={armed} />
                    {matchStageLabel(slot.match) && (
                      <p className="text-[13px] text-text-steel">{matchStageLabel(slot.match)}</p>
                    )}
                    {admin && (
                      <Button
                        type="button"
                        disabled={saving}
                        onClick={() => openScoreDialog(slot.match!, slot.tableNumber)}
                        fullWidth
                        className="mt-auto"
                      >
                        Enter score
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="grid place-items-center min-h-[108px] rounded-[10px] bg-court-idle px-4 text-center">
                      <p className="text-sm text-text-steel">
                        {slot.nextMatch
                          ? 'Waiting for the next match'
                          : 'No match queued for this table.'}
                      </p>
                    </div>
                    {slot.nextMatch && (
                      <div className="space-y-1">
                        <p className="text-xs text-text-faint">Next up</p>
                        <MatchRow match={slot.nextMatch} hideTableBadge />
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {queuePanelTab === 'up-next' && (
        <div className="space-y-5">
          {upNextVisible.length > 0 ? (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-faint">Up next</p>
                {upNextHiddenCount > 0 && (
                  <span className="text-xs text-text-steel">+{upNextHiddenCount} more in queue</span>
                )}
              </div>
              <ul className="rounded-[14px] bg-card ring-1 ring-border divide-y divide-border">
                {upNextVisible.map((m) => (
                  <li key={m.matchId} className="px-4 py-3">
                    <MatchRow match={m} />
                  </li>
                ))}
              </ul>
            </section>
          ) : queueState.onDeck.length === 0 ? (
            <EmptyMessage>No matches waiting for a table.</EmptyMessage>
          ) : null}

          {onDeckVisible.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-faint">On deck (rest)</p>
                {onDeckHiddenCount > 0 && (
                  <span className="text-xs text-text-steel">+{onDeckHiddenCount} more on deck</span>
                )}
              </div>
              <ul className="rounded-[14px] bg-card ring-1 ring-border divide-y divide-border">
                {onDeckVisible.map((m) => (
                  <li key={m.matchId} className="px-4 py-3">
                    <MatchRow match={m} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {queuePanelTab === 'waiting' && (
        <>
          {waitingVisible.length > 0 ? (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-faint">Waiting</p>
                {waitingHiddenCount > 0 && (
                  <span className="text-xs text-text-steel">+{waitingHiddenCount} more waiting</span>
                )}
              </div>
              <ul className="rounded-[14px] bg-card ring-1 ring-border divide-y divide-border">
                {waitingVisible.map((e) => (
                  <li key={e.entryId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="font-medium text-text-primary truncate">{e.name}</span>
                    <TagPill>{e.reason}</TagPill>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <EmptyMessage>No players waiting.</EmptyMessage>
          )}
        </>
      )}

      {admin && event && (
        <MatchScoreDialog
          open={!!scoreTarget && !!scoreDialogMatch}
          eventType={event.event_type}
          config={event.config}
          match={scoreDialogMatch}
          stage={scoreDialogStage}
          onClose={() => setScoreTarget(null)}
          onSave={handleSaveScore}
        />
      )}

      <QueueAnnouncementDialog
        open={announcementOpen}
        announcement={announcement}
        title={admin ? 'Score saved' : 'Match finished'}
        onClose={() => setAnnouncementOpen(false)}
      />
    </div>
  )
}
