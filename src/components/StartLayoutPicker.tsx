import type { StartLayoutOption } from '../lib/groupLayout'
import { formatKnockoutByePreview } from '../lib/knockoutRounds'
import { FormLabel } from './ui/primitives'

export function StartLayoutPicker({
  options,
  selectedKey,
  onSelect,
  advanceCount,
}: {
  options: StartLayoutOption[]
  selectedKey?: string
  onSelect: (key: string) => void
  /** Advance per group — used to preview knockout byes for each layout. */
  advanceCount: number
}) {
  if (!options.length) return null

  return (
    <div className="space-y-2">
      <FormLabel>Select group layout</FormLabel>
      <div className="space-y-2">
        {options.map((opt) => {
          const active = selectedKey === opt.key
          const byePreview = formatKnockoutByePreview(opt.groupCount, advanceCount)

          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onSelect(opt.key)}
              className={`w-full px-3 py-3 rounded-[10px] border transition-colors text-left ${
                active
                  ? 'border-[1.5px] border-brand-500 bg-brand-100'
                  : 'border border-border bg-navy hover:border-border-strong'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`w-[18px] h-[18px] mt-0.5 rounded-full shrink-0 border-[1.5px] ${
                    active ? 'border-brand-500 bg-brand-500' : 'border-border-strong bg-transparent'
                  }`}
                  aria-hidden
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-text-bluewhite break-words">
                    {opt.label}
                  </span>
                  {byePreview && (
                    <span className="block text-xs text-text-steel mt-0.5 break-words">{byePreview}</span>
                  )}
                  {opt.uneven && (
                    <span className="inline-block text-[11px] font-semibold text-text-steel mt-1.5">
                      uneven
                    </span>
                  )}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
