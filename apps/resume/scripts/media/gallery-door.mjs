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
import { checkFresh, digestOf, writeStamp } from './freshness.mjs'
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


/*
  `--check` 判的是**内容指纹**（`./freshness.mjs`），不是 mtime。

  git 不保存 mtime：新克隆里所有文件的 mtime 都是签出那一刻，先后顺序取决于
  checkout 的写入顺序。按 mtime 判定属于"本地永远绿、CI 永远红"，CI 第一次跑
  就抓到了。指纹里也包含生成脚本本身——改了参数而源没变时，产物同样过期。
*/
const STAMP_NAME = 'gallery-door'
const stampInputs = [
  ...DOOR_PLANS.map(d => join(SRC, `${d.id}.webp`)),
  fileURLToPath(import.meta.url),
  join(HERE, 'stickerArt.mjs'),
  resolve(HERE, '../../lib/lab/domain/galleryDoorPlan.mjs'),
]
const stampOutputs = DOOR_PLANS.map(d =>
  join(PUBLIC_TEXTURES, d.dir, `${d.id}.webp`))

const checkOnly = process.argv.includes('--check')

if (checkOnly) {
  const { fresh, reason } = checkFresh(STAMP_NAME, stampInputs, stampOutputs)
  console.log(`  ${fresh ? '·' : '!'} 门贴图  ${reason}`)
  console.log(fresh
    ? '\n[同步] 门贴图已是最新'
    : '\n[待处理] 跑 node scripts/media/gallery-door.mjs')
  process.exit(fresh ? 0 : 1)
}

let problems = 0

for (const door of DOOR_PLANS) {
  const src = join(SRC, `${door.id}.webp`)
  const dst = join(PUBLIC_TEXTURES, door.dir, `${door.id}.webp`)

  if (!existsSync(src)) {
    console.error(`  ✗ 缺少原图：media-src/doors/${door.id}.webp`)
    problems += 1
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

writeStamp(STAMP_NAME, digestOf(stampInputs), stampOutputs)
console.log('\n完成')
