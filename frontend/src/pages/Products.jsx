import { useEffect, useState } from 'react'
import ProductCard from '../components/ProductCard.jsx'
import { getProducts } from '../services/api.js'

function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  useEffect(() => {
    let isCurrent = true

    async function loadProducts() {
      try {
        const result = await getProducts()
        if (!Array.isArray(result)) {
          throw new Error('Unexpected products response')
        }
        if (isCurrent) setProducts(result)
      } catch {
        if (isCurrent) setError('We could not load products right now. Please try again later.')
      } finally {
        if (isCurrent) setLoading(false)
      }
    }

    loadProducts()
    return () => {
      isCurrent = false
    }
  }, [])

  const categories = [...new Set(products.map((product) => product.category))].sort()
  const filteredProducts = products.filter((product) => (
    product.name.toLowerCase().includes(search.trim().toLowerCase())
    && (!category || product.category === category)
    && (!maxPrice || Number(product.price) <= Number(maxPrice))
    && product.availability === 'AVAILABLE'
  ))

  function clearFilters() {
    setSearch('')
    setCategory('')
    setMaxPrice('')
  }

  return (
    <section className="featured-section products-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">The local harvest</p>
          <h2>Fresh from the farm</h2>
        </div>
        <p className="products-intro">Seasonal produce, grown with care and brought to you directly.</p>
      </div>

      {!loading && !error && products.length > 0 && (
        <div className="product-filters" aria-label="Filter products">
          <label>Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" /></label>
          <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Maximum price<input type="number" min="0" step="0.01" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Any price" /></label>
          <button type="button" className="text-button" onClick={clearFilters}>Clear filters</button>
        </div>
      )}
      {loading ? (
        <p className="product-state" role="status">Loading fresh products…</p>
      ) : error ? (
        <p className="product-state product-state-error" role="alert">{error}</p>
      ) : products.length === 0 ? (
        <p className="product-state">No products available yet.</p>
      ) : filteredProducts.length === 0 ? (
        <p className="product-state">No products match your filters.</p>
      ) : (
        <div className="product-grid">
          {filteredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      )}
    </section>
  )
}

export default Products