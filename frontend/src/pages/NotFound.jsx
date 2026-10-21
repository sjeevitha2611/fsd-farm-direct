import { Link } from 'react-router-dom'

function NotFound() {
  return <section className="placeholder-page"><p className="eyebrow">404 · Nothing growing here</p><h1>Page not found</h1><p>The page you were looking for may have moved.</p><Link className="text-link" to="/">Back to home <span aria-hidden="true">↗</span></Link></section>
}

export default NotFound