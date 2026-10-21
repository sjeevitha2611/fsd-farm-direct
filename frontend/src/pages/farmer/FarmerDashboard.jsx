import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/useAuth.js'
import {
  createProduct,
  deleteProduct,
  getFarmerOrders,
  getFarmerProducts,
  updateProduct,
} from '../../services/api.js'

const emptyForm = { name: '', description: '', category: '', price: '', quantity: '', unit: '', image_url: '' }

function FarmerDashboard() {
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const refresh = useCallback(async () => {
    setError('')
    try {
      const [productData, orderData] = await Promise.all([getFarmerProducts(), getFarmerOrders()])
      setProducts(productData)
      setOrders(orderData)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load your farm dashboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([getFarmerProducts(), getFarmerOrders()])
      .then(([productData, orderData]) => {
        if (!active) return
        setProducts(productData)
        setOrders(orderData)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Could not load your farm dashboard.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
  }, [imagePreview])

  async function submitProduct(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        quantity: Number(form.quantity),
        description: form.description || null,
        image_url: form.image_url || null,
        ...(imageFile ? { image_file: imageFile } : {}),
      }
      if (editingId) await updateProduct(editingId, payload)
      else await createProduct(payload)
      setSuccess(editingId ? 'Product updated.' : 'Product added.')
      setForm(emptyForm)
      setImageFile(null)
      setImagePreview('')
      setEditingId(null)
      await refresh()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save the product.')
    } finally {
      setSaving(false)
    }
  }

  function beginEdit(product) {
    setEditingId(product.id)
    setForm({
      name: product.name,
      description: product.description || '',
      category: product.category,
      price: product.price,
      quantity: product.quantity,
      unit: product.unit,
      image_url: product.image_url || '',
    })
    setImageFile(null)
    setImagePreview('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function selectImage(event) {
    const selected = event.target.files?.[0]
    if (!selected) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) {
      setError('Choose a JPG, JPEG, PNG, or WEBP image.')
      event.target.value = ''
      return
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError('Choose an image that is 5 MB or smaller.')
      event.target.value = ''
      return
    }
    setError('')
    setImageFile(selected)
    setImagePreview(URL.createObjectURL(selected))
  }

  async function deactivate(product) {
    if (!window.confirm(`Remove ${product.name} from availability?`)) return
    setError('')
    try {
      await deleteProduct(product.id)
      setSuccess('Product marked unavailable.')
      await refresh()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not deactivate the product.')
    }
  }

  return (
    <section className="featured-section commerce-page">
      <p className="eyebrow">Grower workspace</p>
      <h2>Welcome, {user?.name || 'Farmer'}</h2>
      {error && <p className="product-state product-state-error" role="alert">{error}</p>}
      {success && <p className="success-message" role="status">{success}</p>}
      <div className="farmer-dashboard-grid">
        <form className="site-form product-editor" onSubmit={submitProduct}>
          <h3>{editingId ? 'Edit product' : 'Add a product'}</h3>
          <label>Name<input required maxLength="160" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Category<input required maxLength="100" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
          <label>Description<textarea rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <div className="form-row"><label>Price<input required type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label><label>Quantity<input required type="number" min="0" step="0.01" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label></div>
          <label>Unit<input required maxLength="40" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="kg" /></label>
          <label>Product image<input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={selectImage} /> <span className="optional-label">JPG, JPEG, PNG, or WEBP · up to 5 MB</span></label>
          {(imagePreview || form.image_url) && <div className="image-upload-preview"><img src={imagePreview || form.image_url} alt="Selected product preview" /><button type="button" className="text-button remove-button" onClick={() => { setImageFile(null); setImagePreview(''); setForm({ ...form, image_url: '' }) }}>Remove image</button></div>}
          <div className="form-actions"><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add product'}</button>{editingId && <button className="button button-outline" type="button" onClick={() => { setEditingId(null); setForm(emptyForm); setImageFile(null); setImagePreview('') }}>Cancel edit</button>}</div>
        </form>
        <div className="farmer-products">
          <h3>Your products</h3>
          {loading ? <p className="product-state">Loading products…</p> : products.length === 0 ? <p className="muted-copy">Your product listings will appear here.</p> : products.map((product) => (
            <article className="farmer-product-row" key={product.id}>
              <div><strong>{product.name}</strong><p>{product.category} · ₹{Number(product.price).toFixed(2)} / {product.unit} · {product.quantity} {product.unit}</p><span className="availability-badge">{product.availability}</span></div>
              <div className="row-actions"><button className="text-button" type="button" onClick={() => beginEdit(product)}>Edit</button>{product.availability === 'AVAILABLE' && <button className="text-button remove-button" type="button" onClick={() => deactivate(product)}>Deactivate</button>}</div>
            </article>
          ))}
        </div>
      </div>
      <h3 className="subsection-title">Orders containing your products</h3>
      {orders.length === 0 ? <p className="muted-copy">Orders for your products will appear here.</p> : <div className="order-list">{orders.map((order) => <article className="order-card" key={order.id}><div className="order-card-heading"><strong>Order #{order.id} · {order.customer_name}</strong><span className="availability-badge">{order.status}</span></div>{order.items.map((item) => <p key={item.id}>{item.product_name} × {item.quantity} {item.unit}</p>)}</article>)}</div>}
    </section>
  )
}

export default FarmerDashboard