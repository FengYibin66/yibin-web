#!/usr/bin/env node
/**
 * 活物纸偶切层（规格 lab-companions.md §6，ADR 20260908160918）。
 *
 * 源是手写 SVG（`media-src/textures/companion/dog.svg`），每个部件一个顶层
 * `<g id>`。脚本对每个 id 单独栅格化——把其余顶层组隐藏，画布不变——于是
 * 所有部件产物共用同一套坐标，渲染时叠在一起、各自绕 `dogParts.mjs` 声明的
 * 枢轴转就行，不需要裁切框。
 *
 * 校验：每个部件的实际笔迹包围盒必须**包住**声明的枢轴（容差 8%）。
 * 画稿挪了一笔而声明没改，这里就报错，不等到实机上看见腿绕着空气转。
 *
 * 用法：
 *   node scripts/media/companion-parts.mjs            重新出图
 *   node scripts/media/companion-parts.mjs --check    只报告（CI 由 mediaFreshness.test.ts 覆盖）
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import {
  DOG_PART_FILES,
  DOG_SIDE_PARTS,
  DOG_SIT_PART,
} from '../../lib/lab/domain/corridor/dogParts.mjs'
import { checkFresh, digestOf, writeStamp } from './freshness.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, '../../media-src/textures/companion')
const OUT = resolve(HERE, '../../public/textures/corridor/companion')
const DECL = resolve(HERE, '../../lib/lab/domain/corridor/dogParts.mjs')

/** 产物边长。猫是 512，狗同级 */
const SIZE = 512
/** 枢轴落在包围盒之外多少以内仍算对得上 */
const PIVOT_TOLERANCE = 0.08

const STAMP_NAME = 'companion-parts'
const SIDE_SVG = join(SRC, 'dog.svg')
const SIT_SVG = join(SRC, 'dog_sit.svg')
const stampInputs = [SIDE_SVG, SIT_SVG, DECL, fileURLToPath(import.meta.url)]
const stampOutputs = Object.values(DOG_PART_FILES).map(f => join(OUT, `${f}.webp`))

const checkOnly = process.argv.includes('--check')

if (checkOnly) {
  const { fresh, reason } = checkFresh(STAMP_NAME, stampInputs, stampOutputs)
  console.log(`  ${fresh ? '·' : '!'} 活物部件  ${reason}`)
  console.log(fresh ? '\n[同步] 活物部件已是最新' : '\n[待处理] 跑 node scripts/media/companion-parts.mjs')
  process.exit(fresh ? 0 : 1)
}

for (const p of [SIDE_SVG, SIT_SVG]) {
  if (!existsSync(p)) {
    console.error(`  ✗ 缺少源：${p}`)
    process.exit(1)
  }
}
mkdirSync(OUT, { recursive: true })

/** 只留一个顶层组可见 */
function isolate(svgText, id) {
  const style = `<style>svg > g[id]:not(#${id}) { display: none; }</style>`
  return svgText.replace(/<svg([^>]*)>/, (m) => `${m}${style}`)
}

/** 从 RGBA 像素里找有墨迹的包围盒（alpha > 8），归一化 0..1 */
function alphaBounds(rgba, size) {
  let minX = size, minY = size, maxX = -1, maxY = -1
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (rgba[(y * size + x) * 4 + 3] > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { minU: minX / size, maxU: (maxX + 1) / size, minV: minY / size, maxV: (maxY + 1) / size }
}

async function render(svgText, outFile, pivot, label) {
  const pipeline = sharp(Buffer.from(svgText), { density: 144 }).resize(SIZE, SIZE, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  const raw = await pipeline.clone().ensureAlpha().raw().toBuffer()
  const bounds = alphaBounds(raw, SIZE)
  if (!bounds) throw new Error(`${label}：渲染后没有任何笔迹——id 写错了？`)

  const [pu, pv] = pivot
  const inside =
    pu >= bounds.minU - PIVOT_TOLERANCE && pu <= bounds.maxU + PIVOT_TOLERANCE &&
    pv >= bounds.minV - PIVOT_TOLERANCE && pv <= bounds.maxV + PIVOT_TOLERANCE
  if (!inside) {
    throw new Error(
      `${label}：声明的枢轴 (${pu}, ${pv}) 不在笔迹包围盒内 ` +
      `u∈[${bounds.minU.toFixed(3)}, ${bounds.maxU.toFixed(3)}] v∈[${bounds.minV.toFixed(3)}, ${bounds.maxV.toFixed(3)}]——画稿与 dogParts.mjs 对不上`,
    )
  }

  const info = await pipeline.webp({ quality: 90, alphaQuality: 90, effort: 6 }).toFile(outFile)
  console.log(
    `  ✓ ${label.padEnd(14)} ${String(Math.round(info.size / 1024)).padStart(3)} KB  ` +
    `笔迹 u∈[${bounds.minU.toFixed(2)},${bounds.maxU.toFixed(2)}] v∈[${bounds.minV.toFixed(2)},${bounds.maxV.toFixed(2)}]`,
  )
}

const sideSvg = readFileSync(SIDE_SVG, 'utf8')
for (const [id, decl] of Object.entries(DOG_SIDE_PARTS)) {
  await render(isolate(sideSvg, id), join(OUT, `${DOG_PART_FILES[id]}.webp`), decl.pivot, id)
}
await render(readFileSync(SIT_SVG, 'utf8'), join(OUT, `${DOG_PART_FILES.sit}.webp`), DOG_SIT_PART.pivot, 'sit')

writeStamp(STAMP_NAME, digestOf(stampInputs), stampOutputs)
console.log(`\n${stampOutputs.length} 张 → public/textures/corridor/companion/`)
