import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getOrders } from '../services/api.js'

function Orders() {
  const location = useLocation()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getOrders()
      .then(setOrders)
      .catch((requestError) => setError(requestError.response?.data?.message || 'Could not load your orders.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="featured-section commerce-page">
      <div className="section-heading"><div><p className="eyebrow">Your order history</p><h2>Orders</h2></div></div>
      {location.state?.placedOrder && <p className="success-message" role="status">Order #{location.state.placedOrder} was placed successfully.</p>}
      {loading ? <p className="product-state" role="status">Loading your orders…</p> : error ? <p className="product-state product-state-error" role="alert">{error}</p> : orders.length === 0 ? (
        <div className="empty-commerce"><p>You haven’t placed an order yet.</p><Link className="button button-primary" to="/products">Browse products</Link></div>
      ) : (
        <div className="order-list">
          {orders.map((order) => (
            <article className="order-card" key={order.id}>
              <div className="order-card-heading"><div><p className="eyebrow">Order #{order.id}</p><p>{new Date(order.order_date).toLocaleString()}</p></div><span className="availability-badge">{order.status}</span></div>
              <p className="order-address">{order.address}</p>
              <div className="order-lines">{order.items.map((item) => <p key={item.id}><span>{item.product_name} × {item.quantity} {item.unit}</span><strong>₹{Number(item.subtotal).toFixed(2)}</strong></p>)}</div>
              <p className="order-total"><span>Order total</span><strong>₹{Number(order.total_amount).toFixed(2)}</strong></p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default Orders