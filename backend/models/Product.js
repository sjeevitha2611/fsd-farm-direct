import mongoose from 'mongoose'

const productSchema = new mongoose.Schema({
  farmer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, default: null },
  category: { type: String, required: true, trim: true, maxlength: 100, index: true },
  price: { type: Number, required: true, min: 0, max: 99999999.99 },
  quantity: { type: Number, required: true, min: 0, max: 99999999.99, default: 0 },
  unit: { type: String, required: true, trim: true, maxlength: 40 },
  image: { type: String, default: null, maxlength: 2048 },
  availability: { type: String, enum: ['AVAILABLE', 'UNAVAILABLE'], default: 'AVAILABLE', index: true },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  versionKey: false,
})

export default mongoose.models.Product || mongoose.model('Product', productSchema)
