import { Link } from 'react-router-dom'
import { BrandDot } from './ui/primitives'

export function AppLayout({ children, bleed }: { children: React.ReactNode; bleed?: boolean }) {
  return (
    <div className="min-h-screen bg-navy">
      <header className="sticky top-0 z-10 bg-white border-b border-header-border">
        <div className="max-w-lg mx-auto px-4 h-[52px] flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <BrandDot />
            <span className="font-heading font-extrabold text-[17px] text-text-on-light">
              TT Tournaments
            </span>
          </Link>
          <Link
            to="/admin"
            className="text-sm font-semibold text-brand-500 hover:text-brand-700 transition-colors"
          >
            Admin
          </Link>
        </div>
      </header>
      <main className={`max-w-lg mx-auto ${bleed ? '' : 'px-4 py-6'}`}>{children}</main>
    </div>
  )
}
