import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { profile } from '../db/schema.js'
import { requireAuth } from '../auth.js'

export const profileRouter = new Hono()

profileRouter.get('/', async (c) => {
  const [row] = await db.select().from(profile).where(eq(profile.id, 1))
  return c.json(row ?? null)
})

const profileSchema = z.object({
  nameEn: z.string().min(1),
  nameZh: z.string().min(1),
  bioEn: z.string().min(1),
  bioZh: z.string().min(1),
  avatarPath: z.string(),
  github: z.string(),
  linkedin: z.string(),
  email: z.string().email(),
})

profileRouter.put('/', requireAuth, zValidator('json', profileSchema), async (c) => {
  const data = c.req.valid('json')

  await db
    .insert(profile)
    .values({ id: 1, ...data, updatedAt: Math.floor(Date.now() / 1000) })
    .onConflictDoUpdate({
      target: profile.id,
      set: { ...data, updatedAt: Math.floor(Date.now() / 1000) },
    })

  const [updated] = await db.select().from(profile).where(eq(profile.id, 1))
  return c.json(updated)
})
