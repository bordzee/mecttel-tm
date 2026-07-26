import type { StartLayoutOption } from '../lib/groupLayout'
import { FormLabel } from './ui/primitives'

export function StartLayoutPicker({
  options,
  selectedKey,
  onSelect,
}: {
  options: StartLayoutOption[]
  selectedKey?: string
  onSelect: (key: string) => void
}) {
  if (!options.length) return null

  return (
    <div className="space-y-2">
      <FormLabel>Select group layout</FormLabel>
      <div className="space-y-2">
        {options.map((opt) => {
          const active = selectedKey === opt.key
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onSelect(opt.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-[10px] border transition-colors text-left ${
                active
                  ? 'border-[1.5px] border-brand-500 bg-brand-100'
                  : 'border border-border bg-navy hover:border-border-strong'
              }`}
            >
              <span
                className={`w-[18px] h-[18px] rounded-full shrink-0 border-[1.5px] ${
                  active ? 'border-brand-500 bg-brand-500' : 'border-border-strong bg-transparent'
                }`}
                aria-hidden
              />
              <span className="flex-1 min-w-0 text-sm font-semibold text-text-bluewhite">{opt.label}</span>
              {opt.uneven && (
                <span className="text-xs font-semibold text-text-steel shrink-0">uneven</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
