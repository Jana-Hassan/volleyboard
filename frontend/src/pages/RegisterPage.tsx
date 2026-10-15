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
    <div className="h-dvh overflow-hidden bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="mb-10 text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Volley<span className="text-us">Board</span>
          </h1>
          <p className="text-muted text-sm mt-2">
            Create your coaching account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Your full name"
              className="w-full bg-card border border-line text-white placeholder-muted rounded px-4 py-3 text-sm focus:outline-none focus:border-us transition-motion-fast"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-muted mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="coach@team.com"
              className="w-full bg-card border border-line text-white placeholder-muted rounded px-4 py-3 text-sm focus:outline-none focus:border-us transition-motion-fast"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-muted mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Min 8 characters"
              className="w-full bg-card border border-line text-white placeholder-muted rounded px-4 py-3 text-sm focus:outline-none focus:border-us transition-motion-fast"
            />
          </div>

          {error && (
            <p className="text-opp text-sm">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-us text-white py-3 rounded text-sm font-medium tracking-wide hover:bg-us-hover transition-motion-fast disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-muted text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-us hover:text-libero transition-motion-fast">
            Sign in
          </Link>
        </p>

      </div>
    </div>
  )
}

export default RegisterPage