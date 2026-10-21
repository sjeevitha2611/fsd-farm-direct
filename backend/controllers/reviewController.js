import mongoose from 'mongoose'
import Product from '../models/Product.js'
import Review from '../models/Review.js'
import { idString } from '../utils/serializers.js'

function isValidId(id) {
  return typeof id === 'string' && /^[\da-f]{24}$/i.test(id)
}

async function getReviewData(productId) {
  const [reviews, [summary]] = await Promise.all([
    Review.find({ product_id: productId })
      .sort({ created_at: -1, _id: -1 })
      .populate('customer_id', 'name')
      .lean(),
    Review.aggregate([
      { $match: { product_id: new mongoose.Types.ObjectId(productId) } },
      { $group: { _id: null, review_count: { $sum: 1 }, average_rating: { $avg: '$rating' } } },
    ]),
  ])

  return {
    review_count: summary?.review_count ?? 0,
    average_rating: Number((summary?.average_rating ?? 0).toFixed(1)),
    reviews: reviews.map((review) => ({
      id: idString(review._id),
      customer_id: idString(review.customer_id?._id),
      customer_name: review.customer_id?.name ?? 'Customer',
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at,
    })),
  }
}

export async function listProductReviews(request, response) {
  if (!isValidId(request.params.productId)) {
    return response.status(400).json({ success: false, message: 'Invalid product ID', data: null })
  }

  try {
    const productExists = await Product.exists({ _id: request.params.productId })
    if (!productExists) {
      return response.status(404).json({ success: false, message: 'Product not found', data: null })
    }
    return response.json({
      success: true,
      message: 'Reviews retrieved',
      data: await getReviewData(request.params.productId),
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
  if (!isValidId(request.params.productId)) {
    return response.status(400).json({ success: false, message: 'Invalid product ID', data: null })
  }

  try {
    const productExists = await Product.exists({ _id: request.params.productId })
    if (!productExists) {
      return response.status(404).json({ success: false, message: 'Product not found', data: null })
    }

    await Review.findOneAndUpdate(
      { customer_id: request.user.id, product_id: request.params.productId },
      { $set: { rating, comment: comment ?? null } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    )
    return response.status(201).json({
      success: true,
      message: 'Review saved',
      data: await getReviewData(request.params.productId),
    })
  } catch (error) {
    console.error('Failed to save review:', error)
    return response.status(500).json({ success: false, message: 'Failed to save review', data: null })
  }
}
