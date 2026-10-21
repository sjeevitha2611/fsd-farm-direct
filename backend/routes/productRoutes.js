import { Router } from 'express'
import {
  createProduct,
  deleteProduct,
  getProduct,
  listFarmerProducts,
  listProducts,
  updateProduct,
} from '../controllers/productController.js'
import { authenticate } from '../middleware/authMiddleware.js'
import { handleProductImageUploadError, uploadProductImage } from '../middleware/productImageUpload.js'

const router = Router()

function requireFarmer(request, response, next) {
  if (request.user.role !== 'farmer') {
    return response.status(403).json({
      success: false,
      message: 'Farmer access required',
      data: null,
    })
  }
  return next()
}

router.get('/', listProducts)
router.get('/farmer/my-products', authenticate, requireFarmer, listFarmerProducts)
router.get('/:id', getProduct)
router.post('/', authenticate, requireFarmer, uploadProductImage, handleProductImageUploadError, createProduct)
router.put('/:id', authenticate, requireFarmer, uploadProductImage, handleProductImageUploadError, updateProduct)
router.delete('/:id', authenticate, requireFarmer, deleteProduct)

export default router
