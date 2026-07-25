import { Link } from 'react-router-dom'

export function AppLayout({ children, bleed }: { children: React.ReactNode; bleed?: boolean }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="max-w-lg mx-auto px-4 h-[52px] flex items-center justify-between">
          <Link to="/" className="font-heading font-bold text-lg text-brand-700">
            TT Tournaments
          </Link>
          <Link to="/admin" className="text-sm text-slate-500 hover:text-slate-700">
            Admin
          </Link>
        </div>
      </header>
      <main className={`max-w-lg mx-auto ${bleed ? '' : 'px-4 py-6'}`}>{children}</main>
    </div>
  )
}
