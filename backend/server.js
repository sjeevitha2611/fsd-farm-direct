import cors from 'cors'
import express from 'express'
import { fileURLToPath } from 'node:url'
import { connectDatabase } from './config/db.js'
import { Cart, Order, Product, Review, User } from './models/index.js'
import adminRoutes from './routes/adminRoutes.js'
import authRoutes from './routes/authRoutes.js'
import cartRoutes from './routes/cartRoutes.js'
import orderRoutes from './routes/orderRoutes.js'
import productRoutes from './routes/productRoutes.js'
import reviewRoutes from './routes/reviewRoutes.js'

const app = express()
const port = Number(process.env.PORT) || 5000
const uploadsDirectory = fileURLToPath(new URL('./uploads/', import.meta.url))

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(uploadsDirectory, { dotfiles: 'deny', index: false }))
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/cart', cartRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/products', productRoutes)
app.use('/api/reviews', reviewRoutes)

app.get('/api/health', (request, response) => {
  response.json({
    success: true,
    message: 'Farm Direct API is running',
  })
})

async function startServer() {
  try {
    await connectDatabase()
    await Promise.all([Cart.init(), Order.init(), Product.init(), Review.init(), User.init()])
    console.log('MongoDB connection successful')

    app.listen(port, () => {
      console.log(`Farm Direct API listening on http://localhost:${port}`)
    })
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.name || 'connection error')
    process.exitCode = 1
  }
}

startServer()