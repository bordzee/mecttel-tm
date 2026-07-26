export interface StageTab {
  id: string
  label: string
  pendingCount?: number
}

export function GroupStageNavigator({
  tabs,
  activeId,
  onChange,
}: {
  tabs: StageTab[]
  activeId: string
  onChange: (id: string) => void
}) {
  if (tabs.length <= 1) return null

  return (
    <nav
      className="sticky top-[52px] z-[5] -mx-4 px-4 py-2 bg-navy/95 backdrop-blur border-y border-border"
      aria-label="Stage navigator"
    >
      <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-none">
        {tabs.map((tab) => {
          const active = tab.id === activeId
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`shrink-0 snap-start inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[13px] transition-colors ${
                active
                  ? 'border-brand-500 bg-brand-100 text-brand-500 font-bold'
                  : 'border-border bg-card text-text-steel font-normal hover:border-border-strong hover:text-text-bluewhite'
              }`}
            >
              {tab.label}
              {tab.pendingCount != null && tab.pendingCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-soft text-amber">
                  {tab.pendingCount}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
