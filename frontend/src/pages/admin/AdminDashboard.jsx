import { useCallback, useEffect, useState } from 'react'
import { getAdminOrders, getAdminOverview, getAdminProducts, getAdminUsers, updateOrderStatus } from '../../services/api.js'

const statuses = ['PLACED', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']

function AdminDashboard() {
  const [overview, setOverview] = useState(null)
  const [users, setUsers] = useState([])
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const refresh = useCallback(async () => {
    setError('')
    try {
      const [stats, userData, productData, orderData] = await Promise.all([
        getAdminOverview(), getAdminUsers(), getAdminProducts(), getAdminOrders(),
      ])
      setOverview(stats)
      setUsers(userData)
      setProducts(productData)
      setOrders(orderData)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load administration data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([getAdminOverview(), getAdminUsers(), getAdminProducts(), getAdminOrders()])
      .then(([stats, userData, productData, orderData]) => {
        if (!active) return
        setOverview(stats)
        setUsers(userData)
        setProducts(productData)
        setOrders(orderData)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Could not load administration data.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function changeStatus(orderId, status) {
    setError('')
    setSuccess('')
    try {
      await updateOrderStatus(orderId, status)
      setSuccess(`Order #${orderId} status updated.`)
      await refresh()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update order status.')
    }
  }

  return (
    <section className="featured-section commerce-page">
      <p className="eyebrow">Marketplace workspace</p>
      <h2>Admin dashboard</h2>
      {error && <p className="product-state product-state-error" role="alert">{error}</p>}
      {success && <p className="success-message" role="status">{success}</p>}
      {loading ? <p className="product-state">Loading marketplace data…</p> : overview && (
        <>
          <div className="dashboard-stats"><article><span>Users</span><strong>{overview.users}</strong></article><article><span>Products</span><strong>{overview.products}</strong></article><article><span>Available products</span><strong>{overview.available_products}</strong></article><article><span>Orders</span><strong>{overview.orders}</strong></article><article><span>Pending orders</span><strong>{overview.pending_orders}</strong></article><article><span>Sales (non-cancelled)</span><strong>₹{Number(overview.sales).toFixed(2)}</strong></article></div>
          <h3 className="subsection-title">Users</h3>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{user.role}</td><td>{new Date(user.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>
          <h3 className="subsection-title">Products</h3>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Farmer ID</th><th>Price</th><th>Stock</th><th>Status</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td>{product.name}</td><td>{product.farmer_id}</td><td>₹{Number(product.price).toFixed(2)} / {product.unit}</td><td>{product.quantity}</td><td>{product.availability}</td></tr>)}</tbody></table></div>
          <p className="muted-copy admin-note">User deactivation is unavailable because the existing users schema has no active/deactivated status field.</p>
          <h3 className="subsection-title">Orders</h3>
          <div className="order-list">{orders.length === 0 ? <p className="muted-copy">No orders yet.</p> : orders.map((order) => <article className="order-card" key={order.id}><div className="order-card-heading"><div><strong>Order #{order.id} · {order.customer_name}</strong><p>{new Date(order.order_date).toLocaleString()}</p></div><select aria-label={`Status for order ${order.id}`} value={order.status} onChange={(event) => changeStatus(order.id, event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div><p>{order.address}</p><p>₹{Number(order.total_amount).toFixed(2)}</p></article>)}</div>
        </>
      )}
    </section>
  )
}

export default AdminDashboard