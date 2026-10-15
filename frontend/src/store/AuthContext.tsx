import { useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '../types'
import api from '../lib/api'
import { AuthContext } from './auth-context'

const readSaved = (): { token: string | null; user: User | null } => {
  const savedToken = localStorage.getItem('token')
  const savedUser = localStorage.getItem('user')
  if (!savedToken || !savedUser) return { token: null, user: null }
  try {
    return { token: savedToken, user: JSON.parse(savedUser) as User }
  } catch {
    return { token: null, user: null }
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [saved] = useState(readSaved)
  const [user, setUser] = useState<User | null>(saved.user)
  const [token, setToken] = useState<string | null>(saved.token)

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
    <AuthContext.Provider value={{ user, token, loading: false, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
