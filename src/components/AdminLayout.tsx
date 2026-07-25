import { Link, NavLink } from 'react-router-dom'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex-1 flex flex-col items-center justify-center py-2 text-[13px] transition-colors ${
    isActive ? 'text-brand-600 font-semibold' : 'text-slate-500 font-normal'
  }`

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="sticky top-0 z-10 bg-brand-700">
        <div className="max-w-lg mx-auto px-4 h-[52px] flex items-center justify-between">
          <span className="font-heading font-bold text-lg text-white">Admin</span>
          <Link to="/" className="text-sm text-brand-100 hover:text-white">
            Public site
          </Link>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-4">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200">
        <div className="max-w-lg mx-auto flex h-14 px-4">
          <NavLink to="/admin" end className={tabClass}>
            Dashboard
          </NavLink>
          <NavLink to="/admin/tournaments/new" className={tabClass}>
            New
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
