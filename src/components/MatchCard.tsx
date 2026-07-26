export function MatchCard({
  label,
  homeName,
  awayName,
  scoreA,
  scoreB,
  homeWon,
  awayWon,
}: {
  label?: string
  homeName: string
  awayName: string
  scoreA?: number | null
  scoreB?: number | null
  homeWon?: boolean
  awayWon?: boolean
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-3.5 space-y-2.5">
      {label && (
        <p className="text-[11px] font-bold uppercase tracking-wide text-text-steel">{label}</p>
      )}
      <div className="flex items-center gap-2.5">
        <span
          className={`flex-1 min-w-0 text-[15px] font-semibold truncate ${
            homeWon ? 'text-winner font-bold' : 'text-text-bluewhite'
          }`}
        >
          {homeName}
        </span>
        {homeWon && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-winner shrink-0"
            aria-hidden
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
        {scoreA != null && (
          <span
            className={`text-lg font-extrabold tabular-nums shrink-0 ${
              homeWon ? 'text-winner' : 'text-text-primary'
            }`}
          >
            {scoreA}
          </span>
        )}
      </div>
      <div className="h-px bg-border" />
      <div className="flex items-center gap-2.5">
        <span
          className={`flex-1 min-w-0 text-[15px] font-semibold truncate ${
            awayWon ? 'text-winner font-bold' : 'text-text-steel'
          }`}
        >
          {awayName}
        </span>
        {scoreB != null && (
          <span
            className={`text-lg font-extrabold tabular-nums shrink-0 ${
              awayWon ? 'text-winner' : 'text-text-steel'
            }`}
          >
            {scoreB}
          </span>
        )}
      </div>
    </div>
  )
}
