import { Link } from 'react-router-dom'

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <Link className="footer-brand" to="/">Farm Direct</Link>
        <p>Good food has a shorter journey.</p>
        <span className="footer-note">A marketplace for local harvests</span>
      </div>
    </footer>
  )
}

export default Footer