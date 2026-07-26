import { Link, NavLink } from 'react-router-dom'
import { BrandDot } from './ui/primitives'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex-1 flex flex-col items-center justify-center gap-0.5 rounded-3xl transition-colors ${
    isActive
      ? 'bg-brand-100 text-brand-500 font-bold'
      : 'text-text-steel font-semibold hover:text-text-bluewhite'
  }`

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-navy pb-24">
      <header className="sticky top-0 z-10 bg-navy-section border-b border-border">
        <div className="max-w-lg mx-auto px-4 h-[52px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandDot />
            <span className="font-heading font-extrabold text-[17px] text-text-primary">Admin</span>
          </div>
          <Link
            to="/"
            className="text-sm font-semibold text-text-steel hover:text-text-bluewhite transition-colors"
          >
            Public site
          </Link>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-4">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-10 px-4 pb-3 pt-2">
        <div className="max-w-lg mx-auto">
          <div className="flex h-[60px] gap-1.5 p-1.5 bg-navy-section/90 backdrop-blur rounded-[30px] border border-border shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
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
              <span className="text-[11px]">Dashboard</span>
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
              <span className="text-[11px]">New</span>
            </NavLink>
          </div>
        </div>
      </nav>
    </div>
  )
}
