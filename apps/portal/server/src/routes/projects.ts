import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, asc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { project } from '../db/schema.js'
import { requireAuth } from '../auth.js'

export const projectsRouter = new Hono()

projectsRouter.get('/', async (c) => {
  const rows = await db
    .select()
    .from(project)
    .where(eq(project.visible, 1))
    .orderBy(asc(project.order))
  return c.json(rows)
})

projectsRouter.get('/all', requireAuth, async (c) => {
  const rows = await db.select().from(project).orderBy(asc(project.order))
  return c.json(rows)
})

const projectSchema = z.object({
  nameEn: z.string().min(1),
  nameZh: z.string().min(1),
  descEn: z.string().min(1),
  descZh: z.string().min(1),
  techTags: z.array(z.string()),
  screenshotPath: z.string().nullable().optional(),
  url: z.string().url(),
  status: z.enum(['live', 'dev']),
  order: z.number().int(),
  visible: z.boolean(),
})

projectsRouter.post('/', requireAuth, zValidator('json', projectSchema), async (c) => {
  const data = c.req.valid('json')
  const [inserted] = await db
    .insert(project)
    .values({
      ...data,
      techTags: JSON.stringify(data.techTags),
      visible: data.visible ? 1 : 0,
    })
    .returning()
  return c.json(inserted, 201)
})

projectsRouter.put('/:id', requireAuth, zValidator('json', projectSchema), async (c) => {
  const id = Number(c.req.param('id'))
  const data = c.req.valid('json')

  const [updated] = await db
    .update(project)
    .set({
      ...data,
      techTags: JSON.stringify(data.techTags),
      visible: data.visible ? 1 : 0,
    })
    .where(eq(project.id, id))
    .returning()

  if (!updated) return c.json({ error: 'Not found' }, 404)
  return c.json(updated)
})

projectsRouter.delete('/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  await db.delete(project).where(eq(project.id, id))
  return c.json({ ok: true })
})
