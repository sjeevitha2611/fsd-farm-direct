import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(form)
      const dashboard = user.role === 'admin'
        ? '/admin/dashboard'
        : user.role === 'farmer'
          ? '/farmer/dashboard'
          : '/customer/dashboard'
      navigate(location.state?.from || dashboard, { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to sign in. Check your details and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="auth-page">
      <p className="eyebrow">Welcome back</p>
      <h1>Login</h1>
      {location.state?.registered && <p className="success-message">Account created. Sign in to continue.</p>}
      <form className="site-form" onSubmit={handleSubmit}>
        <label>Email<input autoComplete="email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>Password<input autoComplete="current-password" type="password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="auth-prompt">New to Farm Direct? <Link to="/register">Create an account</Link></p>
    </section>
  )
}

export default Login