import type { CSSProperties } from 'react'

const STAGGER_MS = 70

function staggerStyle(index: number): CSSProperties {
  return { animationDelay: `${index * STAGGER_MS}ms` }
}

export function Skeleton({
  className = '',
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={`rounded-lg bg-card-raised animate-tt-pulse ${className}`}
      style={style}
      aria-hidden
    />
  )
}

export function LoadingStatus({ label = 'Loading' }: { label?: string }) {
  return (
    <span className="sr-only" role="status" aria-live="polite">
      {label}
    </span>
  )
}

function TournamentCardSkeleton({ index }: { index: number }) {
  return (
    <div
      className="bg-card rounded-2xl border border-border p-4 space-y-3"
      style={staggerStyle(index)}
    >
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-5 w-[68%] rounded-md" />
        <Skeleton className="h-6 w-16 rounded-full shrink-0" />
      </div>
      <Skeleton className="h-3.5 w-[45%] rounded-md" />
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-[72px] rounded-full" />
      </div>
    </div>
  )
}

export function HomePageSkeleton() {
  return (
    <div className="space-y-[26px] pt-1">
      <LoadingStatus label="Loading tournaments" />
      <section className="space-y-3">
        <Skeleton className="h-5 w-24 rounded-md" style={staggerStyle(0)} />
        <div className="space-y-3">
          <TournamentCardSkeleton index={1} />
          <TournamentCardSkeleton index={2} />
        </div>
      </section>
      <section className="space-y-3">
        <Skeleton className="h-5 w-28 rounded-md" style={staggerStyle(3)} />
        <div className="space-y-3">
          <TournamentCardSkeleton index={4} />
        </div>
      </section>
    </div>
  )
}

export function TournamentDetailSkeleton() {
  return (
    <div className="space-y-5">
      <LoadingStatus label="Loading tournament" />
      <Skeleton className="h-4 w-14 rounded-md" style={staggerStyle(0)} />
      <div className="space-y-2.5">
        <Skeleton className="h-8 w-[85%] rounded-lg" style={staggerStyle(1)} />
        <Skeleton className="h-4 w-52 rounded-md" style={staggerStyle(2)} />
      </div>
      <Skeleton className="aspect-[16/9] w-full rounded-2xl" style={staggerStyle(3)} />
      <section className="space-y-3">
        <Skeleton className="h-5 w-40 rounded-md" style={staggerStyle(4)} />
        <div className="space-y-2.5">
          {[5, 6, 7].map((i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3"
              style={staggerStyle(i)}
            >
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-[70%] rounded-md" />
                <Skeleton className="h-3.5 w-24 rounded-md" />
              </div>
              <Skeleton className="h-6 w-14 rounded-full shrink-0" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export function EventDetailSkeleton() {
  return (
    <div className="space-y-4">
      <LoadingStatus label="Loading division" />
      <Skeleton className="h-4 w-32 rounded-md" style={staggerStyle(0)} />
      <Skeleton className="h-8 w-[90%] rounded-lg" style={staggerStyle(1)} />
      <div className="flex flex-wrap gap-1.5">
        <Skeleton className="h-7 w-20 rounded-full" style={staggerStyle(2)} />
        <Skeleton className="h-7 w-16 rounded-full" style={staggerStyle(3)} />
        <Skeleton className="h-7 w-28 rounded-full" style={staggerStyle(4)} />
      </div>
      <Skeleton className="aspect-[16/9] w-full rounded-2xl" style={staggerStyle(5)} />
      <Skeleton className="h-10 w-full rounded-[10px]" style={staggerStyle(6)} />
      <ConfigCardSkeleton index={7} />
    </div>
  )
}

function ConfigCardSkeleton({ index }: { index: number }) {
  return (
    <div
      className="bg-card rounded-xl border border-border overflow-hidden"
      style={staggerStyle(index)}
    >
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border first:border-t-0"
        >
          <Skeleton className="h-3.5 w-28 rounded-md" />
          <Skeleton className="h-3.5 w-16 rounded-md" />
        </div>
      ))}
    </div>
  )
}

export function ParticipantsListSkeleton({ startIndex = 0, rows = 5 }: { startIndex?: number; rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-5 w-28 rounded-md" style={staggerStyle(startIndex)} />
        <Skeleton className="h-4 w-10 rounded-md" style={staggerStyle(startIndex + 1)} />
      </div>
      <ul className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <li
            key={i}
            className="bg-card rounded-xl border border-border px-3 py-3 flex items-center gap-3"
            style={staggerStyle(startIndex + 2 + i)}
          >
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-[55%] rounded-md" />
              <Skeleton className="h-3.5 w-[35%] rounded-md" />
            </div>
            <Skeleton className="h-5 w-5 rounded shrink-0" />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function BracketsTabSkeleton() {
  return (
    <div className="space-y-4">
      <LoadingStatus label="Loading brackets" />
      <div className="flex gap-2 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full shrink-0" style={staggerStyle(i)} />
        ))}
      </div>
      <div className="bg-card rounded-xl border border-border overflow-hidden" style={staggerStyle(3)}>
        <Skeleton className="h-10 w-full rounded-none" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3 h-[46px] border-t border-border">
            <Skeleton className="h-4 w-6 rounded-md shrink-0" />
            <Skeleton className="h-4 flex-1 rounded-md" />
            <Skeleton className="h-4 w-8 rounded-md shrink-0" />
            <Skeleton className="h-4 w-8 rounded-md shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-3">
      <LoadingStatus label="Loading tournaments" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-card border border-border rounded-2xl p-4 space-y-3"
          style={staggerStyle(i)}
        >
          <Skeleton className="h-5 w-[75%] rounded-md" />
          <div className="flex flex-wrap gap-1.5">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function AdminHubSkeleton() {
  return (
    <div className="space-y-4">
      <LoadingStatus label="Loading tournament" />
      <Skeleton className="h-4 w-14 rounded-md" style={staggerStyle(0)} />
      <Skeleton className="h-8 w-[80%] rounded-lg" style={staggerStyle(1)} />
      <Skeleton className="h-4 w-48 rounded-md" style={staggerStyle(2)} />
      <section className="space-y-3 pt-2">
        <Skeleton className="h-5 w-36 rounded-md" style={staggerStyle(3)} />
        <div className="space-y-2.5">
          {[4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between"
              style={staggerStyle(i)}
            >
              <Skeleton className="h-5 w-[60%] rounded-md" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export function AdminEventPageSkeleton() {
  return (
    <div className="space-y-4">
      <LoadingStatus label="Loading division" />
      <Skeleton className="h-4 w-36 rounded-md" style={staggerStyle(0)} />
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-8 flex-1 rounded-lg" style={staggerStyle(1)} />
        <Skeleton className="h-6 w-20 rounded-full shrink-0" style={staggerStyle(2)} />
      </div>
      <Skeleton className="h-4 w-40 rounded-md" style={staggerStyle(3)} />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1 rounded-full" style={staggerStyle(4)} />
        <Skeleton className="h-9 flex-1 rounded-full" style={staggerStyle(5)} />
      </div>
      <div
        className="bg-card border border-border-strong rounded-2xl p-4 space-y-3"
        style={staggerStyle(6)}
      >
        <Skeleton className="h-5 w-40 rounded-md" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
      <ParticipantsListSkeleton startIndex={7} rows={4} />
    </div>
  )
}

export function AdminFormSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <LoadingStatus />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-2" style={staggerStyle(i)}>
          <Skeleton className="h-3.5 w-24 rounded-md" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ))}
      <Skeleton className="h-11 w-full rounded-xl mt-2" style={staggerStyle(rows)} />
    </div>
  )
}

export function AuthCheckingSkeleton({ message = 'Checking sign-in' }: { message?: string }) {
  return (
    <div className="py-12 flex flex-col items-center gap-4">
      <LoadingStatus label={message} />
      <div className="w-10 h-10 rounded-full border-2 border-border border-t-brand-500 animate-spin" />
      <Skeleton className="h-4 w-36 rounded-md" />
    </div>
  )
}
