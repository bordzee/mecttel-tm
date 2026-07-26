import type { Category, EventType, TeamFormat } from '../types'

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  team: 'Team',
  single: 'Singles',
  doubles: 'Doubles',
  executive: 'Executive',
}

export const CATEGORY_LABELS: Record<Category, string> = {
  u12: 'Under 12',
  u16: 'Under 16',
  u18: 'Under 18',
  open: 'Open',
}

export const RUBBER_SLOT_LABELS: Record<TeamFormat, string[]> = {
  SSS: ['1st Single', '2nd Single', '3rd Single'],
  SDS: ['1st Single', 'Doubles', '3rd Single'],
  SSDSS: ['1st Single', '2nd Single', 'Doubles', '4th Single', '5th Single'],
}

export const WIN_THRESHOLD: Record<TeamFormat, number> = {
  SSS: 2,
  SDS: 2,
  SSDSS: 3,
}

export const DEFAULT_SET_RULES = {
  group: 3 as const,
  knockout_early: 3 as const,
  quarters: 5 as const,
  semis: 5 as const,
  finals: 5 as const,
}

export const STATUS_LABELS = {
  draft: 'Draft',
  upcoming: 'Upcoming',
  ongoing: 'Ongoing',
  ended: 'Ended',
}

export const ROUND_LABELS = {
  quarter: 'Quarterfinal',
  semi: 'Semifinal',
  final: 'Final',
}
