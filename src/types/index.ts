export type EventType = 'team' | 'single' | 'doubles' | 'executive'
export type TournamentStatus = 'draft' | 'upcoming' | 'ongoing' | 'ended'
export type Category = 'u12' | 'u16' | 'u18' | 'open'
export type TeamFormat = 'SSS' | 'SDS' | 'SSDSS'
export type MatchOutcome = 'normal' | 'forfeit' | 'no_show' | 'dq' | 'bye'
export type KnockoutRound =
  | 'r128'
  | 'r64'
  | 'r32'
  | 'r16'
  | 'quarter'
  | 'semi'
  | 'third_place'
  | 'final'
export type EntryType = 'team' | 'player' | 'pair'
export type RubberResult = 'W' | 'L' | null

export interface SetRules {
  group: 3 | 5 | 7
  knockout_early: 3 | 5 | 7
  quarters: 3 | 5 | 7
  semis: 3 | 5 | 7
  finals: 5 | 7
}

export type KnockoutBracketType = 'cross' | 'block'

export interface TournamentConfig {
  /** Legacy divisions only; omit for unlimited registration. */
  total_slots?: number
  entries_per_group?: number
  group_count?: number
  /** Per-group sizes when entry count does not divide evenly (e.g. [4,4,4,5] for 17). */
  group_sizes?: number[]
  advance_count: number
  knockout_bracket?: KnockoutBracketType
  team_format?: TeamFormat
  roster_size?: 3 | 4
  set_rules: SetRules
  category_label?: string
}

/** Meet-level container (e.g. "bizdak"). */
export interface Tournament {
  id: string
  name: string
  venue: string | null
  start_date: string | null
  created_at: string
  /** True when at least one division is upcoming or ongoing (public listing). */
  public_visible?: boolean
  /** Cover image URL (Firebase Storage). */
  image_url?: string | null
}

/** A division/category inside a tournament (e.g. Singles – U12). */
export interface TournamentEvent {
  id: string
  tournament_id: string
  name: string
  event_type: EventType
  category: Category | null
  status: TournamentStatus
  config: TournamentConfig
  sort_order: number
  created_at: string
}

export interface Team {
  id: string
  tournament_id: string
  event_id: string
  name: string
  organization: string | null
  seeded: boolean | null
}

export interface TeamPlayer {
  id: string
  team_id: string
  name: string
}

export interface Player {
  id: string
  tournament_id: string
  event_id: string
  name: string
  organization: string | null
  seeded: boolean | null
}

export interface Pair {
  id: string
  tournament_id: string
  event_id: string
  pair_name: string | null
  player_a: string
  player_b: string
  organization: string | null
  seeded: boolean | null
}

export interface TournamentEntry {
  id: string
  tournament_id: string
  event_id: string
  entry_type: EntryType
  team_id: string | null
  player_id: string | null
  pair_id: string | null
  seeded: boolean | null
  team?: Team | null
  player?: Player | null
  pair?: Pair | null
}

export interface Group {
  id: string
  tournament_id: string
  event_id: string
  label: string
  /** Admin-set finish order (entry IDs: rank 1 first). Overrides computed tie-breaks. */
  manual_rank_order?: string[] | null
  /** Shown to viewers when ranks were set manually (e.g. head-to-head on paper). */
  manual_rank_note?: string | null
}

export interface GroupMember {
  id: string
  group_id: string
  entry_id: string
  entry?: TournamentEntry
}

export interface RubberResults {
  home: RubberResult[]
}

export interface GroupMatch {
  id: string
  tournament_id: string
  event_id: string
  group_id: string
  entry_a_id: string
  entry_b_id: string
  score_a: number | null
  score_b: number | null
  rubber_results: RubberResults | null
  winner_entry_id: string | null
  status: 'scheduled' | 'completed'
  outcome: MatchOutcome
  entry_a?: TournamentEntry
  entry_b?: TournamentEntry
}

export interface KnockoutMatch {
  id: string
  tournament_id: string
  event_id: string
  round: KnockoutRound
  /** Knockout wave (0 = first round after groups). Later rounds are generated when the prior wave completes. */
  stage_index?: number
  slot: number
  bracket_side: 'left' | 'right'
  entry_a_id: string | null
  entry_b_id: string | null
  score_a: number | null
  score_b: number | null
  rubber_results: RubberResults | null
  winner_entry_id: string | null
  source_match_a_id: string | null
  source_match_b_id: string | null
  /** When `loser`, entries come from the non-winning side of each source match (3rd-place match). */
  source_feeder?: 'winner' | 'loser'
  status: 'scheduled' | 'completed' | 'pending'
  outcome: MatchOutcome
  /** Play-in among non-bye winners when an odd feeder count is resolved. */
  is_odd_play_in?: boolean
  pending_odd_round?: boolean
  feeder_source_match_ids?: string[]
  entry_a?: TournamentEntry | null
  entry_b?: TournamentEntry | null
}

export interface StandingRow {
  entryId: string
  name: string
  played: number
  wins: number
  losses: number
  scoreFor: number
  scoreAgainst: number
  diff: number
  rank: number
  /** True when entry is seeded in this division. */
  seeded?: boolean
  /** True when rank comes from admin manual order, not auto tie-break. */
  rankOverridden?: boolean
}

export interface GroupLayoutOption {
  entriesPerGroup: number
  groupCount: number
}

export interface Profile {
  id: string
  role: 'admin'
}
