import { Router } from 'express'
import {
  createOrder,
  getCustomerOrder,
  listAllOrders,
  listCustomerOrders,
  listFarmerOrders,
  updateOrderStatus,
} from '../controllers/orderController.js'
import { authenticate } from '../middleware/authMiddleware.js'

const router = Router()

function requireRole(role) {
  return (request, response, next) => {
    if (request.user.role !== role) {
      return response.status(403).json({ success: false, message: `${role[0].toUpperCase()}${role.slice(1)} access required`, data: null })
    }
    return next()
  }
}

router.use(authenticate)
router.get('/farmer', requireRole('farmer'), listFarmerOrders)
router.get('/admin', requireRole('admin'), listAllOrders)
router.patch('/:id/status', requireRole('admin'), updateOrderStatus)
router.post('/', requireRole('customer'), createOrder)
router.get('/', requireRole('customer'), listCustomerOrders)
router.get('/:id', requireRole('customer'), getCustomerOrder)

export default router
