import { Link } from 'react-router-dom'
import { BrandDot } from './ui/primitives'
import { ThemeToggle } from './ThemeToggle'

export const PAGE_WIDTH = 'max-w-3xl lg:max-w-5xl'

export function AppLayout({ children, bleed }: { children: React.ReactNode; bleed?: boolean }) {
  return (
    <div className="min-h-screen bg-navy">
      <header className="sticky top-0 z-10 bg-navy border-b border-border">
        <div className={`${PAGE_WIDTH} mx-auto px-4 h-14 flex items-center justify-between`}>
          <Link to="/" className="flex items-center gap-2.5 min-h-10">
            <BrandDot />
            <span className="font-heading font-semibold text-base tracking-tight text-text-primary">
              TT Tournaments
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              to="/admin"
              className="press h-10 px-3 inline-flex items-center rounded-[10px] text-sm font-medium text-text-steel hover:bg-card-raised hover:text-text-primary"
            >
              Admin
            </Link>
          </div>
        </div>
      </header>
      <main className={`${PAGE_WIDTH} mx-auto ${bleed ? '' : 'px-4 py-6 sm:py-8'}`}>{children}</main>
    </div>
  )
}
