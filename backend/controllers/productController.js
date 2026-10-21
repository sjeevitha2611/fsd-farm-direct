import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Product from '../models/Product.js'
import { idString, serializeProduct } from '../utils/serializers.js'

const productFields = ['name', 'description', 'category', 'price', 'quantity', 'unit', 'image_url']
const requiredFields = ['name', 'category', 'price', 'quantity', 'unit']
const uploadedImagesDirectory = fileURLToPath(new URL('../uploads/products/', import.meta.url))

function productForResponse(request, product) {
  const serialized = serializeProduct(product)
  if (serialized.image_url?.startsWith('/uploads/')) {
    serialized.image_url = `${request.protocol}://${request.get('host')}${serialized.image_url}`
  }
  return serialized
}

function uploadedImagePath(request) {
  return request.file ? `/uploads/products/${request.file.filename}` : null
}

function normalizeImageUrl(request, value) {
  const origin = `${request.protocol}://${request.get('host')}`
  if (typeof value !== 'string' || !value.startsWith(`${origin}/uploads/products/`)) {
    return value
  }
  try {
    const url = new URL(value)
    return url.pathname.startsWith('/uploads/products/') ? url.pathname : value
  } catch {
    return value
  }
}

async function removeRequestUpload(request) {
  if (!request.file) return
  try {
    await unlink(request.file.path)
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Failed to remove unused product image:', error)
  }
}

async function removeStoredUpload(image) {
  const prefix = '/uploads/products/'
  if (typeof image !== 'string' || !image.startsWith(prefix)) return
  const filename = image.slice(prefix.length)
  if (!/^[\da-f-]+\.(jpg|png|webp)$/i.test(filename) || path.basename(filename) !== filename) return

  try {
    await unlink(path.join(uploadedImagesDirectory, filename))
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Failed to remove replaced product image:', error)
  }
}

function isValidId(id) {
  return typeof id === 'string' && /^[\da-f]{24}$/i.test(id)
}

function validateProductFields(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'A product object is required' }
  }

  const unknownFields = Object.keys(body).filter((field) => !productFields.includes(field))
  if (unknownFields.length > 0) {
    return { error: `Unsupported product field: ${unknownFields[0]}` }
  }

  const fields = {}
  for (const field of productFields) {
    if (!Object.hasOwn(body, field)) {
      if (!partial && requiredFields.includes(field)) {
        return { error: `${field} is required` }
      }
      continue
    }

    const value = body[field]
    if (['name', 'category', 'unit'].includes(field)) {
      const maxLength = field === 'name' ? 160 : field === 'category' ? 100 : 40
      if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
        return { error: `${field} must be a non-empty string of at most ${maxLength} characters` }
      }
      fields[field] = value.trim()
    } else if (field === 'price' || field === 'quantity') {
      const numericValue = typeof value === 'number' ? String(value) : value
      if (
        typeof numericValue !== 'string' ||
        !/^\d{1,8}(?:\.\d{1,2})?$/.test(numericValue) ||
        !Number.isFinite(Number(numericValue))
      ) {
        return { error: `${field} must be a non-negative number with at most two decimal places` }
      }
      fields[field] = Number(numericValue)
    } else if (field === 'description') {
      if (value !== null && (typeof value !== 'string' || value.length > 65535)) {
        return { error: 'description must be a string or null' }
      }
      fields[field] = value
    } else if (field === 'image_url') {
      if (value !== null && (typeof value !== 'string' || value.length > 2048)) {
        return { error: 'image_url must be a string of at most 2048 characters or null' }
      }
      fields.image = value
    }
  }

  if (partial && Object.keys(fields).length === 0) {
    return { error: 'At least one supported product field must be supplied' }
  }

  return { fields }
}

export async function listProducts(request, response) {
  try {
    const products = await Product.find({ availability: 'AVAILABLE' }).sort({ created_at: -1, _id: -1 }).lean()
    return response.json({
      success: true,
      message: 'Products retrieved',
      data: products.map((product) => productForResponse(request, product)),
    })
  } catch (error) {
    console.error('Failed to retrieve products:', error)
    return response.status(500).json({ success: false, message: 'Failed to retrieve products', data: null })
  }
}

export async function getProduct(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(400).json({ success: false, message: 'Invalid product ID', data: null })
  }

  try {
    const product = await Product.findById(request.params.id).lean()
    if (!product) {
      return response.status(404).json({ success: false, message: 'Product not found', data: null })
    }
    return response.json({ success: true, message: 'Product retrieved', data: productForResponse(request, product) })
  } catch (error) {
    console.error('Failed to retrieve product:', error)
    return response.status(500).json({ success: false, message: 'Failed to retrieve product', data: null })
  }
}

export async function listFarmerProducts(request, response) {
  try {
    const products = await Product.find({ farmer_id: request.user.id }).sort({ created_at: -1, _id: -1 }).lean()
    return response.json({
      success: true,
      message: 'Farmer products retrieved',
      data: products.map((product) => productForResponse(request, product)),
    })
  } catch (error) {
    console.error('Failed to retrieve farmer products:', error)
    return response.status(500).json({ success: false, message: 'Failed to retrieve farmer products', data: null })
  }
}

export async function createProduct(request, response) {
  const body = { ...request.body }
  if (request.file) body.image_url = uploadedImagePath(request)
  else if (body.image_url) body.image_url = normalizeImageUrl(request, body.image_url)
  const validation = validateProductFields(body)
  if (validation.error) {
    await removeRequestUpload(request)
    return response.status(400).json({ success: false, message: validation.error, data: null })
  }

  try {
    const product = await Product.create({
      ...validation.fields,
      farmer_id: request.user.id,
      image: validation.fields.image ?? null,
    })
    return response.status(201).json({
      success: true,
      message: 'Product created',
      data: productForResponse(request, product),
    })
  } catch (error) {
    await removeRequestUpload(request)
    console.error('Failed to create product:', error)
    return response.status(500).json({ success: false, message: 'Failed to create product', data: null })
  }
}

export async function updateProduct(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(400).json({ success: false, message: 'Invalid product ID', data: null })
  }

  const body = { ...request.body }
  if (request.file) body.image_url = uploadedImagePath(request)
  else if (body.image_url) body.image_url = normalizeImageUrl(request, body.image_url)
  const validation = validateProductFields(body, true)
  if (validation.error) {
    await removeRequestUpload(request)
    return response.status(400).json({ success: false, message: validation.error, data: null })
  }

  let imageSaved = false
  try {
    const product = await Product.findById(request.params.id)
    if (!product) {
      await removeRequestUpload(request)
      return response.status(404).json({ success: false, message: 'Product not found', data: null })
    }
    if (idString(product.farmer_id) !== request.user.id) {
      await removeRequestUpload(request)
      return response.status(403).json({ success: false, message: 'You do not own this product', data: null })
    }

    const previousImage = product.image
    Object.assign(product, validation.fields)
    await product.save()
    imageSaved = true
    if (request.file && previousImage !== product.image) {
      await removeStoredUpload(previousImage)
    }
    return response.json({
      success: true,
      message: 'Product updated',
      data: productForResponse(request, product),
    })
  } catch (error) {
    if (!imageSaved) await removeRequestUpload(request)
    console.error('Failed to update product:', error)
    return response.status(500).json({ success: false, message: 'Failed to update product', data: null })
  }
}

export async function deleteProduct(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(400).json({ success: false, message: 'Invalid product ID', data: null })
  }

  try {
    const product = await Product.findById(request.params.id)
    if (!product) {
      return response.status(404).json({ success: false, message: 'Product not found', data: null })
    }
    if (idString(product.farmer_id) !== request.user.id) {
      return response.status(403).json({ success: false, message: 'You do not own this product', data: null })
    }

    product.availability = 'UNAVAILABLE'
    await product.save()
    return response.json({
      success: true,
      message: 'Product removed from availability',
      data: { id: idString(product._id), availability: product.availability },
    })
  } catch (error) {
    console.error('Failed to delete product:', error)
    return response.status(500).json({ success: false, message: 'Failed to delete product', data: null })
  }
}
