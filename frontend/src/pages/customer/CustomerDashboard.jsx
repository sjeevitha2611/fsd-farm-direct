import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/useAuth.js'
import { getCart, getOrders } from '../../services/api.js'

function CustomerDashboard() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [cartCount, setCartCount] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getOrders(), getCart()])
      .then(([orderData, cart]) => {
        setOrders(orderData)
        setCartCount(cart.items.length)
      })
      .catch((requestError) => setError(requestError.response?.data?.message || 'Could not load your account summary.'))
  }, [])

  const pendingOrders = orders.filter((order) => !['DELIVERED', 'CANCELLED'].includes(order.status))

  return (
    <section className="featured-section commerce-page">
      <p className="eyebrow">Your Farm Direct account</p>
      <h2>Welcome, {user?.name || 'Customer'}</h2>
      {error && <p className="product-state product-state-error" role="alert">{error}</p>}
      <div className="dashboard-stats"><article><span>Total orders</span><strong>{orders.length}</strong></article><article><span>In progress</span><strong>{pendingOrders.length}</strong></article><article><span>Cart items</span><strong>{cartCount}</strong></article></div>
      <div className="dashboard-links"><Link className="button button-primary" to="/products">Browse products</Link><Link className="button button-outline" to="/cart">View cart</Link><Link className="button button-outline" to="/orders">All orders</Link></div>
      <h3 className="subsection-title">Recent orders</h3>
      {orders.length === 0 ? <p className="muted-copy">Your orders will appear here after checkout.</p> : <div className="order-list">{orders.slice(0, 3).map((order) => <article className="order-card compact-order" key={order.id}><p>Order #{order.id} <span className="availability-badge">{order.status}</span></p><strong>₹{Number(order.total_amount).toFixed(2)}</strong></article>)}</div>}
    </section>
  )
}

export default CustomerDashboard