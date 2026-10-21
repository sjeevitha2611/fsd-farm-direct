import pool from '../config/db.js'

const allowedStatuses = new Set([
  'PLACED',
  'CONFIRMED',
  'PREPARING',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
])

function errorResponse(response, error, operation) {
  if (error.status) {
    return response.status(error.status).json({ success: false, message: error.message, data: null })
  }
  console.error(`${operation} failed:`, error)
  return response.status(500).json({ success: false, message: `${operation} failed`, data: null })
}

function toHundredths(value) {
  const [whole, fraction = ''] = String(value).split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}

function formatHundredths(value) {
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`
}

function shapeOrders(rows) {
  const orders = new Map()
  for (const row of rows) {
    let order = orders.get(String(row.id))
    if (!order) {
      order = {
        id: row.id,
        customer_id: row.customer_id,
        customer_name: row.customer_name,
        total_amount: row.total_amount,
        address: row.address,
        order_date: row.order_date,
        status: row.status,
        items: [],
      }
      orders.set(String(row.id), order)
    }
    if (row.item_id !== null && row.item_id !== undefined) {
      order.items.push({
        id: row.item_id,
        product_id: row.product_id,
        product_name: row.product_name,
        image_url: row.image_url,
        quantity: row.quantity,
        price: row.price,
        subtotal: row.subtotal,
        unit: row.unit,
        farmer_id: row.farmer_id,
      })
    }
  }
  return [...orders.values()]
}

const orderSelect = `
  SELECT
    o.id,
    o.customer_id,
    u.name AS customer_name,
    o.total_amount,
    o.address,
    o.order_date,
    o.status,
    oi.id AS item_id,
    oi.product_id,
    p.name AS product_name,
    p.image AS image_url,
    p.unit,
    p.farmer_id,
    oi.quantity,
    oi.price,
    ROUND(oi.quantity * oi.price, 2) AS subtotal
  FROM orders o
  INNER JOIN users u ON u.id = o.customer_id
  LEFT JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN products p ON p.id = oi.product_id
`

export async function createOrder(request, response) {
  const address = request.body?.address
  if (typeof address !== 'string' || !address.trim() || address.trim().length > 65535) {
    return response.status(400).json({ success: false, message: 'A delivery address is required', data: null })
  }

  let connection
  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()
    const [rows] = await connection.execute(
      `SELECT ci.product_id, ci.quantity, p.name, p.price, p.quantity AS available_quantity, p.availability
       FROM cart c
       INNER JOIN cart_items ci ON ci.cart_id = c.id
       INNER JOIN products p ON p.id = ci.product_id
       WHERE c.customer_id = ?
       ORDER BY p.id
       FOR UPDATE`,
      [request.user.id],
    )
    if (rows.length === 0) {
      const error = new Error('Your cart is empty')
      error.status = 400
      throw error
    }

    let totalCents = 0n
    for (const item of rows) {
      if (item.availability !== 'AVAILABLE') {
        const error = new Error(`${item.name} is no longer available`)
        error.status = 409
        throw error
      }
      if (toHundredths(item.quantity) > toHundredths(item.available_quantity)) {
        const error = new Error(`Insufficient stock for ${item.name}`)
        error.status = 409
        throw error
      }
      totalCents += (toHundredths(item.price) * toHundredths(item.quantity) + 50n) / 100n
    }

    const [orderResult] = await connection.execute(
      'INSERT INTO orders (customer_id, total_amount, address) VALUES (?, ?, ?)',
      [request.user.id, formatHundredths(totalCents), address.trim()],
    )
    const orderId = orderResult.insertId

    for (const item of rows) {
      await connection.execute(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.price],
      )
      await connection.execute(
        `UPDATE products
         SET availability = CASE WHEN quantity - ? <= 0 THEN 'UNAVAILABLE' ELSE availability END,
             quantity = quantity - ?
         WHERE id = ?`,
        [item.quantity, item.quantity, item.product_id],
      )
    }

    await connection.execute(
      `DELETE ci FROM cart_items ci
       INNER JOIN cart c ON c.id = ci.cart_id
       WHERE c.customer_id = ?`,
      [request.user.id],
    )
    await connection.commit()

    const [createdRows] = await pool.execute(
      `${orderSelect} WHERE o.id = ? ORDER BY oi.id`,
      [orderId],
    )
    return response.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: shapeOrders(createdRows)[0],
    })
  } catch (error) {
    if (connection) await connection.rollback()
    return errorResponse(response, error, 'Placing order')
  } finally {
    connection?.release()
  }
}

export async function listCustomerOrders(request, response) {
  try {
    const [rows] = await pool.execute(
      `${orderSelect} WHERE o.customer_id = ? ORDER BY o.order_date DESC, o.id DESC, oi.id`,
      [request.user.id],
    )
    return response.json({ success: true, message: 'Orders retrieved', data: shapeOrders(rows) })
  } catch (error) {
    return errorResponse(response, error, 'Retrieving orders')
  }
}

export async function getCustomerOrder(request, response) {
  try {
    const [rows] = await pool.execute(
      `${orderSelect} WHERE o.id = ? AND o.customer_id = ? ORDER BY oi.id`,
      [request.params.id, request.user.id],
    )
    if (rows.length === 0) {
      return response.status(404).json({ success: false, message: 'Order not found', data: null })
    }
    return response.json({ success: true, message: 'Order retrieved', data: shapeOrders(rows)[0] })
  } catch (error) {
    return errorResponse(response, error, 'Retrieving order')
  }
}

export async function listFarmerOrders(request, response) {
  try {
    const [rows] = await pool.execute(
      `${orderSelect}
       INNER JOIN order_items farmer_items ON farmer_items.order_id = o.id
       INNER JOIN products farmer_products ON farmer_products.id = farmer_items.product_id
       WHERE EXISTS (
         SELECT 1 FROM order_items farmer_items
         INNER JOIN products farmer_products ON farmer_products.id = farmer_items.product_id
         WHERE farmer_items.order_id = o.id AND farmer_products.farmer_id = ?
       )
       ORDER BY o.order_date DESC, o.id DESC, oi.id`,
      [request.user.id],
    )
    const orders = shapeOrders(rows)
    for (const order of orders) {
      order.items = order.items.filter((item) => String(item.farmer_id) === String(request.user.id))
    }
    return response.json({ success: true, message: 'Farmer orders retrieved', data: orders })
  } catch (error) {
    return errorResponse(response, error, 'Retrieving farmer orders')
  }
}

export async function listAllOrders(request, response) {
  try {
    const [rows] = await pool.execute(`${orderSelect} ORDER BY o.order_date DESC, o.id DESC, oi.id`)
    return response.json({ success: true, message: 'Orders retrieved', data: shapeOrders(rows) })
  } catch (error) {
    return errorResponse(response, error, 'Retrieving all orders')
  }
}

export async function updateOrderStatus(request, response) {
  const { status } = request.body ?? {}
  if (!allowedStatuses.has(status)) {
    return response.status(400).json({ success: false, message: 'Invalid order status', data: null })
  }
  if (!/^[1-9]\d*$/.test(String(request.params.id))) {
    return response.status(400).json({ success: false, message: 'Invalid order ID', data: null })
  }
  try {
    const [existing] = await pool.execute('SELECT id FROM orders WHERE id = ? LIMIT 1', [request.params.id])
    if (existing.length === 0) {
      return response.status(404).json({ success: false, message: 'Order not found', data: null })
    }
    await pool.execute('UPDATE orders SET status = ? WHERE id = ?', [status, request.params.id])
    const [rows] = await pool.execute(
      `${orderSelect} WHERE o.id = ? ORDER BY oi.id`,
      [request.params.id],
    )
    return response.json({ success: true, message: 'Order status updated', data: shapeOrders(rows)[0] })
  } catch (error) {
    return errorResponse(response, error, 'Updating order status')
  }
}
