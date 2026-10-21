import pool from '../config/db.js'

export async function listProductReviews(request, response) {
  try {
    const [products] = await pool.execute('SELECT id FROM products WHERE id = ? LIMIT 1', [request.params.productId])
    if (products.length === 0) {
      return response.status(404).json({ success: false, message: 'Product not found', data: null })
    }

    const [reviews] = await pool.execute(
      `SELECT r.id, r.customer_id, u.name AS customer_name, r.rating, r.comment, r.created_at
       FROM reviews r
       INNER JOIN users u ON u.id = r.customer_id
       WHERE r.product_id = ?
       ORDER BY r.created_at DESC, r.id DESC`,
      [request.params.productId],
    )
    const [summary] = await pool.execute(
      'SELECT COUNT(*) AS review_count, COALESCE(ROUND(AVG(rating), 1), 0) AS average_rating FROM reviews WHERE product_id = ?',
      [request.params.productId],
    )
    return response.json({
      success: true,
      message: 'Reviews retrieved',
      data: { ...summary[0], reviews },
    })
  } catch (error) {
    console.error('Failed to retrieve reviews:', error)
    return response.status(500).json({ success: false, message: 'Failed to retrieve reviews', data: null })
  }
}

export async function submitProductReview(request, response) {
  const rating = request.body?.rating
  const comment = request.body?.comment
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return response.status(400).json({ success: false, message: 'Rating must be an integer from 1 to 5', data: null })
  }
  if (comment !== undefined && comment !== null && (typeof comment !== 'string' || comment.length > 65535)) {
    return response.status(400).json({ success: false, message: 'Comment must be a string', data: null })
  }

  try {
    const [products] = await pool.execute('SELECT id FROM products WHERE id = ? LIMIT 1', [request.params.productId])
    if (products.length === 0) {
      return response.status(404).json({ success: false, message: 'Product not found', data: null })
    }
    await pool.execute(
      `INSERT INTO reviews (customer_id, product_id, rating, comment)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), updated_at = CURRENT_TIMESTAMP`,
      [request.user.id, request.params.productId, rating, comment ?? null],
    )
    const [reviews] = await pool.execute(
      `SELECT r.id, r.customer_id, u.name AS customer_name, r.rating, r.comment, r.created_at
       FROM reviews r INNER JOIN users u ON u.id = r.customer_id
       WHERE r.product_id = ? ORDER BY r.created_at DESC, r.id DESC`,
      [request.params.productId],
    )
    const [summary] = await pool.execute(
      'SELECT COUNT(*) AS review_count, COALESCE(ROUND(AVG(rating), 1), 0) AS average_rating FROM reviews WHERE product_id = ?',
      [request.params.productId],
    )
    return response.status(201).json({
      success: true,
      message: 'Review saved',
      data: { ...summary[0], reviews },
    })
  } catch (error) {
    console.error('Failed to save review:', error)
    return response.status(500).json({ success: false, message: 'Failed to save review', data: null })
  }
}
