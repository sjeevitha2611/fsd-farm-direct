export function idString(value) {
  if (value === null || value === undefined) return null
  return String(value._id ?? value)
}

export function formatAmount(value) {
  return Number(value ?? 0).toFixed(2)
}

export function serializeUser(user) {
  return {
    id: idString(user._id ?? user.id),
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role: user.role,
    created_at: user.created_at,
    updated_at: user.updated_at,
  }
}

export function serializeProduct(product) {
  return {
    id: idString(product._id ?? product.id),
    farmer_id: idString(product.farmer_id),
    name: product.name,
    description: product.description ?? null,
    category: product.category,
    price: formatAmount(product.price),
    quantity: formatAmount(product.quantity),
    unit: product.unit,
    image_url: product.image ?? product.image_url ?? null,
    availability: product.availability,
    created_at: product.created_at,
    updated_at: product.updated_at,
  }
}

export function serializeOrder(order, customerName = order.customer_name) {
  const items = (order.items ?? []).map((item) => ({
    id: idString(item._id ?? item.id),
    product_id: idString(item.product_id),
    product_name: item.product_name,
    image_url: item.image_url ?? null,
    quantity: formatAmount(item.quantity),
    price: formatAmount(item.price),
    subtotal: formatAmount(Number(item.quantity) * Number(item.price)),
    unit: item.unit,
    farmer_id: idString(item.farmer_id),
  }))

  return {
    id: idString(order._id ?? order.id),
    customer_id: idString(order.customer_id),
    customer_name: customerName,
    total_amount: formatAmount(order.total_amount),
    address: order.address,
    order_date: order.order_date,
    status: order.status,
    items,
  }
}
