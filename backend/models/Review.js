import mongoose from 'mongoose'

const reviewSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  comment: { type: String, default: null, maxlength: 65535 },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  versionKey: false,
})

reviewSchema.index({ customer_id: 1, product_id: 1 }, { unique: true })
reviewSchema.index({ product_id: 1, created_at: -1 })

export default mongoose.models.Review || mongoose.model('Review', reviewSchema)
