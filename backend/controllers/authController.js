import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { serializeUser } from '../utils/serializers.js'

const publicRegistrationRoles = new Set(['farmer', 'customer'])
const maxBcryptPasswordBytes = 72

function createToken(user) {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not configured')
  }

  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role },
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

  try {
    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      phone: phone ?? null,
      role: role ?? 'customer',
    })
    return response.status(201).json({ success: true, user: serializeUser(user) })
  } catch (error) {
    if (error.code === 11000) {
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
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password')
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return response.status(401).json({ success: false, message: 'Invalid email or password' })
    }

    const token = createToken(user)
    return response.json({ success: true, token, user: serializeUser(user) })
  } catch (error) {
    console.error('Login failed:', error)
    return response.status(500).json({ success: false, message: 'Login failed' })
  }
}

export async function getCurrentUser(request, response) {
  try {
    const user = await User.findById(request.user.id)
    if (!user) {
      return response.status(401).json({ success: false, message: 'Authenticated user no longer exists' })
    }
    return response.json({ success: true, user: serializeUser(user) })
  } catch (error) {
    console.error('Failed to retrieve authenticated user:', error)
    return response.status(500).json({ success: false, message: 'Failed to retrieve authenticated user' })
  }
}
