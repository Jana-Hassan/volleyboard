import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const RegisterPage = () => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      await register(name, email, password)
      navigate('/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050d0f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="mb-10 text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Volley<span className="text-[#2A835F]">Board</span>
          </h1>
          <p className="text-[#4a6b6b] text-sm mt-2">
            Create your coaching account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-[#4a6b6b] mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Your full name"
              className="w-full bg-[#0a1a1c] border border-[#0f2d30] text-white placeholder-[#4a6b6b] rounded px-4 py-3 text-sm focus:outline-none focus:border-[#2A835F] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-[#4a6b6b] mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="coach@team.com"
              className="w-full bg-[#0a1a1c] border border-[#0f2d30] text-white placeholder-[#4a6b6b] rounded px-4 py-3 text-sm focus:outline-none focus:border-[#2A835F] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-[#4a6b6b] mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Min 8 characters"
              className="w-full bg-[#0a1a1c] border border-[#0f2d30] text-white placeholder-[#4a6b6b] rounded px-4 py-3 text-sm focus:outline-none focus:border-[#2A835F] transition-colors"
            />
          </div>

          {error && (
            <p className="text-[#8B1A2C] text-sm">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2A835F] text-white py-3 rounded text-sm font-medium tracking-wide hover:bg-[#235a45] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-[#4a6b6b] text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-[#2A835F] hover:text-[#8BBB92] transition-colors">
            Sign in
          </Link>
        </p>

      </div>
    </div>
  )
}

export default RegisterPage