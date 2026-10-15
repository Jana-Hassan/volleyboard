import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface NavbarProps {
  breadcrumbs?: { label: string; path?: string }[]
}

const Navbar = ({ breadcrumbs = [] }: NavbarProps) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const current = breadcrumbs[breadcrumbs.length - 1]
  const back = [...breadcrumbs].reverse().find(c => c.path)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="shrink-0 h-12 md:h-14 border-b border-line px-4 md:px-6 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm min-w-0">
        <button type="button" onClick={() => navigate('/dashboard')} className="text-white font-bold tracking-tight hover:text-opp transition-motion-fast shrink-0 pointer-coarse:min-h-11">
          Volley<span className="text-us">Board</span>
        </button>

        <div className="hidden md:flex items-center gap-2 min-w-0">
          {breadcrumbs.map((crumb, index) => (
            <span key={index} className="flex items-center gap-2 min-w-0">
              <span className="text-line">/</span>
              {crumb.path ? (
                <button type="button" onClick={() => navigate(crumb.path!)} className="text-muted hover:text-white transition-motion-fast truncate">
                  {crumb.label}
                </button>
              ) : (
                <span className="text-white truncate">{crumb.label}</span>
              )}
            </span>
          ))}
        </div>

        {current && (
          <div className="md:hidden flex items-center gap-1 min-w-0">
            {back && (
              <button type="button" onClick={() => navigate(back.path!)} aria-label={`Back to ${back.label}`} className="text-muted hover:text-white px-2 pointer-coarse:min-h-11">‹</button>
            )}
            <span className="text-white truncate">{current.label}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <span className="hidden md:inline text-muted text-sm">{user?.name}</span>
        <button type="button" onClick={handleLogout} className="text-muted text-sm hover:text-white transition-motion-fast pointer-coarse:min-h-11">
          Sign out
        </button>
      </div>
    </header>
  )
}

export default Navbar
