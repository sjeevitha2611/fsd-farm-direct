import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../config/db.js'

const publicRegistrationRoles = new Set(['farmer', 'customer'])
const saltRounds = 12
const maxBcryptPasswordBytes = 72

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  }
}

function createToken(user) {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not configured')
  }

  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn: '1d' },
  )
}

export async function register(request, response) {
  const { name, email, password, phone, role } = request.body ?? {}

  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.trim().length > 120 ||
    typeof email !== 'string' ||
    !email.trim() ||
    email.trim().length > 255 ||
    typeof password !== 'string' ||
    !password ||
    Buffer.byteLength(password, 'utf8') > maxBcryptPasswordBytes ||
    (phone !== undefined && phone !== null && (typeof phone !== 'string' || phone.length > 32)) ||
    (role !== undefined && !publicRegistrationRoles.has(role))
  ) {
    return response.status(400).json({ success: false, message: 'Invalid registration details' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const assignedRole = role ?? 'customer'

  try {
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [normalizedEmail],
    )

    if (existingUsers.length > 0) {
      return response.status(409).json({ success: false, message: 'Email is already registered' })
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds)
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, `password`, phone, role) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), normalizedEmail, hashedPassword, phone ?? null, assignedRole],
    )

    const user = {
      id: result.insertId,
      name: name.trim(),
      email: normalizedEmail,
      phone: phone ?? null,
      role: assignedRole,
    }

    return response.status(201).json({ success: true, user })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return response.status(409).json({ success: false, message: 'Email is already registered' })
    }

    console.error('Registration failed:', error)
    return response.status(500).json({ success: false, message: 'Registration failed' })
  }
}

export async function login(request, response) {
  const { email, password } = request.body ?? {}

  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    return response.status(400).json({ success: false, message: 'Email and password are required' })
  }

  try {
    const [users] = await pool.execute(
      'SELECT id, name, email, `password`, phone, role FROM users WHERE email = ? LIMIT 1',
      [email.trim().toLowerCase()],
    )
    const user = users[0]

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return response.status(401).json({ success: false, message: 'Invalid email or password' })
    }

    const token = createToken(user)
    return response.json({ success: true, token, user: safeUser(user) })
  } catch (error) {
    console.error('Login failed:', error)
    return response.status(500).json({ success: false, message: 'Login failed' })
  }
}

export function getCurrentUser(request, response) {
  return response.json({ success: true, user: safeUser(request.user) })
}
