import { GroupLayoutPicker } from './GroupLayoutPicker'
import { getGroupLayoutOptions } from '../lib/groupLayout'
import { DEFAULT_SET_RULES } from '../lib/constants'
import { buildEventName, hasCategoryPicker } from '../lib/displayNames'
import {
  FormLabel,
  NumberStepper,
  RemoveRowButton,
  SegmentedControl,
  TextInput,
} from './ui/primitives'
import type { Category, EventType, KnockoutBracketType, TeamFormat, TournamentConfig } from '../types'

export interface DivisionDraft {
  clientId: string
  event_type: EventType
  category: Category
  custom_name: string
  total_slots: number
  entries_per_group?: number
  advance_count: number
  knockout_bracket: KnockoutBracketType
  team_format: TeamFormat
  roster_size: 3 | 4
  set_rules: TournamentConfig['set_rules']
}

export function createDivisionDraft(partial?: Partial<DivisionDraft>): DivisionDraft {
  return {
    clientId: crypto.randomUUID(),
    event_type: 'single',
    category: 'open',
    custom_name: '',
    total_slots: 12,
    entries_per_group: undefined,
    advance_count: 2,
    knockout_bracket: 'cross',
    team_format: 'SSS',
    roster_size: 3,
    set_rules: { ...DEFAULT_SET_RULES },
    ...partial,
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

const KNOCKOUT_BRACKETS: { value: KnockoutBracketType; label: string }[] = [
  { value: 'cross', label: 'Cross' },
  { value: 'block', label: 'Block' },
]

const FORMATS: TeamFormat[] = ['SSS', 'SDS', 'SSDSS']

export function divisionDraftToConfig(draft: DivisionDraft): TournamentConfig {
  const layoutOptions = getGroupLayoutOptions(draft.total_slots)
  const selectedLayout = layoutOptions.find((o) => o.entriesPerGroup === draft.entries_per_group)
  let knockoutBracket = draft.knockout_bracket
  if (
    knockoutBracket === 'block' &&
    selectedLayout != null &&
    selectedLayout.groupCount % 2 !== 0
  ) {
    knockoutBracket = 'cross'
  }

  return {
    total_slots: draft.total_slots,
    advance_count: draft.advance_count,
    knockout_bracket: knockoutBracket,
    set_rules: draft.set_rules,
    ...(draft.entries_per_group != null && { entries_per_group: draft.entries_per_group }),
    ...(selectedLayout?.groupCount != null && { group_count: selectedLayout.groupCount }),
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

interface Props {
  draft: DivisionDraft
  onChange: (draft: DivisionDraft) => void
  onRemove?: () => void
  title?: string
}

export function DivisionConfigForm({ draft, onChange, onRemove, title }: Props) {
  const layoutOptions = getGroupLayoutOptions(draft.total_slots)
  const selectedLayout = layoutOptions.find((o) => o.entriesPerGroup === draft.entries_per_group)
  const displayName =
    draft.custom_name.trim() ||
    buildEventName(
      draft.event_type,
      draft.event_type === 'team' || draft.event_type === 'executive' ? null : draft.category,
    )

  const patch = (partial: Partial<DivisionDraft>) => onChange({ ...draft, ...partial })

  const advanceMax = draft.entries_per_group ?? 4
  const blockDisabled =
    selectedLayout != null && selectedLayout.groupCount % 2 !== 0

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-base font-extrabold text-text-primary">
          {title ?? displayName}
        </h3>
        {onRemove && <RemoveRowButton onClick={onRemove} />}
      </div>

      <div className="space-y-2">
        <FormLabel>Event type</FormLabel>
        <SegmentedControl
          value={draft.event_type}
          onChange={(event_type) =>
            patch({ event_type, entries_per_group: undefined })
          }
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

      <div>
        <FormLabel>Display name (optional)</FormLabel>
        <TextInput
          value={draft.custom_name}
          onChange={(e) => patch({ custom_name: e.target.value })}
          placeholder={displayName}
        />
      </div>

      <div>
        <FormLabel>Maximum entry slots</FormLabel>
        <TextInput
          type="number"
          min={2}
          value={draft.total_slots}
          onChange={(e) =>
            patch({
              total_slots: parseInt(e.target.value, 10) || 2,
              entries_per_group: undefined,
            })
          }
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

      <GroupLayoutPicker
        options={layoutOptions}
        selected={draft.entries_per_group}
        onSelect={(v) => {
          const layout = layoutOptions.find((o) => o.entriesPerGroup === v)
          const blockInvalid =
            draft.knockout_bracket === 'block' &&
            layout != null &&
            layout.groupCount % 2 !== 0
          patch({
            entries_per_group: v,
            advance_count: Math.min(draft.advance_count, v),
            ...(blockInvalid ? { knockout_bracket: 'cross' as const } : {}),
          })
        }}
      />

      <div className="space-y-2">
        <FormLabel>Advance per group</FormLabel>
        <NumberStepper
          value={draft.advance_count}
          min={1}
          max={advanceMax}
          onChange={(advance_count) => patch({ advance_count })}
        />
      </div>

      <div className="space-y-2">
        <FormLabel>Knockout bracket</FormLabel>
        <SegmentedControl
          value={draft.knockout_bracket}
          onChange={(knockout_bracket) => patch({ knockout_bracket: knockout_bracket as KnockoutBracketType })}
          options={KNOCKOUT_BRACKETS}
          disabledValues={blockDisabled ? ['block'] : []}
        />
      </div>
    </div>
  )
}
