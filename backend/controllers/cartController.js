import Cart from '../models/Cart.js'
import Product from '../models/Product.js'
import { formatAmount, idString } from '../utils/serializers.js'
import { withKeyedLock } from '../utils/keyedLock.js'

class CartError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function parseQuantity(value) {
  const text = typeof value === 'number' ? String(value) : value
  if (
    typeof text !== 'string' ||
    !/^\d{1,8}(?:\.\d{1,2})?$/.test(text) ||
    !Number.isFinite(Number(text))
  ) {
    return null
  }

  const [whole, fraction = ''] = text.split('.')
  const units = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return units > 0 ? units : null
}

function formatQuantity(units) {
  return `${Math.floor(units / 100)}.${String(units % 100).padStart(2, '0')}`
}

function decimalToUnits(value) {
  return parseQuantity(String(value)) ?? 0
}

function isValidId(id) {
  return typeof id === 'string' && /^[\da-f]{24}$/i.test(id)
}

async function findOwnedItem(customerId, itemId) {
  const ownedCart = await Cart.findOne({ customer_id: customerId, 'items._id': itemId })
  if (ownedCart) return { cart: ownedCart, item: ownedCart.items.id(itemId) }

  const existsElsewhere = await Cart.exists({ 'items._id': itemId })
  if (existsElsewhere) {
    throw new CartError(403, 'You are not authorized to access this cart item')
  }
  throw new CartError(404, 'Cart item not found')
}

function respondWithError(response, error, operation) {
  if (error instanceof CartError) {
    return response.status(error.status).json({ success: false, message: error.message, data: null })
  }

  console.error(`${operation} failed:`, error)
  return response.status(500).json({ success: false, message: `${operation} failed`, data: null })
}

export async function getCart(request, response) {
  try {
    const cart = await Cart.findOne({ customer_id: request.user.id }).populate('items.product_id')
    const items = (cart?.items ?? []).flatMap((item) => {
      const product = item.product_id
      if (!product) return []
      return [{
        item_id: idString(item._id),
        product_id: idString(product._id),
        name: product.name,
        price: formatAmount(product.price),
        image_url: product.image,
        available_quantity: formatAmount(product.quantity),
        selected_quantity: formatAmount(item.quantity),
        unit: product.unit,
        availability: product.availability,
        subtotal: formatAmount(Number(product.price) * Number(item.quantity)),
      }]
    })
    const totalCents = items.reduce((sum, item) => (
      sum + Math.round(Number(item.subtotal) * 100)
    ), 0)
    const total = (totalCents / 100).toFixed(2)
    return response.json({ success: true, message: 'Cart retrieved', data: { items, total } })
  } catch (error) {
    return respondWithError(response, error, 'Retrieving cart')
  }
}

async function addCartItemLocked(request, response) {
  const productId = request.body?.product_id
  const quantity = parseQuantity(request.body?.quantity)
  if (!isValidId(productId)) {
    return response.status(400).json({ success: false, message: 'Invalid product ID', data: null })
  }
  if (quantity === null) {
    return response.status(400).json({ success: false, message: 'Quantity must be greater than 0 and have at most two decimal places', data: null })
  }

  try {
    const product = await Product.findById(productId)
    if (!product) throw new CartError(404, 'Product not found')
    if (product.availability !== 'AVAILABLE') throw new CartError(409, 'Product is unavailable')

    let cart = await Cart.findOne({ customer_id: request.user.id })
    if (!cart) {
      try {
        cart = await Cart.create({ customer_id: request.user.id, items: [] })
      } catch (error) {
        if (error.code !== 11000) throw error
        cart = await Cart.findOne({ customer_id: request.user.id })
      }
    }

    let item = cart.items.find((entry) => idString(entry.product_id) === productId)
    const requestedTotal = (item ? decimalToUnits(item.quantity) : 0) + quantity
    if (requestedTotal > decimalToUnits(product.quantity)) {
      throw new CartError(409, 'Requested quantity exceeds available stock')
    }

    if (item) {
      item.quantity = requestedTotal / 100
    } else {
      cart.items.push({ product_id: product._id, quantity: quantity / 100 })
    }
    await cart.save()

    return response.status(201).json({
      success: true,
      message: item ? 'Cart item quantity increased' : 'Product added to cart',
      data: { product_id: productId, quantity: formatQuantity(requestedTotal) },
    })
  } catch (error) {
    return respondWithError(response, error, 'Adding cart item')
  }
}

export function addCartItem(request, response) {
  return withKeyedLock(`customer-cart:${request.user.id}`, () => addCartItemLocked(request, response))
}

async function updateCartItemLocked(request, response) {
  const itemId = request.params.itemId
  const quantity = parseQuantity(request.body?.quantity)
  if (!isValidId(itemId)) {
    return response.status(400).json({ success: false, message: 'Invalid cart item ID', data: null })
  }
  if (quantity === null) {
    return response.status(400).json({ success: false, message: 'Quantity must be greater than 0 and have at most two decimal places', data: null })
  }

  try {
    const { cart, item } = await findOwnedItem(request.user.id, itemId)
    const product = await Product.findById(item.product_id)
    if (!product) throw new CartError(404, 'Product not found')
    if (product.availability !== 'AVAILABLE') throw new CartError(409, 'Product is unavailable')
    if (quantity > decimalToUnits(product.quantity)) {
      throw new CartError(409, 'Requested quantity exceeds available stock')
    }

    item.quantity = quantity / 100
    await cart.save()
    return response.json({
      success: true,
      message: 'Cart item updated',
      data: { item_id: itemId, quantity: formatQuantity(quantity) },
    })
  } catch (error) {
    return respondWithError(response, error, 'Updating cart item')
  }
}

export function updateCartItem(request, response) {
  return withKeyedLock(`customer-cart:${request.user.id}`, () => updateCartItemLocked(request, response))
}

async function deleteCartItemLocked(request, response) {
  const itemId = request.params.itemId
  if (!isValidId(itemId)) {
    return response.status(400).json({ success: false, message: 'Invalid cart item ID', data: null })
  }

  try {
    const { cart, item } = await findOwnedItem(request.user.id, itemId)
    cart.items.pull(item._id)
    await cart.save()
    return response.json({ success: true, message: 'Cart item removed', data: { item_id: itemId } })
  } catch (error) {
    return respondWithError(response, error, 'Deleting cart item')
  }
}

export function deleteCartItem(request, response) {
  return withKeyedLock(`customer-cart:${request.user.id}`, () => deleteCartItemLocked(request, response))
}

async function clearCartLocked(request, response) {
  try {
    const cart = await Cart.findOne({ customer_id: request.user.id })
    const removedItems = cart?.items.length ?? 0
    if (cart && removedItems > 0) {
      cart.items = []
      await cart.save()
    }
    return response.json({ success: true, message: 'Cart cleared', data: { removed_items: removedItems } })
  } catch (error) {
    return respondWithError(response, error, 'Clearing cart')
  }
}

export function clearCart(request, response) {
  return withKeyedLock(`customer-cart:${request.user.id}`, () => clearCartLocked(request, response))
}
