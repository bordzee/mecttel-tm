import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { MatchScoreDialog } from './MatchScoreDialog'
import { QueueAnnouncementDialog } from './QueueAnnouncementDialog'
import { useMinLoading } from '../hooks/useMinLoading'
import { useRealtimeEvent } from '../hooks/useRealtimeEvent'
import {
  assignMatchTable,
  fetchEntries,
  fetchEvent,
  fetchGroupMatches,
  fetchGroups,
  fetchKnockoutMatches,
  saveGroupMatchResult,
  saveKnockoutMatchResult,
} from '../lib/tournamentService'
import { buildEventMatchQueue } from '../lib/matchQueue'
import {
  buildEventQueueState,
  filterQueueByName,
  getTableAnnouncement,
  type TableAnnouncement,
} from '../lib/tableAssignment'
import { normalizeTableCount } from '../lib/tableLabels'
import { setRulesStageForRound } from '../lib/knockoutRounds'
import { matchEffectiveRound } from '../lib/knockoutTabs'
import type { QueueMatchView } from '../lib/matchQueue'
import type { GroupMatch, KnockoutMatch, TournamentEvent } from '../types'

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
    <div className={`text-sm ${highlight ? 'text-text-primary' : 'text-text-bluewhite'}`}>
      <p className={`font-bold ${highlight ? 'text-text-primary' : ''}`}>
        {match.homeName} vs {match.awayName}
      </p>
      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
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

type ScoreTarget = {
  queueMatch: QueueMatchView
  tableNumber: number
}

function tableGridClass(tableCount: number): string {
  if (tableCount >= 3) return 'grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
  if (tableCount === 2) return 'grid gap-3 grid-cols-1 sm:grid-cols-2'
  return 'grid gap-3 grid-cols-1'
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
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof fetchEntries>>>([])
  const [loading, setLoading] = useState(true)
  const showSkeleton = useMinLoading(loading)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [scoreTarget, setScoreTarget] = useState<ScoreTarget | null>(null)
  const [announcement, setAnnouncement] = useState<TableAnnouncement | null>(null)
  const [announcementOpen, setAnnouncementOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadQueueData = useCallback(async () => {
    try {
      const [ev, g, gm, km, e] = await Promise.all([
        fetchEvent(tournamentId, eventId),
        fetchGroups(tournamentId, eventId),
        fetchGroupMatches(tournamentId, eventId),
        fetchKnockoutMatches(tournamentId, eventId),
        fetchEntries(tournamentId, eventId),
      ])
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
    loadQueueData().finally(() => setLoading(false))
  }, [loadQueueData])

  useRealtimeEvent(tournamentId, eventId, fetchEventData, (msg) => setError(msg))

  const entryMap = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries])

  const queueBundle = useMemo(() => {
    return buildEventMatchQueue({ groups, groupMatches, knockoutMatches, entryMap })
  }, [groups, groupMatches, knockoutMatches, entryMap])

  const tableCount = normalizeTableCount(event?.config.table_count)

  const queueState = useMemo(() => {
    const base = buildEventQueueState(queueBundle.ordered, queueBundle.entryWait, tableCount)
    return filterQueueByName(base, search)
  }, [queueBundle, tableCount, search])

  const pendingCount =
    groupMatches.filter((m) => m.status !== 'completed').length +
    knockoutMatches.filter(
      (m) =>
        m.status !== 'completed' &&
        !!m.entry_a_id &&
        !!m.entry_b_id &&
        m.outcome !== 'bye',
    ).length

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
        const km = knockoutMatches.find((m) => m.id === queueMatch.matchId)
        if (!km) throw new Error('Match not found')
        const stage = setRulesStageForRound(matchEffectiveRound(km, knockoutMatches))
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
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search your name…"
        aria-label="Search queue by player name"
      />

      <section className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-text-steel">Now on tables</p>
        <div className={tableGridClass(tableCount)}>
          {queueState.tables.map((slot) => (
            <div
              key={slot.tableNumber}
              className={`rounded-xl border p-3.5 space-y-3 min-h-[120px] flex flex-col ${
                slot.match
                  ? 'border-brand-500/40 bg-brand-500/10'
                  : 'border-border bg-card-raised'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-text-primary">{slot.label}</span>
                {slot.match ? (
                  <TagPill>Now</TagPill>
                ) : (
                  <span className="text-xs text-text-steel">Idle</span>
                )}
              </div>

              {slot.match ? (
                <>
                  <MatchRow match={slot.match} highlight hideTableBadge />
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
              ) : slot.nextMatch ? (
                <div className="space-y-1 mt-auto">
                  <p className="text-xs text-text-steel">Next up</p>
                  <MatchRow match={slot.nextMatch} hideTableBadge />
                </div>
              ) : (
                <p className="text-sm text-text-steel mt-auto">No match queued for this table.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {queueState.upNext.length > 0 && (
        <section className="rounded-2xl border border-border-strong bg-card p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-300">Up next</p>
          <ul className="space-y-2">
            {queueState.upNext.map((m) => (
              <li key={m.matchId}>
                <MatchRow match={m} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {queueState.onDeck.length > 0 && (
        <section className="rounded-2xl border border-border bg-card-raised p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-text-steel">On deck (rest)</p>
          <ul className="space-y-2">
            {queueState.onDeck.slice(0, 6).map((m) => (
              <li key={m.matchId}>
                <MatchRow match={m} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {queueState.waiting.length > 0 && (
        <section className="rounded-2xl border border-border bg-navy/40 p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-text-steel">Waiting</p>
          <ul className="space-y-1.5">
            {queueState.waiting.slice(0, 10).map((e) => (
              <li key={e.entryId} className="flex items-start justify-between gap-2 text-sm">
                <span className="font-semibold text-text-bluewhite truncate">{e.name}</span>
                <TagPill>{e.reason}</TagPill>
              </li>
            ))}
          </ul>
        </section>
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

      {admin && (
        <QueueAnnouncementDialog
          open={announcementOpen}
          announcement={announcement}
          onClose={() => setAnnouncementOpen(false)}
        />
      )}
    </div>
  )
}
