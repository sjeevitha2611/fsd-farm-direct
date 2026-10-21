import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config()

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI is not configured')
  }

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
  }

  return mongoose.connection
}

export async function testConnection() {
  const connection = await connectDatabase()
  await connection.db.admin().ping()
  return true
}

export default mongoose
