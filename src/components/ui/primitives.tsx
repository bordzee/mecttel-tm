import { useId, useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { formatDisplayDate } from '../../lib/formatDate'

export function BrandDot({ className = '' }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" fill="var(--accent)" />
      <path
        d="M5.2 7.6c3.4 1.1 6.2 4.4 6.9 9.2"
        fill="none"
        stroke="var(--accent-ink)"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity=".7"
      />
    </svg>
  )
}

export function BackLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 min-h-10 -ml-1 pr-2 text-sm text-text-steel hover:text-text-primary font-medium transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m15 18-6-6 6-6" />
      </svg>
      {children}
    </Link>
  )
}

export function BackButton({
  onClick,
  children,
  className = '',
}: {
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 min-h-10 -ml-1 pr-2 text-sm text-text-steel hover:text-text-primary font-medium transition-colors ${className}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m15 18-6-6 6-6" />
      </svg>
      {children}
    </button>
  )
}

export function PageTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h1 className={`font-heading text-2xl sm:text-[28px] font-semibold tracking-tight text-text-primary leading-tight ${className}`}>
      {children}
    </h1>
  )
}

export function EventPageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="font-heading text-2xl sm:text-[28px] font-semibold tracking-tight text-text-primary leading-tight">{children}</h1>
}

export function ScreenSectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-heading text-lg font-semibold text-text-primary">{children}</h2>
}

export function EventAdminTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h1 className={`font-heading text-2xl sm:text-[28px] font-semibold tracking-tight text-text-primary leading-tight flex-1 min-w-0 ${className}`}>
      {children}
    </h1>
  )
}

export function ParticipantsTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-heading text-lg font-semibold text-text-primary">{children}</h2>
}

export function MetaIconsRow({ date, venue }: { date?: string | null; venue?: string | null }) {
  if (!date && !venue) return null
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-text-steel">
      {date && (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" />
          </svg>
          <span>{formatDisplayDate(date)}</span>
        </>
      )}
      {date && venue && <span className="w-[3px] h-[3px] rounded-full bg-text-steel" aria-hidden />}
      {venue && (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" />
          </svg>
          <span>{venue}</span>
        </>
      )}
    </div>
  )
}

export function ConfigRowsCard({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {rows.map((row, i) => (
        <div
          key={row.label}
          className={`flex items-center justify-between gap-3 px-4 py-3.5 ${i > 0 ? 'border-t border-border' : ''}`}
        >
          <span className="text-[13px] font-medium text-text-steel">{row.label}</span>
          <span className="text-sm font-semibold text-text-bluewhite">{row.value}</span>
        </div>
      ))}
    </div>
  )
}

export function SeedBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-text bg-brand-100 px-2 py-0.5 rounded-full shrink-0">
      <SeededStarIcon size={12} />
      {children}
    </span>
  )
}

export function SeededStarIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`shrink-0 text-accent-text ${className}`}
      aria-hidden
    >
      <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L5.7 21l2.3-7-6-4.6h7.6z" />
    </svg>
  )
}

export function StepIndicator({ steps, activeIndex }: { steps: string[]; activeIndex: number }) {
  return (
    <ol className="flex items-center gap-3 text-sm font-medium text-text-faint" aria-label="Progress">
      {steps.map((label, i) => {
        const active = i === activeIndex
        const complete = i < activeIndex
        return (
          <li key={label} className="flex items-center gap-3" aria-current={active ? 'step' : undefined}>
            <span className={`inline-flex items-center gap-2 ${active ? 'text-text-primary' : ''}`}>
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono shrink-0 ${
                  active
                    ? 'bg-text-primary text-navy'
                    : complete
                      ? 'bg-green-soft text-winner'
                      : 'bg-card-raised'
                }`}
              >
                {complete ? '✓' : i + 1}
              </span>
              {label}
            </span>
            {i < steps.length - 1 && <span className="w-8 h-px bg-border-strong" aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  disabledValues = [],
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  disabledValues?: T[]
}) {
  return (
    <div className="flex gap-0.5 p-[3px] rounded-[10px] bg-card-raised">
      {options.map((opt) => {
        const active = value === opt.value
        const disabled = disabledValues.includes(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`press flex-1 min-w-0 h-10 rounded-lg text-[13px] font-medium transition-colors ${
              active
                ? 'bg-seg-on text-text-primary shadow-[0_0_0_1px_var(--line)]'
                : 'bg-transparent text-text-steel hover:text-text-primary'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function NumberStepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex items-center gap-3.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="press w-10 h-10 rounded-[10px] bg-card-raised flex items-center justify-center text-text-bluewhite disabled:opacity-40"
        aria-label="Decrease"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12h14" />
        </svg>
      </button>
      <span className="text-base font-medium font-mono text-text-primary tabular-nums min-w-[2ch] text-center">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="press w-10 h-10 rounded-[10px] bg-card-raised flex items-center justify-center text-text-bluewhite disabled:opacity-40"
        aria-label="Increase"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12h14" /><path d="M12 5v14" />
        </svg>
      </button>
    </div>
  )
}

export function QuickAddPill({
  label,
  onClick,
  className = '',
}: {
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`press inline-flex items-center justify-center gap-1.5 rounded-full bg-card-raised px-3.5 h-9 text-[13px] font-medium text-text-primary hover:shadow-[inset_0_0_0_1px_var(--line-strong)] ${className}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 12h14" /><path d="M12 5v14" />
      </svg>
      {label}
    </button>
  )
}

export function AddDivisionButton({
  onClick,
  disabled,
}: {
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="press inline-flex items-center justify-center gap-2 w-full h-12 rounded-[10px] bg-card-raised text-text-primary font-medium text-[15px] hover:shadow-[inset_0_0_0_1px_var(--line-strong)] disabled:opacity-50"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 12h14" /><path d="M12 5v14" />
      </svg>
      Add division
    </button>
  )
}

export function RemoveRowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[13px] font-medium text-danger shrink-0 hover:opacity-80 transition-opacity"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      </svg>
      Remove
    </button>
  )
}

export function SuccessBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 bg-green-soft rounded-xl p-3.5 text-sm text-text-primary">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-winner shrink-0 mt-0.5" aria-hidden>
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <div>{children}</div>
    </div>
  )
}

export function NoteCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border border-border p-3 text-sm text-text-steel leading-snug">
      {children}
    </div>
  )
}

export function InfoNoteCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-card rounded-xl border border-border p-3 text-[13px] text-text-steel leading-snug">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden>
        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
      </svg>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function InlineError({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold text-danger">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
      </svg>
      <span>{children}</span>
    </div>
  )
}

export function TextActionButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1 text-sm font-medium text-text-primary hover:text-accent-text transition-colors ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function AddDivisionLink({ to }: { to: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 min-h-10 text-sm text-accent-text font-medium hover:underline">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 12h14" /><path d="M12 5v14" />
      </svg>
      Add division
    </Link>
  )
}

export function IconActionButton({
  children,
  variant = 'default',
  onClick,
  label,
}: {
  children: React.ReactNode
  variant?: 'default' | 'danger'
  onClick?: () => void
  /** Accessible name: icon-only buttons have no visible text. */
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`press w-10 h-10 rounded-[10px] bg-card-raised flex items-center justify-center shrink-0 ${
        variant === 'danger' ? 'text-danger' : 'text-text-bluewhite'
      }`}
    >
      {children}
    </button>
  )
}

export function PanelSectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-heading text-base font-semibold text-text-primary tracking-tight">{children}</h2>
}

export function AdminPageTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h1 className={`font-heading text-2xl sm:text-[28px] font-semibold tracking-tight text-text-primary leading-tight ${className}`}>{children}</h1>
}

export function DashboardTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="font-heading text-2xl sm:text-[28px] font-semibold tracking-tight text-text-primary leading-tight">{children}</h1>
}

export function SectionHeaderRow({
  title,
  trailing,
}: {
  title: React.ReactNode
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="font-heading text-[17px] font-semibold tracking-tight text-text-primary">{title}</h2>
      {trailing}
    </div>
  )
}

export function WarningBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 bg-amber-soft rounded-xl p-3.5 text-[13px] font-medium text-text-primary leading-snug [&_svg]:text-amber">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 mt-0.5"
        aria-hidden
      >
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 bg-danger-soft rounded-xl p-3.5 text-[13px] font-medium text-text-primary leading-snug [&_svg]:text-danger">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 mt-0.5"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function EmptyStatePanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 rounded-[14px] bg-card ring-1 ring-border py-9 px-4 text-center">
      <p className="text-sm text-text-steel">{children}</p>
    </div>
  )
}

export function DeleteConfirmPanel({
  title,
  description,
  onCancel,
  onConfirm,
  confirming = false,
}: {
  title: string
  description: string
  onCancel: () => void
  onConfirm: () => void
  confirming?: boolean
}) {
  return (
    <div className="bg-danger-soft rounded-2xl p-4 space-y-3">
      <p className="text-sm font-semibold text-danger">{title}</p>
      <p className="text-[13px] text-text-bluewhite leading-snug">{description}</p>
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={confirming}
          className="press h-12 rounded-[10px] bg-card-raised text-text-primary font-medium text-[15px] hover:opacity-90 disabled:opacity-50"
        >
          Keep
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirming}
          className="press h-12 rounded-[10px] bg-danger text-on-danger font-semibold text-[15px] hover:opacity-90 disabled:opacity-50"
        >
          {confirming ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  )
}

export function ManualRankBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber bg-amber-soft px-2.5 py-0.5 rounded-full">
      Manual ranks
    </span>
  )
}

export function ManualRankNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-amber-soft p-3.5 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber shrink-0" aria-hidden>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
          <path d="M12 9v4" /><path d="M12 17h.01" />
        </svg>
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-amber">Manual ranks</p>
      </div>
      <p className="text-[13px] text-text-bluewhite leading-snug">{children}</p>
    </div>
  )
}

export function IconTextLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-1.5 w-full text-sm text-accent-text font-semibold hover:text-accent-text transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" x2="19" y1="8" y2="14" />
        <line x1="22" x2="16" y1="11" y2="11" />
      </svg>
      {children}
    </Link>
  )
}

export function AddEntryButton({
  className = '',
  fullWidth,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { fullWidth?: boolean }) {
  return (
    <button
      type="button"
      className={`press inline-flex items-center justify-center gap-1.5 h-12 bg-brand-100 text-accent-text rounded-[10px] font-semibold text-[15px] hover:bg-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    />
  )
}

export function DeleteDivisionButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`press inline-flex items-center justify-center gap-1.5 w-full h-12 bg-danger-soft text-danger rounded-[10px] font-semibold text-[15px] hover:opacity-90 disabled:opacity-50 ${className}`}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      </svg>
      {children}
    </button>
  )
}

export function SectionTitle({
  children,
  live,
}: {
  children: React.ReactNode
  live?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      {live && (
        <span className="w-2 h-2 rounded-full bg-live animate-tt-pulse shrink-0" aria-hidden />
      )}
      <h2 className="font-heading text-xl font-semibold tracking-tight text-text-primary">{children}</h2>
    </div>
  )
}

export function SubsectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-heading text-base font-semibold text-text-bluewhite">{children}</h3>
}

type PillVariant = 'live' | 'upcoming' | 'draft' | 'ongoing' | 'ended'

const pillStyles: Record<PillVariant, string> = {
  live: 'bg-live-bg text-live-text',
  ongoing: 'bg-live-bg text-live-text',
  upcoming: 'bg-card-raised text-text-steel',
  draft: 'bg-card-raised text-text-steel',
  ended: 'bg-card-raised text-text-steel',
}

export function Pill({ variant, children }: { variant: PillVariant; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full ${pillStyles[variant]}`}
    >
      {(variant === 'live' || variant === 'ongoing') && (
        <span className="w-2 h-2 rounded-full bg-live animate-tt-pulse" aria-hidden />
      )}
      {children}
    </span>
  )
}

export function TagPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full bg-card-raised text-text-bluewhite">
      {children}
    </span>
  )
}

export function StatusChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full bg-card-raised text-text-steel">
      {children}
    </span>
  )
}

export function ConfigSummaryCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-2 text-sm text-text-steel">
      {children}
    </div>
  )
}

export function InfoPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-green-soft border border-brand-500/30 rounded-2xl p-4 text-sm text-text-bluewhite">
      {children}
    </div>
  )
}

export function CenteredState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center px-4">
      {children}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'dashed' | 'destructive'

const buttonBase =
  'press inline-flex items-center justify-center gap-2 font-medium text-[15px] disabled:opacity-50 disabled:cursor-not-allowed'

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'h-12 bg-brand-500 text-on-accent rounded-[10px] hover:bg-brand-700 disabled:bg-card-raised disabled:text-text-faint disabled:opacity-100',
  secondary:
    'h-12 bg-card-raised text-text-primary rounded-[10px] hover:shadow-[inset_0_0_0_1px_var(--line-strong)]',
  dashed:
    'h-12 bg-brand-100 text-accent-text rounded-[10px] hover:bg-brand-500/20',
  destructive: 'h-12 bg-danger text-on-danger rounded-[10px] hover:opacity-90 font-semibold',
}

export function Button({
  variant = 'primary',
  className = '',
  fullWidth,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  fullWidth?: boolean
}) {
  return (
    <button
      type="button"
      className={`${buttonBase} ${buttonVariants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    />
  )
}

export function LinkButton({
  to,
  variant = 'primary',
  className = '',
  children,
}: {
  to: string
  variant?: ButtonVariant
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className={`${buttonBase} ${buttonVariants[variant]} w-full text-center ${className}`}
    >
      {children}
    </Link>
  )
}

export function Card({
  children,
  className = '',
  as: Tag = 'div',
  ...props
}: {
  children: React.ReactNode
  className?: string
  as?: 'div' | 'section' | 'form'
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={`bg-card rounded-[14px] border border-border ${className}`} {...props}>
      {children}
    </Tag>
  )
}

export function MutedPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card-raised rounded-[14px] p-4 space-y-3 ${className}`}>
      {children}
    </div>
  )
}

/**
 * Label for the form control that follows it (as a sibling, or inside the next
 * sibling). It links itself to that control, so screen readers announce the label
 * and tapping the label focuses the field, without every call site passing ids.
 */
export function FormLabel({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLLabelElement>(null)
  const generatedId = useId()

  useLayoutEffect(() => {
    const label = ref.current
    const next = label?.nextElementSibling
    if (!label || !next) return
    const control = next.matches('input,select,textarea')
      ? next
      : next.querySelector('input,select,textarea')
    if (!control) return
    if (!control.id) control.id = generatedId
    label.htmlFor = control.id
  })

  return (
    <label ref={ref} className="block text-[13px] font-medium text-text-steel mb-1.5">
      {children}
    </label>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full h-12 bg-card border border-border-strong rounded-[10px] px-3.5 text-base text-text-primary placeholder:text-text-faint focus:outline-none focus:border-text-primary focus:ring-1 focus:ring-text-primary"
      {...props}
    />
  )
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="w-full h-12 bg-card border border-border-strong rounded-[10px] px-3.5 text-base text-text-primary focus:outline-none focus:border-text-primary focus:ring-1 focus:ring-text-primary"
      {...props}
    />
  )
}

export function TextInputLight(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full h-12 bg-card border border-border-strong rounded-[10px] px-3.5 text-base text-text-primary placeholder:text-text-faint focus:outline-none focus:border-text-primary focus:ring-1 focus:ring-text-primary"
      {...props}
    />
  )
}

export const FormLabelLight = FormLabel

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full bg-card-raised text-text-bluewhite">
      {children}
    </span>
  )
}

export function EmptyMessage({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-text-steel">{children}</p>
}

export function ErrorMessage({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-sm text-danger ${className}`}>{children}</p>
}

export function SuccessMessage({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-accent-text">{children}</p>
}

export function MetaText({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-sm text-text-steel ${className}`}>{children}</p>
}

export function CaptionText({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs text-text-steel ${className}`}>{children}</p>
}

export function TextLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="text-sm text-accent-text font-semibold hover:text-accent-text">
      {children}
    </Link>
  )
}

export function DestructiveTextButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`text-sm text-danger hover:opacity-80 px-2 py-1 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
