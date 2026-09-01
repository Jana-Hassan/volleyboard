import { createContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { User } from '../types'
import api from '../lib/api'

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')

    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
    }

    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password })
    const { token: newToken, user: newUser } = response.data

    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(newUser))

    setToken(newToken)
    setUser(newUser)
  }

  const register = async (name: string, email: string, password: string) => {
    const response = await api.post('/auth/register', { name, email, password })
    const { token: newToken, user: newUser } = response.data

    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(newUser))

    setToken(newToken)
    setUser(newUser)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}