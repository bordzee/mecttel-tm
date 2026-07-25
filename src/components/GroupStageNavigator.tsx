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
      className="sticky top-[52px] z-[5] -mx-4 px-4 py-2 bg-slate-50/95 backdrop-blur border-y border-slate-200"
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
                  ? 'border-brand-600 bg-white text-brand-600 font-semibold shadow-sm'
                  : 'border-slate-200 bg-white text-slate-500 font-normal hover:border-slate-300'
              }`}
            >
              {tab.label}
              {tab.pendingCount != null && tab.pendingCount > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
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
