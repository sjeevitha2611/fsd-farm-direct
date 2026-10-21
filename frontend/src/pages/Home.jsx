import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard.jsx'
import { getProducts } from '../services/api.js'

function Home() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getProducts()
      .then((result) => { if (active) setProducts(result.slice(0, 3)) })
      .catch(() => { if (active) setError('Seasonal products are temporarily unavailable.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return (
    <>
      <section className="home-hero">
        <img
          className="hero-image"
          src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=2200&q=85"
          alt="Rows of crops growing across a green farm"
        />
        <div className="hero-shade" />
        <div className="hero-content">
          <p className="eyebrow hero-eyebrow">Grown nearby. Shared with care.</p>
          <h1>Closer to the<br />good stuff.</h1>
          <p className="hero-description">Meet the growers behind your everyday harvest, and bring the best of the season home.</p>
          <Link className="button button-light" to="/products">Explore the harvest <span aria-hidden="true">→</span></Link>
        </div>
        <span className="hero-caption">A better kind of local market</span>
      </section>

      <section className="intro-strip" aria-label="Marketplace values">
        <p><span>01</span> Grown with intention</p>
        <p><span>02</span> Sourced close to home</p>
        <p><span>03</span> Shared at a fair price</p>
      </section>

      <section className="featured-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">In season now</p>
            <h2>A little goodness<br className="mobile-break" /> from the fields.</h2>
          </div>
          <Link className="text-link" to="/products">View all products <span aria-hidden="true">↗</span></Link>
        </div>
        {loading ? <p className="product-state" role="status">Loading the local harvest…</p> : error ? (
          <p className="product-state product-state-error" role="alert">{error}</p>
        ) : products.length === 0 ? (
          <p className="product-state">No products available yet.</p>
        ) : (
          <div className="product-grid">
            {products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        )}
      </section>
    </>
  )
}

export default Home