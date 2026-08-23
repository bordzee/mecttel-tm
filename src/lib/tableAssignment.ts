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

  if (!next.playable && next.restReason) {
    return {
      tableNumber,
      label,
      nextMatch: next,
      waitingForRest: true,
      restReason: next.restReason,
      noMoreMatches: false,
    }
  }

  return {
    tableNumber,
    label,
    nextMatch: next,
    waitingForRest: false,
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
      (m) =>
        m.playable &&
        m.assignedTable === slot.tableNumber &&
        !placedIds.has(m.matchId),
    )
    if (!onTable) continue

    placedIds.add(onTable.matchId)
    slot.match = onTable
    slot.status = onTable.calledAt ? 'called' : 'now'
  }

  // Fill vacant tables from the global FIFO queue (first waiting match first).
  const fifo = ordered.filter((m) => m.playable && !placedIds.has(m.matchId))
  for (const slot of tables) {
    if (slot.match) continue
    const next = fifo.shift()
    if (!next) continue

    placedIds.add(next.matchId)
    slot.match = cloneWithTable(next, slot.tableNumber, next.tableLocked)
    slot.status = 'now'
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

  const onDeck = ordered.filter((m) => !m.playable)
  const waiting = entryWait.filter(
    (e) => e.matchesUntilTurn > 0 || e.reason.includes('rest'),
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
