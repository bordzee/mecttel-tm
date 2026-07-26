import type { TeamFormat, RubberResult } from '../types'
import { RUBBER_SLOT_LABELS, WIN_THRESHOLD } from '../lib/constants'
import { calculateTieFromRubbers } from '../lib/scoring'

interface Props {
  format: TeamFormat
  homeName: string
  awayName: string
  rubbers: RubberResult[]
  onChange: (rubbers: RubberResult[]) => void
}

export function RubberScoreEntry({ format, homeName, awayName, rubbers, onChange }: Props) {
  const labels = RUBBER_SLOT_LABELS[format]
  const calc = calculateTieFromRubbers(rubbers, format)
  const threshold = WIN_THRESHOLD[format]

  const setRubber = (index: number, value: 'W' | 'L' | null) => {
    const next = [...rubbers]
    while (next.length < labels.length) next.push(null)
    next[index] = value
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm font-semibold text-text-bluewhite">
        <span className="truncate">{homeName}</span>
        <span className="text-lg tabular-nums font-extrabold px-2 text-text-primary">
          {calc.scoreA} – {calc.scoreB}
        </span>
        <span className="truncate text-right">{awayName}</span>
      </div>
      <p className="text-xs text-text-steel">First to {threshold} rubber wins</p>
      {labels.map((label, i) => (
        <div
          key={label}
          className="flex items-center justify-between gap-2 bg-card-raised rounded-xl px-3 py-2 border border-border"
        >
          <span className="text-sm text-text-steel w-24 shrink-0">{label}</span>
          <div className="flex gap-1">
            {(['W', 'L', null] as const).map((val) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => setRubber(i, val)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold min-w-[44px] transition-colors ${
                  rubbers[i] === val
                    ? val === 'W'
                      ? 'bg-brand-500 text-white'
                      : val === 'L'
                        ? 'bg-live text-white'
                        : 'bg-border text-text-bluewhite'
                    : 'bg-navy border border-border text-text-steel hover:border-border-strong'
                }`}
              >
                {val ?? '—'}
              </button>
            ))}
          </div>
        </div>
      ))}
      {calc.error && calc.scoreA + calc.scoreB > 0 && (
        <p className="text-sm text-amber">{calc.error}</p>
      )}
    </div>
  )
}

export { calculateTieFromRubbers }
