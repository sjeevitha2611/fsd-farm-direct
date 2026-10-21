import pool, { testConnection } from '../config/db.js'

try {
  await testConnection()
  console.log('MySQL connection successful')
} catch (error) {
  console.error('MySQL connection failed:', error.code || error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}