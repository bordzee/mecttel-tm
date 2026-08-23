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
import { useMinLoading } from '../hooks/useMinLoading'
import { useRealtimeEvent } from '../hooks/useRealtimeEvent'
import {
  assignMatchTable,
  callMatchToTable,
  clearMatchTableCall,
  fetchEntries,
  fetchEvent,
  fetchGroupMatches,
  fetchGroups,
  fetchKnockoutMatches,
} from '../lib/tournamentService'
import { buildEventMatchQueue } from '../lib/matchQueue'
import { buildEventQueueState, filterQueueByName } from '../lib/tableAssignment'
import { formatTableLabel, normalizeTableCount } from '../lib/tableLabels'
import type { QueueMatchView } from '../lib/matchQueue'
import type { TournamentEvent } from '../types'

function matchStageLabel(m: QueueMatchView): string {
  if (m.stage === 'group' && m.groupLabel) return `Group ${m.groupLabel}`
  if (m.stage === 'knockout' && m.round) return m.round.replace('_', ' ').toUpperCase()
  return ''
}

function tableBadge(m: QueueMatchView): string {
  const n = m.tableLocked ? m.assignedTable : m.estimatedTable
  if (n == null) return ''
  return m.tableLocked ? formatTableLabel(n) : `Est. ${formatTableLabel(n)}`
}

function MatchRow({
  match,
  highlight,
}: {
  match: QueueMatchView
  highlight?: boolean
}) {
  const badge = tableBadge(match)
  return (
    <div className={`text-sm ${highlight ? 'text-text-primary' : 'text-text-bluewhite'}`}>
      <p className={`font-bold ${highlight ? 'text-text-primary' : ''}`}>
        {match.homeName} vs {match.awayName}
      </p>
      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
        {matchStageLabel(match) && (
          <span className="text-xs text-text-steel">{matchStageLabel(match)}</span>
        )}
        {badge && <TagPill>{badge}</TagPill>}
        {match.calledAt && <TagPill>Called</TagPill>}
        {match.restReason && (
          <span className="text-xs text-amber">{match.restReason}</span>
        )}
      </div>
    </div>
  )
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
  const [groupMatches, setGroupMatches] = useState<Awaited<ReturnType<typeof fetchGroupMatches>>>([])
  const [knockoutMatches, setKnockoutMatches] = useState<Awaited<ReturnType<typeof fetchKnockoutMatches>>>([])
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof fetchEntries>>>([])
  const [loading, setLoading] = useState(true)
  const showSkeleton = useMinLoading(loading)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [acting, setActing] = useState<string | null>(null)

  const fetchEventData = useCallback(async () => {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue')
    }
  }, [tournamentId, eventId])

  useEffect(() => {
    setLoading(true)
    fetchEventData().finally(() => setLoading(false))
  }, [fetchEventData])

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

  const pendingCount = groupMatches.filter((m) => m.status !== 'completed').length +
    knockoutMatches.filter(
      (m) =>
        m.status !== 'completed' &&
        !!m.entry_a_id &&
        !!m.entry_b_id &&
        m.outcome !== 'bye',
    ).length

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setActing(key)
    try {
      await fn()
      await fetchEventData()
      await onRefresh?.()
      setMessage('Queue updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActing(null)
    }
  }

  const handleCall = (match: QueueMatchView, tableNumber: number) =>
    runAction(`call-${match.matchId}`, () =>
      callMatchToTable(match.stage, match.matchId, tableNumber),
    )

  const handleAssign = (match: QueueMatchView, tableNumber: number) =>
    runAction(`assign-${match.matchId}`, () =>
      assignMatchTable(match.stage, match.matchId, tableNumber),
    )

  const handleClearCall = (match: QueueMatchView) =>
    runAction(`clear-${match.matchId}`, () =>
      clearMatchTableCall(match.stage, match.matchId),
    )

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
        <StatusPopups
          success={message}
          error={error}
          onSuccessDismiss={() => setMessage('')}
          onErrorDismiss={() => setError('')}
        />
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
      <StatusPopups
        success={message}
        error={error}
        onSuccessDismiss={() => setMessage('')}
        onErrorDismiss={() => setError('')}
      />

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
        <div className="grid gap-3 sm:grid-cols-2">
          {queueState.tables.map((slot) => (
            <div
              key={slot.tableNumber}
              className={`rounded-xl border p-3.5 space-y-2 ${
                slot.status === 'called'
                  ? 'border-brand-500 bg-brand-500/15'
                  : slot.match
                    ? 'border-brand-500/40 bg-brand-500/10'
                    : 'border-border bg-card-raised'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-text-primary">{slot.label}</span>
                {slot.status === 'called' && <TagPill>Called</TagPill>}
                {slot.status === 'now' && slot.match && !slot.match.calledAt && (
                  <TagPill>Now</TagPill>
                )}
                {slot.status === 'idle' && (
                  <span className="text-xs text-text-steel">Idle</span>
                )}
              </div>

              {slot.match ? (
                <>
                  <MatchRow match={slot.match} highlight />
                  {admin && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {!slot.match.calledAt && (
                        <Button
                          type="button"
                          disabled={!!acting}
                          onClick={() => handleCall(slot.match!, slot.tableNumber)}
                        >
                          Call to {slot.label}
                        </Button>
                      )}
                      {slot.match.calledAt && (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={!!acting}
                          onClick={() => handleClearCall(slot.match!)}
                        >
                          Clear call
                        </Button>
                      )}
                    </div>
                  )}
                </>
              ) : slot.nextMatch ? (
                <div className="space-y-1">
                  <p className="text-xs text-text-steel">Next up</p>
                  <MatchRow match={slot.nextMatch} />
                </div>
              ) : (
                <p className="text-sm text-text-steel">No match queued for this table.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {queueState.upNext.length > 0 && (
        <section className="rounded-2xl border border-border-strong bg-card p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-300">Up next</p>
          <ul className="space-y-3">
            {queueState.upNext.map((m) => (
              <li key={m.matchId} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <MatchRow match={m} />
                {admin && (
                  <div className="flex flex-wrap gap-1 shrink-0">
                    {Array.from({ length: tableCount }, (_, i) => i + 1).map((n) => (
                      <Button
                        key={n}
                        type="button"
                        variant="secondary"
                        disabled={!!acting}
                        onClick={() => handleAssign(m, n)}
                      >
                        {formatTableLabel(n)}
                      </Button>
                    ))}
                  </div>
                )}
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
    </div>
  )
}
