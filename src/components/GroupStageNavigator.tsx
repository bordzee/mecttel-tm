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
      className="sticky top-14 z-[5] -mx-4 px-4 bg-navy border-b border-border"
      aria-label="Stage navigator"
    >
      <div className="flex gap-1 overflow-x-auto scrollbar-none" role="tablist">
        {tabs.map((tab) => {
          const active = tab.id === activeId
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={`press relative shrink-0 h-11 px-3 inline-flex items-center gap-2 text-sm font-medium transition-colors ${
                active ? 'text-text-primary' : 'text-text-steel hover:text-text-primary'
              }`}
            >
              {tab.label}
              {tab.pendingCount != null && tab.pendingCount > 0 && (
                <span className="font-mono text-xs text-text-faint">{tab.pendingCount}</span>
              )}
              <span
                aria-hidden
                className={`absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-text-primary origin-left transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                  active ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </button>
          )
        })}
      </div>
    </nav>
  )
}
