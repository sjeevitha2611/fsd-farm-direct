import pool from '../config/db.js'

export async function getOverview(request, response) {
  try {
    const [[users]] = await pool.execute('SELECT COUNT(*) AS total FROM users')
    const [[products]] = await pool.execute(
      `SELECT COUNT(*) AS total,
              SUM(availability = 'AVAILABLE') AS available
       FROM products`,
    )
    const [[orders]] = await pool.execute(
      `SELECT COUNT(*) AS total,
              SUM(status IN ('PLACED', 'CONFIRMED', 'PREPARING')) AS pending
       FROM orders`,
    )
    const [[sales]] = await pool.execute(
      `SELECT COALESCE(SUM(total_amount), 0) AS total
       FROM orders WHERE status != 'CANCELLED'`,
    )
    return response.json({
      success: true,
      message: 'Admin overview retrieved',
      data: {
        users: Number(users.total),
        products: Number(products.total),
        available_products: Number(products.available || 0),
        orders: Number(orders.total),
        pending_orders: Number(orders.pending || 0),
        sales: sales.total,
      },
    })
  } catch (error) {
    console.error('Failed to retrieve admin overview:', error)
    return response.status(500).json({ success: false, message: 'Failed to retrieve admin overview', data: null })
  }
}

export async function listUsers(request, response) {
  try {
    const [users] = await pool.execute(
      'SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC, id DESC',
    )
    return response.json({ success: true, message: 'Users retrieved', data: users })
  } catch (error) {
    console.error('Failed to retrieve users:', error)
    return response.status(500).json({ success: false, message: 'Failed to retrieve users', data: null })
  }
}

export async function listProducts(request, response) {
  try {
    const [products] = await pool.execute(
      `SELECT id, farmer_id, name, description, category, price, quantity, unit,
              image AS image_url, availability, created_at, updated_at
       FROM products ORDER BY created_at DESC, id DESC`,
    )
    return response.json({ success: true, message: 'Products retrieved', data: products })
  } catch (error) {
    console.error('Failed to retrieve admin products:', error)
    return response.status(500).json({ success: false, message: 'Failed to retrieve products', data: null })
  }
}
