import { GroupLayoutPicker } from './GroupLayoutPicker'
import { getGroupLayoutOptions } from '../lib/groupLayout'
import { DEFAULT_SET_RULES } from '../lib/constants'
import { buildEventName, hasCategoryPicker } from '../lib/displayNames'
import type { Category, EventType, KnockoutBracketType, TeamFormat, TournamentConfig } from '../types'

export interface DivisionDraft {
  clientId: string
  event_type: EventType
  category: Category
  category_label: string
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
    category_label: '',
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
  { label: 'Executive', draft: { event_type: 'executive', category: 'open' } },
]

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'single', label: 'Singles' },
  { value: 'doubles', label: 'Doubles' },
  { value: 'team', label: 'Team' },
  { value: 'executive', label: 'Executive' },
]

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'u12', label: 'Under 12' },
  { value: 'u16', label: 'Under 16' },
  { value: 'u18', label: 'Under 18' },
  { value: 'open', label: 'Open' },
  { value: 'custom', label: 'Custom label' },
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
    ...(draft.category === 'custom' && draft.category_label && { category_label: draft.category_label }),
  }
}

export function divisionDraftToEventInput(draft: DivisionDraft) {
  const category = draft.event_type === 'team' ? null : draft.category
  const name =
    draft.custom_name.trim() ||
    buildEventName(draft.event_type, category, draft.category_label || undefined)

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
      draft.event_type === 'team' ? null : draft.category,
      draft.category_label || undefined,
    )

  const patch = (partial: Partial<DivisionDraft>) => onChange({ ...draft, ...partial })

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-slate-900">{title ?? displayName}</h3>
          {!title && <p className="text-xs text-slate-500 mt-0.5">{displayName}</p>}
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-xs text-red-600 shrink-0">
            Remove
          </button>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Event type</label>
        <div className="grid grid-cols-2 gap-2">
          {EVENT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() =>
                patch({
                  event_type: t.value,
                  entries_per_group: undefined,
                })
              }
              className={`px-3 py-2 rounded-lg border text-sm ${
                draft.event_type === t.value ? 'border-brand-500 bg-brand-50' : 'border-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {hasCategoryPicker(draft.event_type) && (
        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select
            value={draft.category}
            onChange={(e) => patch({ category: e.target.value as Category })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {draft.category === 'custom' && (
            <input
              placeholder="Custom category label (e.g. Veterans, Mixed)"
              value={draft.category_label}
              onChange={(e) => patch({ category_label: e.target.value })}
              className="w-full mt-2 border border-slate-200 rounded-lg px-3 py-2.5"
            />
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Custom display name (optional)</label>
        <input
          value={draft.custom_name}
          onChange={(e) => patch({ custom_name: e.target.value })}
          placeholder="Override auto-generated name"
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Maximum entry slots</label>
        <input
          type="number"
          min={2}
          value={draft.total_slots}
          onChange={(e) =>
            patch({
              total_slots: parseInt(e.target.value, 10) || 2,
              entries_per_group: undefined,
            })
          }
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5"
        />
      </div>

      {draft.event_type === 'team' && (
        <>
          <div>
            <label className="block text-sm font-medium mb-1">Roster size</label>
            <div className="flex gap-2">
              {([3, 4] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => patch({ roster_size: n })}
                  className={`flex-1 py-2 rounded-lg border ${
                    draft.roster_size === n ? 'border-brand-500 bg-brand-50' : 'border-slate-200'
                  }`}
                >
                  {n} players
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Team format</label>
            <div className="space-y-2">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => patch({ team_format: f })}
                  className={`w-full text-left px-3 py-2 rounded-lg border ${
                    draft.team_format === f ? 'border-brand-500 bg-brand-50' : 'border-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </>
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
            ...(blockInvalid ? { knockout_bracket: 'cross' as const } : {}),
          })
        }}
      />
      <div>
        <label className="block text-sm font-medium mb-1">Advance per group</label>
        <input
          type="number"
          min={1}
          max={draft.entries_per_group ?? 4}
          value={draft.advance_count}
          onChange={(e) => patch({ advance_count: parseInt(e.target.value, 10) || 1 })}
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Knockout bracket</label>
        <div className="flex gap-2">
          {KNOCKOUT_BRACKETS.map((opt) => {
            const blockDisabled =
              opt.value === 'block' &&
              selectedLayout != null &&
              selectedLayout.groupCount % 2 !== 0
            return (
              <button
                key={opt.value}
                type="button"
                disabled={blockDisabled}
                onClick={() => patch({ knockout_bracket: opt.value })}
                className={`flex-1 py-2 rounded-lg border text-sm ${
                  draft.knockout_bracket === opt.value
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-slate-200'
                } ${blockDisabled ? 'opacity-50' : ''}`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
