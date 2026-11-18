import { formatTableLabel, normalizeTableCount } from './tableLabels'
import type { EntryWaitView, QueueMatchView } from './matchQueue'

/** Max matches shown in the Up next panel (full queue still drives table assignment). */
export const UP_NEXT_DISPLAY_LIMIT = 10

export type TableSlotStatus = 'idle' | 'now' | 'called'

export interface TableSlotView {
  tableNumber: number
  label: string
  status: TableSlotStatus
  match: QueueMatchView | null
  /** When idle, the next match expected on this table (estimated). */
  nextMatch: QueueMatchView | null
}

export interface EventQueueState {
  tables: TableSlotView[]
  upNext: QueueMatchView[]
  onDeck: QueueMatchView[]
  waiting: EntryWaitView[]
  ordered: QueueMatchView[]
}

export interface TableAnnouncement {
  tableNumber: number
  label: string
  nextMatch: QueueMatchView | null
  waitingForRest: boolean
  restReason?: string
  /** The match was put on the table even though a player is still within the rest rule (nothing else could be played). */
  restWaived?: boolean
  noMoreMatches: boolean
}

export function getTableAnnouncement(
  tableNumber: number,
  state: EventQueueState,
): TableAnnouncement {
  const label = formatTableLabel(tableNumber)
  const slot = state.tables.find((t) => t.tableNumber === tableNumber)
  if (!slot) {
    return { tableNumber, label, nextMatch: null, waitingForRest: false, noMoreMatches: true }
  }

  const next = slot.match ?? slot.nextMatch ?? state.upNext[0] ?? null
  if (!next) {
    return { tableNumber, label, nextMatch: null, waitingForRest: false, noMoreMatches: true }
  }

  // A match already sitting at the table is called even if rest was waived to keep the stage moving.
  if (!slot.match && !next.playable && next.restReason) {
    return {
      tableNumber,
      label,
      nextMatch: next,
      waitingForRest: true,
      restReason: next.restReason,
      noMoreMatches: false,
    }
  }

  const restWaived = Boolean(slot.match && !slot.match.playable && slot.match.restReason)
  return {
    tableNumber,
    label,
    nextMatch: next,
    waitingForRest: false,
    restWaived,
    restReason: restWaived ? slot.match?.restReason : undefined,
    noMoreMatches: false,
  }
}

function cloneWithTable(
  match: QueueMatchView,
  tableNumber: number,
  locked: boolean,
): QueueMatchView {
  return {
    ...match,
    assignedTable: locked ? tableNumber : match.assignedTable,
    estimatedTable: locked ? null : tableNumber,
    tableLocked: locked || match.tableLocked,
  }
}

export function buildEventQueueState(
  ordered: QueueMatchView[],
  entryWait: EntryWaitView[],
  tableCountInput: number | undefined,
): EventQueueState {
  const tableCount = normalizeTableCount(tableCountInput)
  const placedIds = new Set<string>()
  // Entries already at a table: nobody can be in two matches at once.
  const busyEntries = new Set<string>()
  const isFree = (m: QueueMatchView) =>
    !placedIds.has(m.matchId) && !busyEntries.has(m.entryAId) && !busyEntries.has(m.entryBId)
  const markPlaced = (m: QueueMatchView) => {
    placedIds.add(m.matchId)
    busyEntries.add(m.entryAId)
    busyEntries.add(m.entryBId)
  }

  const tables: TableSlotView[] = Array.from({ length: tableCount }, (_, i) => {
    const tableNumber = i + 1
    return {
      tableNumber,
      label: formatTableLabel(tableNumber),
      status: 'idle' as TableSlotStatus,
      match: null,
      nextMatch: null,
    }
  })

  // Keep persisted table assignments (admin entered score / assigned table).
  for (const slot of tables) {
    const onTable = ordered.find(
      (m) => m.playable && m.assignedTable === slot.tableNumber && isFree(m),
    )
    if (!onTable) continue

    markPlaced(onTable)
    slot.match = onTable
    slot.status = onTable.calledAt ? 'called' : 'now'
  }

  // Fill vacant tables from the global FIFO queue (first waiting match first),
  // skipping any match that includes a player who is already at another table.
  const fifo = ordered.filter((m) => m.playable)
  for (const slot of tables) {
    if (slot.match) continue
    const next = fifo.find(isFree)
    if (!next) continue

    markPlaced(next)
    slot.match = cloneWithTable(next, slot.tableNumber, next.tableLocked)
    slot.status = 'now'
  }

  // Resting is a courtesy, not a lock. If nothing is playing and every match left
  // involves a resting player (for example a late entrant who still has several
  // matches to play and nobody to interleave with), the stage could never finish.
  // In that case the first such match goes ahead.
  if (!tables.some((t) => t.match)) {
    for (const slot of tables) {
      const next = ordered.find(isFree)
      if (!next) break
      markPlaced(next)
      slot.match = cloneWithTable(next, slot.tableNumber, next.tableLocked)
      slot.status = 'now'
    }
  }

  const onTableIds = new Set(
    tables.flatMap((t) => (t.match ? [t.match.matchId] : [])),
  )

  const waitingFifo = ordered.filter(
    (m) => m.playable && !onTableIds.has(m.matchId),
  )

  for (const slot of tables) {
    if (slot.match || waitingFifo.length === 0) continue
    slot.nextMatch = cloneWithTable(waitingFifo[0]!, slot.tableNumber, false)
  }

  const upNext = waitingFifo

  const onDeck = ordered.filter((m) => !m.playable && !onTableIds.has(m.matchId))
  // Someone who is on a table right now is playing, not waiting.
  const waiting = entryWait.filter(
    (e) => !busyEntries.has(e.entryId) && (e.matchesUntilTurn > 0 || e.reason.includes('rest')),
  )

  return {
    tables,
    upNext,
    onDeck,
    waiting,
    ordered,
  }
}

export function filterQueueByName(
  state: EventQueueState,
  query: string,
): EventQueueState {
  const q = query.trim().toLowerCase()
  if (!q) return state

  const matchesSearch = (m: QueueMatchView) =>
    m.homeName.toLowerCase().includes(q) || m.awayName.toLowerCase().includes(q)

  return {
    ...state,
    tables: state.tables,
    upNext: state.upNext.filter(matchesSearch),
    onDeck: state.onDeck.filter(matchesSearch),
    waiting: state.waiting.filter((e) => e.name.toLowerCase().includes(q)),
    ordered: state.ordered.filter(matchesSearch),
  }
}

/** Rough minutes per match, used only for the "about N min" estimate shown to players. */
export const ESTIMATED_MATCH_MINUTES = 12

export interface PlayerStatus {
  name: string
  kind: 'playing' | 'called' | 'resting' | 'up-next' | 'waiting' | 'none'
  title: string
  detail: string
}

/**
 * Answers "when do I play?" for a search query. Returns null unless the query
 * (2+ characters) identifies exactly one player in the current queue.
 */
export function findPlayerStatus(
  state: EventQueueState,
  query: string,
  tableCount: number,
): PlayerStatus | null {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return null

  const names = new Map<string, string>()
  for (const m of state.ordered) {
    names.set(m.entryAId, m.homeName)
    names.set(m.entryBId, m.awayName)
  }
  const found = [...names.entries()].filter(([, name]) => name.toLowerCase().includes(q))
  if (found.length !== 1) return null
  const [entryId, name] = found[0]!

  const involves = (m: QueueMatchView) => m.entryAId === entryId || m.entryBId === entryId
  const opponent = (m: QueueMatchView) => (m.entryAId === entryId ? m.awayName : m.homeName)

  const slot = state.tables.find((t) => t.match && involves(t.match))
  if (slot?.match) {
    const called = !!slot.match.calledAt
    return {
      name,
      kind: called ? 'called' : 'playing',
      title: called ? `Go to ${slot.label} now` : `On ${slot.label}`,
      detail: `vs ${opponent(slot.match)}`,
    }
  }

  const onTableIds = new Set(state.tables.flatMap((t) => (t.match ? [t.match.matchId] : [])))
  const waiting = state.ordered.filter((m) => !onTableIds.has(m.matchId))
  const idx = waiting.findIndex(involves)
  if (idx < 0) {
    return { name, kind: 'none', title: 'No matches left', detail: 'Nothing more is queued in this stage.' }
  }

  const next = waiting[idx]!
  if (!next.playable && next.restReason) {
    return { name, kind: 'resting', title: 'Resting for one match', detail: `Next: vs ${opponent(next)}` }
  }
  if (idx === 0) {
    return { name, kind: 'up-next', title: 'You are up next', detail: `Next: vs ${opponent(next)}` }
  }
  const minutes = Math.max(5, Math.ceil(idx / Math.max(1, tableCount)) * ESTIMATED_MATCH_MINUTES)
  return {
    name,
    kind: 'waiting',
    title: `${idx} match${idx === 1 ? '' : 'es'} before yours`,
    detail: `Next: vs ${opponent(next)} · about ${minutes} min (estimate)`,
  }
}
