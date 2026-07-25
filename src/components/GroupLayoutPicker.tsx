import type { GroupLayoutOption } from '../types'

interface Props {
  options: GroupLayoutOption[]
  selected?: number
  onSelect: (perGroup: number) => void
}

export function GroupLayoutPicker({ options, selected, onSelect }: Props) {
  if (!options.length) {
    return <p className="text-sm text-amber-700">No valid group layouts for this entry count.</p>
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">Group layout</p>
      <div className="grid gap-2">
        {options.map((opt) => (
          <button
            key={opt.entriesPerGroup}
            type="button"
            onClick={() => onSelect(opt.entriesPerGroup)}
            className={`text-left px-4 py-3 rounded-lg border transition-colors ${
              selected === opt.entriesPerGroup
                ? 'border-brand-500 bg-brand-50 text-brand-800'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <span className="font-medium">{opt.entriesPerGroup} per group</span>
            <span className="text-slate-500 text-sm ml-2">→ {opt.groupCount} groups</span>
          </button>
        ))}
      </div>
    </div>
  )
}
