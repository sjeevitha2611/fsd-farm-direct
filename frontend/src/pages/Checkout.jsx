import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCart, placeOrder } from '../services/api.js'

function Checkout() {
  const navigate = useNavigate()
  const [cart, setCart] = useState({ items: [], total: '0.00' })
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getCart()
      .then(setCart)
      .catch((requestError) => setError(requestError.response?.data?.message || 'Could not load your cart.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const order = await placeOrder(address)
      navigate('/orders', { replace: true, state: { placedOrder: order.id } })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Your order could not be placed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <section className="featured-section"><p className="product-state" role="status">Preparing checkout…</p></section>
  if (error && cart.items.length === 0) return <section className="featured-section"><p className="product-state product-state-error" role="alert">{error}</p><Link className="text-link" to="/cart">Back to cart</Link></section>
  if (cart.items.length === 0) return <section className="featured-section"><p className="eyebrow">Almost there</p><h2>Your cart is empty</h2><Link className="button button-primary" to="/products">Continue shopping</Link></section>

  return (
    <section className="featured-section commerce-page">
      <div className="section-heading"><div><p className="eyebrow">Almost there</p><h2>Checkout</h2></div></div>
      <div className="checkout-layout">
        <form className="site-form checkout-form" onSubmit={handleSubmit}>
          <h3>Delivery address</h3>
          <label>Address<textarea required rows="5" maxLength="5000" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, city, state, postal code" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary" disabled={submitting}>{submitting ? 'Placing order…' : `Place order · ₹${Number(cart.total).toFixed(2)}`}</button>
        </form>
        <aside className="cart-summary">
          <h3>Review items</h3>
          {cart.items.map((item) => <p className="checkout-line" key={item.item_id}><span>{item.name} × {item.selected_quantity} {item.unit}</span><strong>₹{Number(item.subtotal).toFixed(2)}</strong></p>)}
          <p className="checkout-total"><span>Total</span><strong>₹{Number(cart.total).toFixed(2)}</strong></p>
        </aside>
      </div>
    </section>
  )
}

export default Checkout