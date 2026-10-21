import mongoose from 'mongoose'

export const orderStatuses = [
  'PLACED',
  'CONFIRMED',
  'PREPARING',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
]

const orderItemSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  product_name: { type: String, required: true },
  image_url: { type: String, default: null },
  unit: { type: String, required: true },
  farmer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quantity: { type: Number, required: true, min: 0.01 },
  price: { type: Number, required: true, min: 0 },
})

const orderSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  customer_name: { type: String, required: true },
  total_amount: { type: Number, required: true, min: 0 },
  address: { type: String, required: true },
  order_date: { type: Date, default: Date.now, index: true },
  status: { type: String, enum: orderStatuses, default: 'PLACED', index: true },
  items: { type: [orderItemSchema], default: [] },
}, { versionKey: false })

export default mongoose.models.Order || mongoose.model('Order', orderSchema)
