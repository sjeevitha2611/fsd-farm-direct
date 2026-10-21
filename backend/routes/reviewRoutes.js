import { Router } from 'express'
import { listProductReviews, submitProductReview } from '../controllers/reviewController.js'
import { authenticate } from '../middleware/authMiddleware.js'

const router = Router()

function requireCustomer(request, response, next) {
  if (request.user.role !== 'customer') {
    return response.status(403).json({ success: false, message: 'Customer access required', data: null })
  }
  return next()
}

router.get('/products/:productId', listProductReviews)
router.post('/products/:productId', authenticate, requireCustomer, submitProductReview)

export default router
