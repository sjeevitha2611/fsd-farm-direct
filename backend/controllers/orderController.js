import Cart from '../models/Cart.js'
import Order, { orderStatuses } from '../models/Order.js'
import Product from '../models/Product.js'
import User from '../models/User.js'
import { serializeOrder } from '../utils/serializers.js'
import { withKeyedLock } from '../utils/keyedLock.js'

class OrderError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function toHundredths(value) {
  return BigInt(Math.round(Number(value) * 100))
}

function formatHundredths(value) {
  return Number(value) / 100
}

function isValidId(id) {
  return typeof id === 'string' && /^[\da-f]{24}$/i.test(id)
}

function errorResponse(response, error, operation) {
  if (error.status) {
    return response.status(error.status).json({ success: false, message: error.message, data: null })
  }
  console.error(`${operation} failed:`, error)
  return response.status(500).json({ success: false, message: `${operation} failed`, data: null })
}

async function createOrderLocked(request, response) {
  const address = request.body?.address
  if (typeof address !== 'string' || !address.trim() || address.trim().length > 65535) {
    return response.status(400).json({ success: false, message: 'A delivery address is required', data: null })
  }

  const reservations = []
  const availabilityChanges = []
  let createdOrder
  let checkoutCart
  let cartItemsSnapshot
  try {
    const cart = await Cart.findOne({ customer_id: request.user.id })
    if (!cart?.items.length) throw new OrderError(400, 'Your cart is empty')
    checkoutCart = cart
    cartItemsSnapshot = cart.items.map((item) => item.toObject())

    const customer = await User.findById(request.user.id)
    if (!customer) throw new OrderError(401, 'Authenticated customer no longer exists')

    const items = []
    let totalCents = 0n
    for (const cartItem of cart.items) {
      const product = await Product.findById(cartItem.product_id)
      if (!product || product.availability !== 'AVAILABLE') {
        throw new OrderError(409, `${product?.name || 'A cart product'} is no longer available`)
      }
      if (toHundredths(cartItem.quantity) > toHundredths(product.quantity)) {
        throw new OrderError(409, `Insufficient stock for ${product.name}`)
      }

      const reservedProduct = await Product.findOneAndUpdate(
        {
          _id: product._id,
          availability: 'AVAILABLE',
          quantity: { $gte: cartItem.quantity },
        },
        { $inc: { quantity: -cartItem.quantity } },
        { returnDocument: 'after' },
      )
      if (!reservedProduct) {
        throw new OrderError(409, `Insufficient stock for ${product.name}`)
      }
      reservations.push({ product_id: product._id, quantity: cartItem.quantity })

      const priceCents = toHundredths(product.price)
      const quantityHundredths = toHundredths(cartItem.quantity)
      totalCents += (priceCents * quantityHundredths + 50n) / 100n
      items.push({
        product_id: product._id,
        product_name: product.name,
        image_url: product.image,
        unit: product.unit,
        farmer_id: product.farmer_id,
        quantity: cartItem.quantity,
        price: product.price,
      })
    }

    createdOrder = await Order.create({
      customer_id: customer._id,
      customer_name: customer.name,
      total_amount: formatHundredths(totalCents),
      address: address.trim(),
      items,
    })

    for (const reservation of reservations) {
      const changedProduct = await Product.findOneAndUpdate(
        { _id: reservation.product_id, quantity: { $lte: 0 }, availability: 'AVAILABLE' },
        { $set: { availability: 'UNAVAILABLE' } },
        { returnDocument: 'after' },
      )
      if (changedProduct) availabilityChanges.push(changedProduct._id)
    }

    cart.items = []
    await cart.save()

    return response.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: serializeOrder(createdOrder),
    })
  } catch (error) {
    if (createdOrder) {
      try {
        await Order.deleteOne({ _id: createdOrder._id })
      } catch (rollbackError) {
        console.error('Failed to remove incomplete order:', rollbackError)
      }
    }

    if (checkoutCart && cartItemsSnapshot) {
      try {
        await Cart.updateOne({ _id: checkoutCart._id }, { $set: { items: cartItemsSnapshot } })
      } catch (rollbackError) {
        console.error('Failed to restore cart after checkout failure:', rollbackError)
      }
    }

    for (const reservation of reservations.reverse()) {
      try {
        await Product.updateOne(
          { _id: reservation.product_id },
          { $inc: { quantity: reservation.quantity } },
        )
      } catch (rollbackError) {
        console.error('Failed to restore reserved product stock:', rollbackError)
      }
    }

    for (const productId of availabilityChanges) {
      try {
        await Product.updateOne(
          { _id: productId, availability: 'UNAVAILABLE' },
          { $set: { availability: 'AVAILABLE' } },
        )
      } catch (rollbackError) {
        console.error('Failed to restore product availability:', rollbackError)
      }
    }

    return errorResponse(response, error, 'Placing order')
  }
}

export function createOrder(request, response) {
  return withKeyedLock(`customer-cart:${request.user.id}`, () => createOrderLocked(request, response))
}

export async function listCustomerOrders(request, response) {
  try {
    const orders = await Order.find({ customer_id: request.user.id }).sort({ order_date: -1, _id: -1 }).lean()
    return response.json({ success: true, message: 'Orders retrieved', data: orders.map((order) => serializeOrder(order)) })
  } catch (error) {
    return errorResponse(response, error, 'Retrieving orders')
  }
}

export async function getCustomerOrder(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(400).json({ success: false, message: 'Invalid order ID', data: null })
  }

  try {
    const order = await Order.findOne({ _id: request.params.id, customer_id: request.user.id }).lean()
    if (!order) {
      return response.status(404).json({ success: false, message: 'Order not found', data: null })
    }
    return response.json({ success: true, message: 'Order retrieved', data: serializeOrder(order) })
  } catch (error) {
    return errorResponse(response, error, 'Retrieving order')
  }
}

export async function listFarmerOrders(request, response) {
  try {
    const orders = await Order.find({ 'items.farmer_id': request.user.id })
      .sort({ order_date: -1, _id: -1 })
      .lean()
    const data = orders.map((order) => serializeOrder({
      ...order,
      items: order.items.filter((item) => String(item.farmer_id) === request.user.id),
    }))
    return response.json({ success: true, message: 'Farmer orders retrieved', data })
  } catch (error) {
    return errorResponse(response, error, 'Retrieving farmer orders')
  }
}

export async function listAllOrders(request, response) {
  try {
    const orders = await Order.find().sort({ order_date: -1, _id: -1 }).lean()
    return response.json({ success: true, message: 'Orders retrieved', data: orders.map((order) => serializeOrder(order)) })
  } catch (error) {
    return errorResponse(response, error, 'Retrieving all orders')
  }
}

export async function updateOrderStatus(request, response) {
  const { status } = request.body ?? {}
  if (!orderStatuses.includes(status)) {
    return response.status(400).json({ success: false, message: 'Invalid order status', data: null })
  }
  if (!isValidId(request.params.id)) {
    return response.status(400).json({ success: false, message: 'Invalid order ID', data: null })
  }

  try {
    const order = await Order.findByIdAndUpdate(
      request.params.id,
      { $set: { status } },
      { new: true, runValidators: true },
    ).lean()
    if (!order) {
      return response.status(404).json({ success: false, message: 'Order not found', data: null })
    }
    return response.json({ success: true, message: 'Order status updated', data: serializeOrder(order) })
  } catch (error) {
    return errorResponse(response, error, 'Updating order status')
  }
}
