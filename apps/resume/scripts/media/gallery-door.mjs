#!/usr/bin/env node
/**
 * Gallery 门的贴纸重做（审计 F1，ADR 20260903140619 的连带决定）。
 *
 * 「贴哪、多大」在 `lib/lab/domain/galleryDoorPlan.mjs`（声明），
 * 「长什么样」在 `./stickerArt.mjs`（画法），这里只负责合成。
 *
 * 为什么是"新贴纸盖旧贴纸"而不是"修木纹"——见那份声明顶部，简短版：
 * 试过取样平铺，镜像反而造出对称蝴蝶纹，补丁边界肉眼可见，而横跨两块面板
 * 之间的贴纸怎么调矩形都留着。门上贴纸叠贴纸本来就是常态。
 *
 * 用法：
 *   node scripts/media/gallery-door.mjs           生成
 *   node scripts/media/gallery-door.mjs --check    校验产物比原图新
 */
import { existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { DOOR_PLANS, coverSize } from '../../lib/lab/domain/galleryDoorPlan.mjs'
import { STICKER_ART } from './stickerArt.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, '../../media-src/doors')
const PUBLIC_TEXTURES = resolve(HERE, '../../public/textures')

/**
 * 渲染一张贴纸，尺寸按"盖住这个区域"算。
 *
 * 形状有自己的自然长宽比，等比放大——不拉伸，拉伸会把圆的镜头变成椭圆。
 * 溢出是允许的：贴纸本来就该比它盖的东西大一点。
 */
async function renderSticker(kind, region, rotate, seed) {
  const art = STICKER_ART[kind]
  if (!art) throw new Error(`没有这种贴纸：${kind}`)

  // 旋转要参与尺寸计算：倾斜后能盖住的正矩形反而变小（见 coverSize 注释）
  const { width, height } = coverSize(art.viewBox, region, { rotate })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"
                    width="${art.viewBox.width}" height="${art.viewBox.height}"
                    viewBox="0 0 ${art.viewBox.width} ${art.viewBox.height}"
               >${art.body(seed)}</svg>`

  const flat = await sharp(Buffer.from(svg))
    .resize(Math.round(width), Math.round(height), { fit: 'fill' })
    .png()
    .toBuffer()

  if (rotate === 0) {
    return { buffer: flat, width: Math.round(width), height: Math.round(height) }
  }

  const rotated = await sharp(flat)
    .rotate(rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  const meta = await sharp(rotated).metadata()
  return { buffer: rotated, width: meta.width, height: meta.height }
}

const checkOnly = process.argv.includes('--check')
let problems = 0

for (const door of DOOR_PLANS) {
  const src = join(SRC, `${door.id}.webp`)
  const dst = join(PUBLIC_TEXTURES, door.dir, `${door.id}.webp`)

  if (!existsSync(src)) {
    console.error(`  ✗ 缺少原图：media-src/doors/${door.id}.webp`)
    problems += 1
    continue
  }

  if (checkOnly) {
    const ok = existsSync(dst) && statSync(dst).mtimeMs >= statSync(src).mtimeMs
    console.log(`  ${ok ? '·' : '!'} ${door.id}  ${ok ? '已是最新' : '需要重新生成'}`)
    if (!ok) problems += 1
    continue
  }

  const layers = []
  for (const [i, patch] of door.patches.entries()) {
    const { buffer, width, height } = await renderSticker(
      patch.kind,
      patch.region,
      patch.rotate ?? 0,
      i * 23 + 5,
    )
    /*
      居中在区域上。旋转会让画布变大（sharp 输出的是外接矩形），所以偏移要
      用旋转**之后**的实际尺寸算——用旋转前的尺寸会让贴纸偏离它要盖的东西。
    */
    const cx = patch.region.left + patch.region.width / 2
    const cy = patch.region.top + patch.region.height / 2
    layers.push({
      input: buffer,
      left: Math.max(0, Math.round(cx - width / 2)),
      top: Math.max(0, Math.round(cy - height / 2)),
    })
  }

  await sharp(src).composite(layers).webp({ quality: 88 }).toFile(dst)
  const kb = Math.round(statSync(dst).size / 1024)
  console.log(`  ✓ ${door.id}  ${door.patches.length} 张贴纸  ${kb} KB`)
}

if (problems > 0) {
  console.log(`\n[待处理] ${problems} 项`)
  process.exit(1)
}
console.log(checkOnly ? '\n[同步] 门贴图已是最新' : '\n完成')
