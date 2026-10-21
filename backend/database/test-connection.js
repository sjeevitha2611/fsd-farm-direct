import mongoose from 'mongoose'
import { testConnection } from '../config/db.js'

try {
  await testConnection()
  console.log('MongoDB connection successful')
} catch (error) {
  console.error('MongoDB connection failed:', error.name || 'connection error')
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
