import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem('farm-direct-token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export async function getProducts() {
  const response = await api.get('/products')
  return response.data.data
}

export function getImageUrl(imageUrl) {
  if (!imageUrl || /^https?:\/\//i.test(imageUrl)) return imageUrl || ''
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
  return `${apiBase.replace(/\/api\/?$/, '')}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`
}

export async function getProduct(id) {
  const response = await api.get(`/products/${encodeURIComponent(id)}`)
  return response.data.data
}

export async function getProductReviews(id) {
  const { data } = await api.get(`/reviews/products/${encodeURIComponent(id)}`)
  return data.data
}

export async function submitProductReview(id, review) {
  const { data } = await api.post(`/reviews/products/${encodeURIComponent(id)}`, review)
  return data.data
}

export async function getCart() {
  const { data } = await api.get('/cart')
  return data.data
}

export async function addCartItem(productId, quantity = 1) {
  const { data } = await api.post('/cart', { product_id: productId, quantity })
  return data
}

export async function updateCartItem(itemId, quantity) {
  const { data } = await api.put(`/cart/${encodeURIComponent(itemId)}`, { quantity })
  return data
}

export async function removeCartItem(itemId) {
  const { data } = await api.delete(`/cart/${encodeURIComponent(itemId)}`)
  return data
}

export async function clearCart() {
  const { data } = await api.delete('/cart')
  return data
}

export async function placeOrder(address) {
  const { data } = await api.post('/orders', { address })
  return data.data
}

export async function getOrders() {
  const { data } = await api.get('/orders')
  return data.data
}

export async function getFarmerOrders() {
  const { data } = await api.get('/orders/farmer')
  return data.data
}

export async function getFarmerProducts() {
  const { data } = await api.get('/products/farmer/my-products')
  return data.data
}

function productRequestBody(product) {
  if (!product.image_file) return product

  const formData = new FormData()
  for (const [key, value] of Object.entries(product)) {
    if (key !== 'image_file' && key !== 'image_url' && value !== null && value !== undefined) {
      formData.append(key, value)
    }
  }
  formData.append('image_file', product.image_file)
  return formData
}

export async function createProduct(product) {
  const body = productRequestBody(product)
  const config = body instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
  const { data } = await api.post('/products', body, config)
  return data.data
}

export async function updateProduct(id, product) {
  const body = productRequestBody(product)
  const config = body instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
  const { data } = await api.put(`/products/${encodeURIComponent(id)}`, body, config)
  return data.data
}

export async function deleteProduct(id) {
  const { data } = await api.delete(`/products/${encodeURIComponent(id)}`)
  return data.data
}

export async function getAdminOverview() {
  const { data } = await api.get('/admin/overview')
  return data.data
}

export async function getAdminUsers() {
  const { data } = await api.get('/admin/users')
  return data.data
}

export async function getAdminProducts() {
  const { data } = await api.get('/admin/products')
  return data.data
}

export async function getAdminOrders() {
  const { data } = await api.get('/orders/admin')
  return data.data
}

export async function updateOrderStatus(orderId, status) {
  const { data } = await api.patch(`/orders/${encodeURIComponent(orderId)}/status`, { status })
  return data.data
}

export default api