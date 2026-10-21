import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { clearCart, getCart, getImageUrl, removeCartItem, updateCartItem } from '../services/api.js'

function Cart() {
  const [cart, setCart] = useState({ items: [], total: '0.00' })
  const [loading, setLoading] = useState(true)
  const [busyItem, setBusyItem] = useState(null)
  const [error, setError] = useState('')

  const refreshCart = useCallback(async () => {
    setError('')
    try {
      setCart(await getCart())
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Your cart could not be loaded. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    getCart()
      .then((data) => { if (active) setCart(data) })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Your cart could not be loaded. Please try again.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function changeQuantity(item, delta) {
    const nextQuantity = Number(item.selected_quantity) + delta
    if (nextQuantity <= 0 || nextQuantity > Number(item.available_quantity)) return
    setBusyItem(item.item_id)
    setError('')
    try {
      await updateCartItem(item.item_id, nextQuantity)
      await refreshCart()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'The quantity could not be updated.')
    } finally {
      setBusyItem(null)
    }
  }

  async function removeItem(itemId) {
    setBusyItem(itemId)
    setError('')
    try {
      await removeCartItem(itemId)
      await refreshCart()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'The item could not be removed.')
    } finally {
      setBusyItem(null)
    }
  }

  async function handleClear() {
    setBusyItem('all')
    setError('')
    try {
      await clearCart()
      await refreshCart()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Your cart could not be cleared.')
    } finally {
      setBusyItem(null)
    }
  }

  if (loading) return <section className="featured-section"><p className="product-state" role="status">Loading your cart…</p></section>

  return (
    <section className="featured-section commerce-page">
      <div className="section-heading"><div><p className="eyebrow">Your basket</p><h2>Shopping cart</h2></div></div>
      {error && <p className="product-state product-state-error" role="alert">{error}</p>}
      {cart.items.length === 0 ? (
        <div className="empty-commerce"><p>Your cart is empty.</p><Link className="button button-primary" to="/products">Continue shopping</Link></div>
      ) : (
        <div className="cart-layout">
          <div className="cart-items">
            {cart.items.map((item) => (
              <article className="cart-item" key={item.item_id}>
                <Link to={`/products/${item.product_id}`} className="cart-item-image">
                  {item.image_url ? <img src={getImageUrl(item.image_url)} alt={item.name} /> : <span className="product-image-placeholder">{item.name.slice(0, 1)}</span>}
                </Link>
                <div className="cart-item-info">
                  <h3><Link to={`/products/${item.product_id}`}>{item.name}</Link></h3>
                  <p>₹{Number(item.price).toFixed(2)} / {item.unit}</p>
                  <p className="muted-copy">{item.available_quantity} {item.unit} available</p>
                  <div className="quantity-control">
                    <button type="button" aria-label={`Decrease ${item.name} quantity`} disabled={busyItem === item.item_id || Number(item.selected_quantity) <= 1} onClick={() => changeQuantity(item, -1)}>−</button>
                    <span>{item.selected_quantity} {item.unit}</span>
                    <button type="button" aria-label={`Increase ${item.name} quantity`} disabled={busyItem === item.item_id || Number(item.selected_quantity) >= Number(item.available_quantity)} onClick={() => changeQuantity(item, 1)}>+</button>
                    <button className="text-button remove-button" type="button" disabled={busyItem === item.item_id} onClick={() => removeItem(item.item_id)}>Remove</button>
                  </div>
                </div>
                <strong className="cart-item-subtotal">₹{Number(item.subtotal).toFixed(2)}</strong>
              </article>
            ))}
          </div>
          <aside className="cart-summary">
            <h3>Order summary</h3>
            <p><span>Total</span><strong>₹{Number(cart.total).toFixed(2)}</strong></p>
            <Link className="button button-primary button-full" to="/checkout">Proceed to checkout</Link>
            <Link className="text-link" to="/products">Continue shopping</Link>
            <button className="text-button clear-cart-button" type="button" disabled={busyItem === 'all'} onClick={handleClear}>Clear cart</button>
          </aside>
        </div>
      )}
    </section>
  )
}

export default Cart