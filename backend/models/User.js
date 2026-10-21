import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 255 },
  password: { type: String, required: true, select: false },
  phone: { type: String, default: null, maxlength: 32 },
  role: { type: String, enum: ['farmer', 'customer', 'admin'], default: 'customer', required: true },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  versionKey: false,
})

userSchema.pre('save', async function hashPassword() {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12)
  }
})

export default mongoose.models.User || mongoose.model('User', userSchema)
