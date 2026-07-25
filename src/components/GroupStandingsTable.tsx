import type { StandingRow } from '../types'

export function GroupStandingsTable({
  rows,
  label,
  manualRanks,
  manualRankNote,
}: {
  rows: StandingRow[]
  label?: string
  manualRanks?: boolean
  manualRankNote?: string | null
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No standings yet.</p>
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {label && (
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-medium text-[13px] text-slate-700 flex items-center justify-between gap-2">
          <span>Group {label}</span>
          {manualRanks && (
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              Manual ranks
            </span>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-100">
              <th className="px-3 py-2 text-[11px] font-medium">#</th>
              <th className="px-3 py-2 text-[11px] font-medium">Name</th>
              <th className="px-3 py-2 text-center text-[11px] font-medium">W</th>
              <th className="px-3 py-2 text-center text-[11px] font-medium">L</th>
              <th className="px-3 py-2 text-center text-[11px] font-medium">+/−</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.entryId} className="border-b border-slate-50 last:border-0">
                <td className="px-3 py-2 text-slate-400">{row.rank}</td>
                <td className={`px-3 py-2 font-medium ${row.rank === 1 ? 'text-winner' : 'text-slate-900'}`}>
                  {row.name}
                </td>
                <td className="px-3 py-2 text-center text-slate-600">{row.wins}</td>
                <td className="px-3 py-2 text-center text-slate-600">{row.losses}</td>
                <td className="px-3 py-2 text-center text-slate-600">
                  {row.diff > 0 ? `+${row.diff}` : row.diff}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {manualRanks && manualRankNote && (
        <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 text-sm text-amber-900">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 mb-1">
            Why manual ranks?
          </p>
          <p>{manualRankNote}</p>
        </div>
      )}
    </div>
  )
}
