import { DEFAULT_SET_RULES } from '../lib/constants'
import { MAX_PER_GROUP } from '../lib/groupLayout'
import { buildEventName, hasCategoryPicker } from '../lib/displayNames'
import {
  FormLabel,
  NumberStepper,
  RemoveRowButton,
  SegmentedControl,
  TagPill,
  TextInput,
} from './ui/primitives'
import { SetRulesPicker, normalizeSetRules } from './SetRulesPicker'
import type { Category, EventType, KnockoutBracketType, TeamFormat, TournamentConfig, TournamentEvent } from '../types'

export interface DivisionDraft {
  clientId: string
  event_type: EventType
  category: Category
  custom_name: string
  advance_count: number
  knockout_bracket: KnockoutBracketType
  team_format: TeamFormat
  roster_size: 3 | 4
  set_rules: TournamentConfig['set_rules']
}

export function createDivisionDraft(partial?: Partial<DivisionDraft>): DivisionDraft {
  const { set_rules: partialRules, ...rest } = partial ?? {}
  return {
    clientId: crypto.randomUUID(),
    event_type: 'single',
    category: 'open',
    custom_name: '',
    advance_count: 2,
    knockout_bracket: 'cross',
    team_format: 'SSS',
    roster_size: 3,
    set_rules: normalizeSetRules({ ...DEFAULT_SET_RULES, ...partialRules }),
    ...rest,
  }
}

export const DIVISION_PRESETS: { label: string; draft: Partial<DivisionDraft> }[] = [
  { label: 'Singles – U12', draft: { event_type: 'single', category: 'u12' } },
  { label: 'Singles – U16', draft: { event_type: 'single', category: 'u16' } },
  { label: 'Singles – U18', draft: { event_type: 'single', category: 'u18' } },
  { label: 'Singles – Open', draft: { event_type: 'single', category: 'open' } },
  { label: 'Doubles – Open', draft: { event_type: 'doubles', category: 'open' } },
  { label: 'Team', draft: { event_type: 'team', category: 'open' } },
  { label: 'Executive', draft: { event_type: 'executive' } },
]

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'single', label: 'Singles' },
  { value: 'doubles', label: 'Doubles' },
  { value: 'team', label: 'Team' },
  { value: 'executive', label: 'Executive' },
]

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'u12', label: 'U12' },
  { value: 'u16', label: 'U16' },
  { value: 'u18', label: 'U18' },
  { value: 'open', label: 'Open' },
]

const FORMATS: TeamFormat[] = ['SSS', 'SDS', 'SSDSS']

export function divisionDraftToConfig(draft: DivisionDraft): TournamentConfig {
  return {
    advance_count: draft.advance_count,
    knockout_bracket: draft.knockout_bracket,
    set_rules: draft.set_rules,
    ...(draft.event_type === 'team' && {
      team_format: draft.team_format,
      roster_size: draft.roster_size,
    }),
  }
}

export function divisionDraftToEventInput(draft: DivisionDraft) {
  const category =
    draft.event_type === 'team' || draft.event_type === 'executive' ? null : draft.category
  const name = draft.custom_name.trim() || buildEventName(draft.event_type, category)

  return {
    name,
    event_type: draft.event_type,
    category,
    config: divisionDraftToConfig(draft),
  }
}

/** Build edit draft from an existing division (registration still open). */
export function eventToDivisionDraft(event: TournamentEvent): DivisionDraft {
  const category =
    event.event_type === 'team' || event.event_type === 'executive' ? null : event.category
  const autoName = buildEventName(event.event_type, category)
  const custom_name = event.name === autoName ? '' : event.name

  return createDivisionDraft({
    event_type: event.event_type,
    category: event.category ?? 'open',
    custom_name,
    advance_count: event.config.advance_count,
    knockout_bracket: event.config.knockout_bracket ?? 'cross',
    team_format: event.config.team_format ?? 'SSS',
    roster_size: event.config.roster_size ?? 3,
    set_rules: normalizeSetRules(event.config.set_rules),
  })
}

/** Settings-only patch — keeps event type, category, and legacy layout fields. */
export function divisionDraftToSettingsUpdate(draft: DivisionDraft, event: TournamentEvent) {
  const category =
    event.event_type === 'team' || event.event_type === 'executive' ? null : event.category
  const name = draft.custom_name.trim() || buildEventName(event.event_type, category)

  return {
    name,
    config: {
      ...event.config,
      advance_count: draft.advance_count,
      set_rules: draft.set_rules,
      ...(event.event_type === 'team' && {
        team_format: draft.team_format,
        roster_size: draft.roster_size,
      }),
    },
  }
}

interface Props {
  draft: DivisionDraft
  onChange: (draft: DivisionDraft) => void
  onRemove?: () => void
  title?: string
  /** Hide event type / category pickers (division already created). */
  lockEventStructure?: boolean
}

export function DivisionConfigForm({
  draft,
  onChange,
  onRemove,
  title,
  lockEventStructure = false,
}: Props) {
  const displayName =
    draft.custom_name.trim() ||
    buildEventName(
      draft.event_type,
      draft.event_type === 'team' || draft.event_type === 'executive' ? null : draft.category,
    )

  const patch = (partial: Partial<DivisionDraft>) => onChange({ ...draft, ...partial })

  const structureLabel = buildEventName(
    draft.event_type,
    draft.event_type === 'team' || draft.event_type === 'executive' ? null : draft.category,
  )

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-base font-extrabold text-text-primary">
          {title ?? displayName}
        </h3>
        {onRemove && <RemoveRowButton onClick={onRemove} />}
      </div>

      {lockEventStructure ? (
        <div className="space-y-2">
          <FormLabel>Event type</FormLabel>
          <TagPill>{structureLabel}</TagPill>
          <p className="text-xs text-text-steel leading-snug">
            Event type and category cannot be changed after the division is created.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <FormLabel>Event type</FormLabel>
            <SegmentedControl
              value={draft.event_type}
              onChange={(event_type) => patch({ event_type })}
              options={EVENT_TYPES}
            />
          </div>

          {hasCategoryPicker(draft.event_type) && (
            <div className="space-y-2">
              <FormLabel>Category</FormLabel>
              <SegmentedControl
                value={draft.category}
                onChange={(category) => patch({ category })}
                options={CATEGORIES}
              />
            </div>
          )}
        </>
      )}

      <div>
        <FormLabel>Display name (optional)</FormLabel>
        <TextInput
          value={draft.custom_name}
          onChange={(e) => patch({ custom_name: e.target.value })}
          placeholder={displayName}
        />
      </div>

      {draft.event_type === 'team' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <FormLabel>Roster size</FormLabel>
            <SegmentedControl
              value={String(draft.roster_size) as '3' | '4'}
              onChange={(v) => patch({ roster_size: parseInt(v, 10) as 3 | 4 })}
              options={[
                { value: '3', label: '3' },
                { value: '4', label: '4' },
              ]}
            />
          </div>
          <div className="space-y-2">
            <FormLabel>Team format</FormLabel>
            <SegmentedControl
              value={draft.team_format}
              onChange={(team_format) => patch({ team_format: team_format as TeamFormat })}
              options={FORMATS.map((f) => ({ value: f, label: f }))}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <FormLabel>Advance per group</FormLabel>
        <NumberStepper
          value={draft.advance_count}
          min={1}
          max={MAX_PER_GROUP}
          onChange={(advance_count) => patch({ advance_count })}
        />
      </div>

      <SetRulesPicker
        value={draft.set_rules}
        onChange={(set_rules) => patch({ set_rules })}
      />
    </div>
  )
}
