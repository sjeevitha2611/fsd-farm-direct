import { Router } from 'express'
import {
  addCartItem,
  clearCart,
  deleteCartItem,
  getCart,
  updateCartItem,
} from '../controllers/cartController.js'
import { authenticate } from '../middleware/authMiddleware.js'

const router = Router()

function requireCustomer(request, response, next) {
  if (request.user.role !== 'customer') {
    return response.status(403).json({
      success: false,
      message: 'Customer access required',
      data: null,
    })
  }
  return next()
}

router.use(authenticate, requireCustomer)
router.get('/', getCart)
router.post('/', addCartItem)
router.put('/:itemId', updateCartItem)
router.delete('/:itemId', deleteCartItem)
router.delete('/', clearCart)

export default router
