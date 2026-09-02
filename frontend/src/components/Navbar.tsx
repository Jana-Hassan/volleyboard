import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface NavbarProps {
  breadcrumbs?: { label: string; path?: string }[]
}

const Navbar = ({ breadcrumbs = [] }: NavbarProps) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="border-b border-[#0f2d30] px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm">
        <span
          onClick={() => navigate('/dashboard')}
          className="text-white font-bold tracking-tight cursor-pointer hover:text-[#8BBB92] transition-colors"
        >
          Volley<span className="text-[#2A835F]">Board</span>
        </span>

        {breadcrumbs.map((crumb, index) => (
          <span key={index} className="flex items-center gap-2">
            <span className="text-[#0f2d30]">/</span>
            {crumb.path ? (
              <span
                onClick={() => navigate(crumb.path!)}
                className="text-[#4a6b6b] hover:text-white cursor-pointer transition-colors"
              >
                {crumb.label}
              </span>
            ) : (
              <span className="text-white">{crumb.label}</span>
            )}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <span className="text-[#4a6b6b] text-sm">{user?.name}</span>
        <button
          onClick={handleLogout}
          className="text-[#4a6b6b] text-sm hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

export default Navbar