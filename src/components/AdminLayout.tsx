import { Link, NavLink } from 'react-router-dom'
import { BrandDot } from './ui/primitives'
import { ThemeToggle } from './ThemeToggle'
import { PAGE_WIDTH } from './AppLayout'
import { useAuth } from '../hooks/useAuth'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `press flex-1 flex flex-col items-center justify-center gap-0.5 rounded-3xl transition-colors ${
    isActive
      ? 'bg-brand-100 text-accent-text font-medium'
      : 'text-text-steel font-medium hover:text-text-primary'
  }`

const topLinkClass = ({ isActive }: { isActive: boolean }) =>
  `press h-10 px-3 hidden md:inline-flex items-center rounded-[10px] text-sm font-medium transition-colors ${
    isActive ? 'bg-card-raised text-text-primary' : 'text-text-steel hover:bg-card-raised hover:text-text-primary'
  }`

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin } = useAuth()
  return (
    <div className="min-h-screen bg-navy pb-24 md:pb-8">
      <header className="sticky top-0 z-10 bg-navy border-b border-border">
        <div className={`${PAGE_WIDTH} mx-auto px-4 h-14 flex items-center gap-1`}>
          <div className="flex items-center gap-2.5 mr-3">
            <BrandDot />
            <span className="font-heading font-semibold text-base tracking-tight text-text-primary">Admin</span>
          </div>
          <NavLink to="/admin" end className={topLinkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/admin/tournaments/new" className={topLinkClass}>
            New tournament
          </NavLink>
          {isSuperAdmin && (
            <NavLink to="/admin/admins" className={topLinkClass}>
              Admins
            </NavLink>
          )}
          <NavLink to="/admin/account" className={topLinkClass}>
            Account
          </NavLink>
          <span className="flex-1" />
          <ThemeToggle />
          <Link
            to="/"
            className="press h-10 px-3 inline-flex items-center rounded-[10px] text-sm font-medium text-text-steel hover:bg-card-raised hover:text-text-primary"
          >
            Public site
          </Link>
        </div>
      </header>
      <main className={`${PAGE_WIDTH} mx-auto px-4 py-6 sm:py-8`}>{children}</main>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-10 px-4 pb-3 pt-2">
        <div className="max-w-lg mx-auto">
          <div className="flex h-[60px] gap-1.5 p-1.5 bg-navy-section/90 backdrop-blur rounded-[30px] border border-border shadow-[var(--shadow-pop)]">
            <NavLink to="/admin" end className={tabClass}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect width="7" height="9" x="3" y="3" rx="1" />
                <rect width="7" height="5" x="14" y="3" rx="1" />
                <rect width="7" height="9" x="14" y="12" rx="1" />
                <rect width="7" height="5" x="3" y="16" rx="1" />
              </svg>
              <span className="text-xs">Dashboard</span>
            </NavLink>
            <NavLink to="/admin/tournaments/new" className={tabClass}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12h8" />
                <path d="M12 8v8" />
              </svg>
              <span className="text-xs">New</span>
            </NavLink>
          </div>
        </div>
      </nav>
    </div>
  )
}
