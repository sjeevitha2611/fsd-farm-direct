import pool from '../config/db.js'

class CartError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function parsePositiveId(value) {
  if (
    typeof value !== 'string' && typeof value !== 'number'
    || !/^[1-9]\d*$/.test(String(value))
  ) {
    return null
  }
  return String(value)
}

function parseQuantity(value) {
  const text = typeof value === 'number' ? String(value) : value
  if (
    typeof text !== 'string'
    || !/^\d{1,8}(?:\.\d{1,2})?$/.test(text)
    || !Number.isFinite(Number(text))
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

async function getCartId(connection, customerId, create = false) {
  if (create) {
    await connection.execute(
      'INSERT INTO cart (customer_id) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)',
      [customerId],
    )
  }

  const [carts] = await connection.execute(
    'SELECT id FROM cart WHERE customer_id = ? LIMIT 1',
    [customerId],
  )
  return carts[0]?.id ?? null
}

async function getCartData(connection, customerId) {
  const cartId = await getCartId(connection, customerId)
  if (cartId === null) {
    return { items: [], total: '0.00' }
  }

  const [items] = await connection.execute(
    `SELECT
       ci.id AS item_id,
       p.id AS product_id,
       p.name,
       p.price,
       p.image AS image_url,
       p.quantity AS available_quantity,
       ci.quantity AS selected_quantity,
       p.unit,
       p.availability,
       ROUND(p.price * ci.quantity, 2) AS subtotal
     FROM cart_items ci
     INNER JOIN products p ON p.id = ci.product_id
     WHERE ci.cart_id = ?
     ORDER BY ci.id`,
    [cartId],
  )
  const [totals] = await connection.execute(
    `SELECT COALESCE(CAST(ROUND(SUM(p.price * ci.quantity), 2) AS CHAR), '0.00') AS total
     FROM cart_items ci
     INNER JOIN products p ON p.id = ci.product_id
     WHERE ci.cart_id = ?`,
    [cartId],
  )

  return { items, total: totals[0].total }
}

function respondWithError(response, error, operation) {
  if (error instanceof CartError) {
    return response.status(error.status).json({
      success: false,
      message: error.message,
      data: null,
    })
  }

  console.error(`${operation} failed:`, error)
  return response.status(500).json({
    success: false,
    message: `${operation} failed`,
    data: null,
  })
}

export async function getCart(request, response) {
  try {
    const data = await getCartData(pool, request.user.id)
    return response.json({ success: true, message: 'Cart retrieved', data })
  } catch (error) {
    return respondWithError(response, error, 'Retrieving cart')
  }
}

export async function addCartItem(request, response) {
  const productId = parsePositiveId(request.body?.product_id)
  const quantity = parseQuantity(request.body?.quantity)
  if (productId === null) {
    return response.status(400).json({ success: false, message: 'Invalid product ID', data: null })
  }
  if (quantity === null) {
    return response.status(400).json({ success: false, message: 'Quantity must be greater than 0 and have at most two decimal places', data: null })
  }

  let connection
  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()

    const [products] = await connection.execute(
      'SELECT id, quantity, availability FROM products WHERE id = ? FOR UPDATE',
      [productId],
    )
    const product = products[0]
    if (!product) {
      throw new CartError(404, 'Product not found')
    }
    if (product.availability !== 'AVAILABLE') {
      throw new CartError(409, 'Product is unavailable')
    }

    const cartId = await getCartId(connection, request.user.id, true)
    const [cartItems] = await connection.execute(
      'SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? FOR UPDATE',
      [cartId, productId],
    )
    const existingItem = cartItems[0]
    const requestedTotal = (existingItem ? decimalToUnits(existingItem.quantity) : 0) + quantity
    if (requestedTotal > decimalToUnits(product.quantity)) {
      throw new CartError(409, 'Requested quantity exceeds available stock')
    }

    if (existingItem) {
      await connection.execute(
        'UPDATE cart_items SET quantity = ? WHERE id = ?',
        [formatQuantity(requestedTotal), existingItem.id],
      )
    } else {
      await connection.execute(
        'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)',
        [cartId, productId, formatQuantity(quantity)],
      )
    }

    await connection.commit()
    return response.status(201).json({
      success: true,
      message: existingItem ? 'Cart item quantity increased' : 'Product added to cart',
      data: { product_id: productId, quantity: formatQuantity(requestedTotal) },
    })
  } catch (error) {
    if (connection) await connection.rollback()
    return respondWithError(response, error, 'Adding cart item')
  } finally {
    connection?.release()
  }
}

export async function updateCartItem(request, response) {
  const itemId = parsePositiveId(request.params.itemId)
  const quantity = parseQuantity(request.body?.quantity)
  if (itemId === null) {
    return response.status(400).json({ success: false, message: 'Invalid cart item ID', data: null })
  }
  if (quantity === null) {
    return response.status(400).json({ success: false, message: 'Quantity must be greater than 0 and have at most two decimal places', data: null })
  }

  let connection
  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()

    const [initialItems] = await connection.execute(
      `SELECT ci.product_id, c.customer_id
       FROM cart_items ci
       INNER JOIN cart c ON c.id = ci.cart_id
       WHERE ci.id = ?
       LIMIT 1`,
      [itemId],
    )
    const initialItem = initialItems[0]
    if (!initialItem) {
      throw new CartError(404, 'Cart item not found')
    }
    if (String(initialItem.customer_id) !== String(request.user.id)) {
      throw new CartError(403, 'You are not authorized to modify this cart item')
    }

    const [products] = await connection.execute(
      'SELECT quantity, availability FROM products WHERE id = ? FOR UPDATE',
      [initialItem.product_id],
    )
    const product = products[0]
    if (!product) {
      throw new CartError(404, 'Product not found')
    }
    if (product.availability !== 'AVAILABLE') {
      throw new CartError(409, 'Product is unavailable')
    }
    if (quantity > decimalToUnits(product.quantity)) {
      throw new CartError(409, 'Requested quantity exceeds available stock')
    }

    const [cartItems] = await connection.execute(
      `SELECT ci.id
       FROM cart_items ci
       INNER JOIN cart c ON c.id = ci.cart_id
       WHERE ci.id = ? AND c.customer_id = ?
       FOR UPDATE`,
      [itemId, request.user.id],
    )
    if (cartItems.length === 0) {
      throw new CartError(404, 'Cart item not found')
    }

    await connection.execute(
      'UPDATE cart_items SET quantity = ? WHERE id = ?',
      [formatQuantity(quantity), itemId],
    )
    await connection.commit()
    return response.json({
      success: true,
      message: 'Cart item updated',
      data: { item_id: itemId, quantity: formatQuantity(quantity) },
    })
  } catch (error) {
    if (connection) await connection.rollback()
    return respondWithError(response, error, 'Updating cart item')
  } finally {
    connection?.release()
  }
}

export async function deleteCartItem(request, response) {
  const itemId = parsePositiveId(request.params.itemId)
  if (itemId === null) {
    return response.status(400).json({ success: false, message: 'Invalid cart item ID', data: null })
  }

  let connection
  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()

    const [cartItems] = await connection.execute(
      `SELECT ci.id, c.customer_id
       FROM cart_items ci
       INNER JOIN cart c ON c.id = ci.cart_id
       WHERE ci.id = ?
       FOR UPDATE`,
      [itemId],
    )
    const cartItem = cartItems[0]
    if (!cartItem) {
      throw new CartError(404, 'Cart item not found')
    }
    if (String(cartItem.customer_id) !== String(request.user.id)) {
      throw new CartError(403, 'You are not authorized to delete this cart item')
    }

    await connection.execute('DELETE FROM cart_items WHERE id = ?', [itemId])
    await connection.commit()
    return response.json({ success: true, message: 'Cart item removed', data: { item_id: itemId } })
  } catch (error) {
    if (connection) await connection.rollback()
    return respondWithError(response, error, 'Deleting cart item')
  } finally {
    connection?.release()
  }
}

export async function clearCart(request, response) {
  let connection
  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()

    const cartId = await getCartId(connection, request.user.id)
    if (cartId === null) {
      await connection.commit()
      return response.json({ success: true, message: 'Cart cleared', data: { removed_items: 0 } })
    }

    const [result] = await connection.execute(
      'DELETE FROM cart_items WHERE cart_id = ?',
      [cartId],
    )
    await connection.commit()
    return response.json({
      success: true,
      message: 'Cart cleared',
      data: { removed_items: result.affectedRows },
    })
  } catch (error) {
    if (connection) await connection.rollback()
    return respondWithError(response, error, 'Clearing cart')
  } finally {
    connection?.release()
  }
}
