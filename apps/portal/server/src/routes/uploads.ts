// Portal uploads — MVP: local volume + /uploads/* (see docs/specs/portal-media.md).
// TODO(phase-2): COS + CDN; replace with MediaStore + avatarUrl, remove this route.
import { Hono } from 'hono'
import { writeFile, mkdir } from 'fs/promises'
import { resolve, extname } from 'path'
import { requireAuth } from '../auth.js'

export const uploadsRouter = new Hono()

const UPLOADS_DIR = resolve(process.env.UPLOADS_DIR ?? '../uploads')
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

uploadsRouter.post('/', requireAuth, async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']

  if (!(file instanceof File)) {
    return c.json({ error: 'No file provided' }, 400)
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json({ error: 'Only JPEG, PNG, WebP allowed' }, 400)
  }
  if (file.size > MAX_SIZE) {
    return c.json({ error: 'File too large (max 5MB)' }, 400)
  }

  await mkdir(UPLOADS_DIR, { recursive: true })

  const ext = extname(file.name) || '.jpg'
  const filename = `${Date.now()}${ext}`
  const filepath = resolve(UPLOADS_DIR, filename)

  const buffer = await file.arrayBuffer()
  await writeFile(filepath, Buffer.from(buffer))

  return c.json({ path: `/uploads/${filename}` })
})
