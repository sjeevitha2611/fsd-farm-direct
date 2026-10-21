import Order from '../models/Order.js'
import Product from '../models/Product.js'
import User from '../models/User.js'
import { serializeProduct, serializeUser } from '../utils/serializers.js'

function productForResponse(request, product) {
  const serialized = serializeProduct(product)
  if (serialized.image_url?.startsWith('/uploads/')) {
    serialized.image_url = `${request.protocol}://${request.get('host')}${serialized.image_url}`
  }
  return serialized
}

export async function getOverview(request, response) {
  try {
    const [users, products, availableProducts, orders, pendingOrders, sales] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Product.countDocuments({ availability: 'AVAILABLE' }),
      Order.countDocuments(),
      Order.countDocuments({ status: { $in: ['PLACED', 'CONFIRMED', 'PREPARING'] } }),
      Order.aggregate([
        { $match: { status: { $ne: 'CANCELLED' } } },
        { $group: { _id: null, total: { $sum: '$total_amount' } } },
      ]),
    ])
    return response.json({
      success: true,
      message: 'Admin overview retrieved',
      data: {
        users,
        products,
        available_products: availableProducts,
        orders,
        pending_orders: pendingOrders,
        sales: Number((sales[0]?.total ?? 0).toFixed(2)),
      },
    })
  } catch (error) {
    console.error('Failed to retrieve admin overview:', error)
    return response.status(500).json({ success: false, message: 'Failed to retrieve admin overview', data: null })
  }
}

export async function listUsers(request, response) {
  try {
    const users = await User.find().sort({ created_at: -1, _id: -1 }).lean()
    return response.json({
      success: true,
      message: 'Users retrieved',
      data: users.map(serializeUser),
    })
  } catch (error) {
    console.error('Failed to retrieve users:', error)
    return response.status(500).json({ success: false, message: 'Failed to retrieve users', data: null })
  }
}

export async function listProducts(request, response) {
  try {
    const products = await Product.find().sort({ created_at: -1, _id: -1 }).lean()
    return response.json({
      success: true,
      message: 'Products retrieved',
      data: products.map((product) => productForResponse(request, product)),
    })
  } catch (error) {
    console.error('Failed to retrieve admin products:', error)
    return response.status(500).json({ success: false, message: 'Failed to retrieve products', data: null })
  }
}
