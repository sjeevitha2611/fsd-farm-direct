import { Router } from 'express'
import { getOverview, listProducts, listUsers } from '../controllers/adminController.js'
import { authenticate } from '../middleware/authMiddleware.js'

const router = Router()

router.use(authenticate, (request, response, next) => {
  if (request.user.role !== 'admin') {
    return response.status(403).json({ success: false, message: 'Admin access required', data: null })
  }
  return next()
})

router.get('/overview', getOverview)
router.get('/users', listUsers)
router.get('/products', listProducts)

export default router
