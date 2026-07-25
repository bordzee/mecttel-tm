import { Link } from 'react-router-dom'

export function BackLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="text-sm text-brand-600 hover:text-brand-700 inline-block">
      {children}
    </Link>
  )
}

export function PageTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h1 className={`font-heading text-[22px] font-bold text-slate-900 leading-tight ${className}`}>
      {children}
    </h1>
  )
}

export function AdminPageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="font-heading text-xl font-bold text-slate-900">{children}</h1>
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
      {live && <span className="w-2 h-2 rounded-full bg-live animate-tt-pulse shrink-0" aria-hidden />}
      <h2 className="font-heading text-lg font-bold text-slate-900">{children}</h2>
    </div>
  )
}

export function SubsectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-heading text-base font-semibold text-slate-700">{children}</h3>
}

type PillVariant = 'live' | 'upcoming' | 'draft' | 'ongoing' | 'ended'

const pillStyles: Record<PillVariant, string> = {
  live: 'bg-red-100 text-red-700',
  upcoming: 'bg-brand-100 text-brand-700',
  draft: 'bg-slate-100 text-slate-600',
  ongoing: 'bg-red-100 text-red-700',
  ended: 'bg-slate-100 text-slate-600',
}

export function Pill({ variant, children }: { variant: PillVariant; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${pillStyles[variant]}`}
    >
      {variant === 'live' || variant === 'ongoing' ? (
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-tt-pulse" aria-hidden />
      ) : null}
      {children}
    </span>
  )
}

/** Brand-tinted tag for event type / category (P3). */
export function TagPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex text-[11px] font-medium px-2.5 py-1 rounded-full bg-brand-100 text-brand-700">
      {children}
    </span>
  )
}

/** Muted status tag for division detail (P3 ongoing chip). */
export function StatusChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
      {children}
    </span>
  )
}

export function ConfigSummaryCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 text-sm text-slate-500">
      {children}
    </div>
  )
}

export function InfoPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 text-sm text-brand-700">
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
  'inline-flex items-center justify-center font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'h-11 bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:opacity-100',
  secondary: 'h-[42px] bg-white text-slate-900 border border-slate-200 rounded-lg hover:border-slate-300',
  dashed:
    'h-[42px] bg-white text-slate-600 border border-dashed border-slate-300 rounded-lg hover:border-brand-500 hover:text-brand-700',
  destructive: 'h-[42px] bg-red-600 text-white rounded-lg hover:bg-red-700',
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
    <Tag className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`} {...props}>
      {children}
    </Tag>
  )
}

export function MutedPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 ${className}`}>
      {children}
    </div>
  )
}

export function FormLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[13px] font-medium text-slate-700 mb-1">{children}</label>
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-500"
      {...props}
    />
  )
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-500"
      {...props}
    />
  )
}

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs bg-chip-bg text-chip-text px-2 py-0.5 rounded">{children}</span>
  )
}

export function EmptyMessage({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>
}

export function ErrorMessage({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-sm text-red-600 ${className}`}>{children}</p>
}

export function SuccessMessage({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-brand-700">{children}</p>
}

export function MetaText({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-sm text-slate-500 ${className}`}>{children}</p>
}

export function CaptionText({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs text-slate-400 ${className}`}>{children}</p>
}

export function TextLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="text-sm text-brand-600 font-medium hover:text-brand-700">
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
      className={`text-sm text-red-600 hover:text-red-700 px-2 py-1 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
