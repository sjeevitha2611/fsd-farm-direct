import { useEffect, useMemo, useState } from 'react'
import { AuthContext } from './AuthContextStore.js'
import api from '../services/api.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(window.localStorage.getItem('farm-direct-token')))

  useEffect(() => {
    const token = window.localStorage.getItem('farm-direct-token')
    if (!token) return

    api.get('/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => {
        window.localStorage.removeItem('farm-direct-token')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    async login(credentials) {
      const { data } = await api.post('/auth/login', credentials)
      window.localStorage.setItem('farm-direct-token', data.token)
      setUser(data.user)
      return data.user
    },
    async register(details) {
      const { data } = await api.post('/auth/register', details)
      return data.user
    },
    logout() {
      window.localStorage.removeItem('farm-direct-token')
      setUser(null)
    },
  }), [user, loading])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
