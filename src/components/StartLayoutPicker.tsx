import type { StartLayoutOption } from '../lib/groupLayout'
import { layoutIncludesGroupOfTwo } from '../lib/groupLayout'
import { formatKnockoutByePreview } from '../lib/knockoutRounds'
import { FormLabel } from './ui/primitives'

export function StartLayoutPicker({
  options,
  selectedKey,
  onSelect,
  advanceCount,
  isOptionDisabled,
  disabledHint = 'Block bracket requires an even number of groups',
}: {
  options: StartLayoutOption[]
  selectedKey?: string
  onSelect: (key: string) => void
  /** Advance per group — used to preview knockout byes for each layout. */
  advanceCount: number
  /** When set, options matching this are shown but not selectable (e.g. Block + odd group count). */
  isOptionDisabled?: (option: StartLayoutOption) => boolean
  disabledHint?: string
}) {
  if (!options.length) return null

  return (
    <div className="space-y-2">
      <FormLabel>Select group layout</FormLabel>
      <div className="space-y-2">
        {options.map((opt) => {
          const active = selectedKey === opt.key
          const disabled = isOptionDisabled?.(opt) ?? false
          const byePreview = formatKnockoutByePreview(opt.groupCount, advanceCount)
          return (
            <button
              key={opt.key}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(opt.key)}
              title={disabled ? disabledHint : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-[10px] border transition-colors text-left ${
                disabled
                  ? 'border border-border bg-navy/50 opacity-60 cursor-not-allowed'
                  : active
                    ? 'border-[1.5px] border-brand-500 bg-brand-100'
                    : 'border border-border bg-navy hover:border-border-strong'
              }`}
            >
              <span
                className={`w-[18px] h-[18px] rounded-full shrink-0 border-[1.5px] ${
                  disabled
                    ? 'border-border bg-transparent'
                    : active
                      ? 'border-brand-500 bg-brand-500'
                      : 'border-border-strong bg-transparent'
                }`}
                aria-hidden
              />
              <span className="flex-1 min-w-0">
                <span className={`block text-sm font-semibold ${disabled ? 'text-text-steel' : 'text-text-bluewhite'}`}>
                  {opt.label}
                </span>
                {byePreview && !disabled && (
                  <span className="block text-xs text-text-steel mt-0.5">{byePreview}</span>
                )}
                {disabled && (
                  <span className="block text-xs text-text-steel mt-0.5">{disabledHint}</span>
                )}
              </span>
              {opt.uneven && !disabled && (
                <span className="text-xs font-semibold text-text-steel shrink-0">uneven</span>
              )}
              {layoutIncludesGroupOfTwo(opt.groupSizes) && !disabled && (
                <span className="text-xs font-semibold text-amber shrink-0">group of 2</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
