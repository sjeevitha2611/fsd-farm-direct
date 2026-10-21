import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { addCartItem, getImageUrl, getProduct, getProductReviews, submitProductReview } from '../services/api.js'

function ProductDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [reviews, setReviews] = useState({ reviews: [], review_count: 0, average_rating: 0 })
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' })
  const [feedback, setFeedback] = useState('')
  const [reviewError, setReviewError] = useState('')

  useEffect(() => {
    let isCurrent = true

    async function loadProduct() {
      setLoading(true)
      setProduct(null)
      setError('')
      setNotFound(false)

      try {
        const [result, reviewData] = await Promise.all([getProduct(id), getProductReviews(id)])
        if (isCurrent) setProduct(result)
        if (isCurrent) setReviews(reviewData)
      } catch (requestError) {
        if (!isCurrent) return
        if (requestError.response?.status === 404) {
          setNotFound(true)
        } else {
          setError('We could not load this product right now. Please try again later.')
        }
      } finally {
        if (isCurrent) setLoading(false)
      }
    }

    loadProduct()
    return () => {
      isCurrent = false
    }
  }, [id])

  async function handleAddToCart() {
    setFeedback('')
    try {
      const result = await addCartItem(product.id, 1)
      setFeedback(result.message || 'Added to cart')
    } catch (requestError) {
      setFeedback(requestError.response?.data?.message || 'Could not add this product to your cart.')
    }
  }

  async function handleReviewSubmit(event) {
    event.preventDefault()
    setReviewError('')
    try {
      const result = await submitProductReview(id, reviewForm)
      setReviews(result)
      setFeedback('Your review has been saved.')
    } catch (requestError) {
      setReviewError(requestError.response?.data?.message || 'Your review could not be saved.')
    }
  }

  if (loading) {
    return <section className="placeholder-page product-detail-page"><p className="product-state" role="status">Loading product…</p></section>
  }
  if (error) {
    return <section className="placeholder-page product-detail-page"><p className="product-state product-state-error" role="alert">{error}</p></section>
  }
  if (notFound || !product) {
    return (
      <section className="placeholder-page product-detail-page">
        <p className="eyebrow">From the farm</p>
        <h1>Product not found</h1>
        <p>We couldn’t find that product. It may no longer be available.</p>
      </section>
    )
  }

  const image = getImageUrl(product.image_url || product.image)

  return (
    <section className="product-detail-page">
      <div className="product-detail-image">
        {image ? (
          <img src={image} alt={product.name} />
        ) : (
          <span className="product-image-placeholder" aria-hidden="true">{product.name.slice(0, 1)}</span>
        )}
      </div>
      <div className="product-detail-copy">
        <p className="eyebrow">{product.category}</p>
        <h1>{product.name}</h1>
        <p className="product-detail-price">₹{Number(product.price).toFixed(2)} <span>/ {product.unit}</span></p>
        <p className="product-detail-quantity">{product.quantity} {product.unit} available</p>
        {product.description && <p className="product-detail-description">{product.description}</p>}
        <span className="availability-badge">{product.availability}</span>
        {user?.role === 'customer' && (
          <button className="button button-primary detail-add-button" type="button" disabled={product.availability !== 'AVAILABLE' || Number(product.quantity) <= 0} onClick={handleAddToCart}>Add to cart</button>
        )}
        {feedback && <p className="inline-feedback" role="status">{feedback}</p>}
      </div>
      <section className="reviews-section">
        <p className="eyebrow">Community notes</p>
        <h2>Reviews <span>({reviews.review_count})</span></h2>
        <p className="review-average">{Number(reviews.average_rating).toFixed(1)} / 5 average rating</p>
        {user?.role === 'customer' && (
          <form className="site-form review-form" onSubmit={handleReviewSubmit}>
            <label>Rating<select value={reviewForm.rating} onChange={(event) => setReviewForm({ ...reviewForm, rating: Number(event.target.value) })}>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label>
            <label>Your review<textarea rows="3" maxLength="5000" value={reviewForm.comment} onChange={(event) => setReviewForm({ ...reviewForm, comment: event.target.value })} /></label>
            {reviewError && <p className="form-error" role="alert">{reviewError}</p>}
            <button className="button button-primary">Submit review</button>
          </form>
        )}
        {reviews.reviews.length === 0 ? <p className="muted-copy">No reviews yet.</p> : (
          <div className="review-list">
            {reviews.reviews.map((review) => <article className="review-card" key={review.id}><strong>{review.customer_name} · {review.rating}/5</strong>{review.comment && <p>{review.comment}</p>}</article>)}
          </div>
        )}
      </section>
    </section>
  )
}

export default ProductDetails