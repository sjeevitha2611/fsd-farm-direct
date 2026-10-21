import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import { addCartItem, getImageUrl } from '../services/api.js'

function ProductCard({ product }) {
  const { user } = useAuth()
  const { id, name, category, price, quantity, unit, description, availability } = product
  const image = getImageUrl(product.image_url || product.image)
  const formattedPrice = Number(price).toFixed(2)
  const formattedQuantity = Number(quantity).toFixed(2)
  const [feedback, setFeedback] = useState('')

  async function handleAddToCart() {
    setFeedback('')
    try {
      const result = await addCartItem(id, 1)
      setFeedback(result.message || 'Added to cart')
    } catch (error) {
      setFeedback(error.response?.data?.message || 'Could not add this product to your cart.')
    }
  }

  return (
    <article className="product-card">
      <Link className="product-image-link" to={`/products/${id}`} aria-label={`View ${name}`}>
        {image ? (
          <img className="product-image" src={image} alt={name} />
        ) : (
          <span className="product-image-placeholder" aria-hidden="true">{name.slice(0, 1)}</span>
        )}
      </Link>
      <div className="product-card-copy">
        <span className="product-category">{category}</span>
        <h3><Link to={`/products/${id}`}>{name}</Link></h3>
        {description && <p className="product-description">{description}</p>}
        <p className="product-price">₹{formattedPrice} <span>/ {unit}</span></p>
        <div className="product-card-meta">
          <span>{formattedQuantity} {unit} available</span>
          <span className="availability-badge">{availability}</span>
        </div>
        {user?.role === 'customer' && (
          <button className="button button-primary add-cart-button" type="button" disabled={availability !== 'AVAILABLE' || Number(quantity) <= 0} onClick={handleAddToCart}>
            Add to cart
          </button>
        )}
        {feedback && <p className="inline-feedback" role="status">{feedback}</p>}
      </div>
    </article>
  )
}

export default ProductCard