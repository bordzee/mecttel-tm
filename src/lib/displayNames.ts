import type { Category, EventType, TournamentEntry, TournamentEvent } from '../types'
import { CATEGORY_LABELS, EVENT_TYPE_LABELS } from './constants'

export function getEntryDisplayName(entry: TournamentEntry): string {
  if (entry.entry_type === 'team' && entry.team) return entry.team.name
  if (entry.entry_type === 'player' && entry.player) return entry.player.name
  if (entry.entry_type === 'pair' && entry.pair) {
    if (entry.pair.pair_name) return entry.pair.pair_name
    return `${entry.pair.player_a} / ${entry.pair.player_b}`
  }
  return 'Entry unavailable'
}

export function getCategoryDisplay(
  category: string | null,
  categoryLabel?: string,
): string {
  if (categoryLabel) return categoryLabel
  if (!category) return ''
  return CATEGORY_LABELS[category as Category] ?? category
}

/** Auto-generate a division label from type + category. */
export function buildEventName(
  eventType: EventType,
  category: Category | null,
  categoryLabel?: string,
): string {
  const typeLabel = EVENT_TYPE_LABELS[eventType]
  if (eventType === 'team' || eventType === 'executive') {
    if (categoryLabel) return categoryLabel
    return typeLabel
  }
  const cat = getCategoryDisplay(category, categoryLabel)
  return cat ? `${typeLabel} – ${cat}` : typeLabel
}

export function getEventDisplayName(event: Pick<TournamentEvent, 'name' | 'event_type' | 'category' | 'config'>) {
  if (event.name) return event.name
  return buildEventName(event.event_type, event.category, event.config.category_label)
}

export function isPlayerEventType(eventType: EventType): boolean {
  return eventType === 'single' || eventType === 'executive'
}

export function hasCategoryPicker(eventType: EventType): boolean {
  return eventType === 'single' || eventType === 'doubles' || eventType === 'executive'
}
