import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import multer from 'multer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const uploadDirectory = fileURLToPath(new URL('../uploads/products/', import.meta.url))
const extensionByMimeType = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
])

fs.mkdirSync(uploadDirectory, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadDirectory,
  filename(request, file, callback) {
    callback(null, `${randomUUID()}${extensionByMimeType.get(file.mimetype)}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(request, file, callback) {
    if (!extensionByMimeType.has(file.mimetype)) {
      callback(new Error('Image must be JPG, JPEG, PNG, or WEBP'))
      return
    }
    callback(null, true)
  },
})

export const uploadProductImage = upload.single('image_file')

export function handleProductImageUploadError(error, request, response, next) {
  if (!error) return next()

  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return response.status(413).json({ success: false, message: 'Product image must be 5 MB or smaller', data: null })
  }
  if (error instanceof multer.MulterError || error.message === 'Image must be JPG, JPEG, PNG, or WEBP') {
    return response.status(400).json({ success: false, message: error.message, data: null })
  }
  return next(error)
}
