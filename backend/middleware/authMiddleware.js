import jwt from 'jsonwebtoken'

export function authenticate(request, response, next) {
  const authorization = request.get('Authorization')
  const [scheme, token] = authorization?.split(' ') ?? []

  if (scheme !== 'Bearer' || !token) {
    return response.status(401).json({ success: false, message: 'Authentication required' })
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    console.error('JWT_SECRET is not configured')
    return response.status(500).json({ success: false, message: 'Authentication is not configured' })
  }

  try {
    const payload = jwt.verify(token, secret)
    if (
      typeof payload === 'string' ||
      typeof payload.id !== 'number' && typeof payload.id !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      return response.status(401).json({ success: false, message: 'Invalid authentication token' })
    }

    request.user = { id: payload.id, email: payload.email, role: payload.role }
    return next()
  } catch {
    return response.status(401).json({ success: false, message: 'Invalid or expired authentication token' })
  }
}
