import { formatTableLabel, normalizeTableCount } from './tableLabels'
import type { EntryWaitView, QueueMatchView } from './matchQueue'

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

  const next = slot.match ?? slot.nextMatch
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
  const assignedIds = new Set<string>()

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

  for (const slot of tables) {
    const locked = ordered.find(
      (m) =>
        m.tableLocked &&
        m.assignedTable === slot.tableNumber &&
        m.playable,
    )
    if (!locked) continue

    assignedIds.add(locked.matchId)
    slot.match = locked
    slot.status = locked.calledAt ? 'called' : 'now'
  }

  const unassignedPlayable = ordered.filter(
    (m) => m.playable && !assignedIds.has(m.matchId),
  )

  for (const slot of tables) {
    if (slot.match) continue
    const next = unassignedPlayable.shift()
    if (!next) continue

    assignedIds.add(next.matchId)
    slot.match = cloneWithTable(next, slot.tableNumber, false)
    slot.status = 'now'
  }

  for (const slot of tables) {
    if (slot.match || unassignedPlayable.length === 0) continue
    slot.nextMatch = cloneWithTable(unassignedPlayable[0]!, slot.tableNumber, false)
  }

  const onTableIds = new Set(
    tables.flatMap((t) => (t.match ? [t.match.matchId] : [])),
  )

  const enrichedOrdered = ordered.map((m) => {
    const tableSlot = tables.find((t) => t.match?.matchId === m.matchId)
    if (tableSlot?.match) return tableSlot.match
    const waitingSlot = tables.find((t) => t.nextMatch?.matchId === m.matchId)
    if (waitingSlot?.nextMatch?.matchId === m.matchId) {
      return waitingSlot.nextMatch
    }
    return m
  })

  const upNext = enrichedOrdered.filter(
    (m) => m.playable && !onTableIds.has(m.matchId),
  ).slice(0, 6)

  const onDeck = enrichedOrdered.filter((m) => !m.playable)
  const waiting = entryWait.filter(
    (e) => e.matchesUntilTurn > 0 || e.reason.includes('rest'),
  )

  return {
    tables,
    upNext,
    onDeck,
    waiting,
    ordered: enrichedOrdered,
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

  const tables = state.tables.map((slot) => ({
    ...slot,
    match: slot.match && matchesSearch(slot.match) ? slot.match : null,
    nextMatch: slot.nextMatch && matchesSearch(slot.nextMatch) ? slot.nextMatch : null,
  }))

  return {
    ...state,
    tables,
    upNext: state.upNext.filter(matchesSearch),
    onDeck: state.onDeck.filter(matchesSearch),
    waiting: state.waiting.filter((e) => e.name.toLowerCase().includes(q)),
    ordered: state.ordered.filter(matchesSearch),
  }
}
