import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

function Navbar() {
  const { user, logout } = useAuth()
  const navigation = [
    { to: '/', label: 'Home', end: true },
    { to: '/products', label: 'Products' },
    ...(user
      ? user.role === 'customer'
        ? [
            { to: '/cart', label: 'Cart' },
            { to: '/orders', label: 'Orders' },
            { to: '/customer/dashboard', label: 'Dashboard' },
          ]
        : [{ to: `/${user.role}/dashboard`, label: `${user.role[0].toUpperCase()}${user.role.slice(1)} dashboard` }]
      : [
          { to: '/login', label: 'Login' },
          { to: '/register', label: 'Register' },
        ]),
  ]

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/" aria-label="Farm Direct home">
          <span className="brand-mark" aria-hidden="true">FD</span>
          <span>Farm <strong>Direct</strong></span>
        </Link>
        <nav className="primary-nav" aria-label="Main navigation">
          {navigation.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => isActive ? 'nav-link is-active' : 'nav-link'}
            >
              {label}
            </NavLink>
          ))}
          {user && <button type="button" className="nav-link nav-button" onClick={logout}>Logout</button>}
        </nav>
      </div>
    </header>
  )
}

export default Navbar