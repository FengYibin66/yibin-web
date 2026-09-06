#!/usr/bin/env node
/**
 * 荣誉与证书页的图片瘦身。
 *
 * ## 问题
 *
 * `/classic/credentials/` 上 11 张图原来直接发 `public/` 里的原图：**共 7064 KB**，
 * 最大一张 `NECCS.png` 2060 KB——一张证书照片存成了 PNG，格式本身就错了。
 * 而卡片的显示宽度只有约 368px（`max-w-6xl` 三列），点开的灯箱最宽 960px。
 * 3052×2128 的原图，横向分辨率连灯箱都用不满一半。
 *
 * 还有一张 `CSCS_Card_back.png`（508 KB）数据里根本没引用，每次部署白发。
 *
 * ## 做法
 *
 * 与 `optimize-textures.mjs` 同一套：原图住 `media-src/credentials/`（不部署），
 * 这里按声明的上限重编码成 webp 出到 `public/credentials/`。上限分两档：
 *
 * - **文件类**（证书、奖状）1600px / q80：灯箱里要能读清小字，960px × 约 1.7 DPR
 * - **照片类**（颁奖合影、奖杯实拍）1280px / q78：没有需要辨认的文字
 *
 * `.rotate()` 不带参数是**按 EXIF 方向摆正**：手机拍的证书带方向标签，浏览器
 * 显示 `<img>` 时会照着转，但 sharp 重编码若不摆正，标签丢了图就横了。
 *
 * ## 为什么不用 next/image
 *
 * `output: 'export'` 下 Next 的图片优化不可用（ADR 20260822120803：没有运行时）。
 *
 * 用法：
 *   node scripts/media/optimize-credentials.mjs           生成
 *   node scripts/media/optimize-credentials.mjs --check   校验产物与源、脚本同步
 */
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { checkFresh, digestOf, writeStamp } from './freshness.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, '../../media-src/credentials')
const OUT = resolve(HERE, '../../public/credentials')

const DOCUMENT = { maxSide: 1600, quality: 80 }
const PHOTO = { maxSide: 1280, quality: 78 }

/**
 * 每张图属于哪一档。**没在这里声明的源文件会让脚本报错**——加一张图就得
 * 想一下它是文件还是照片，而不是默认按某一档处理。
 *
 * `unused: true` 的不发：原图留在 media-src 备用，但不出产物。
 */
const PLAN = {
  awards: {
    Outstanding_Graduate_Zhangguifang_Scholarship: PHOTO,   // 颁奖合影
    '1st_pro_cidaren': DOCUMENT,
    '2rd_national_cidaren': DOCUMENT,
    NECCS: DOCUMENT,
    structure_prize: PHOTO,                                  // 奖杯 + 证书实拍
    UNESCO_2: DOCUMENT,
    Bamboo_1: DOCUMENT,
  },
  certificates: {
    CSCS_Card_front: DOCUMENT,
    /*
      卡片背面。`lib/content/credentials.ts` 里没有任何条目引用它，
      发出去只是每次部署多 508 KB。原图留着——将来若要展示背面，加一条数据
      再把这里改成 DOCUMENT 即可。
    */
    CSCS_Card_back: { unused: true },
    'CET-6': DOCUMENT,
    CS50xCertificate: DOCUMENT,
    'exchange-certificate': DOCUMENT,
  },
}

const SOURCE_EXT = new Set(['.jpg', '.jpeg', '.png'])
const STAMP_NAME = 'optimize-credentials'
const checkOnly = process.argv.includes('--check')

/** 遍历 media-src/credentials/<group>/*.{jpg,jpeg,png}，按组、按文件名排序 */
function listSources() {
  const out = []
  for (const group of Object.keys(PLAN).sort()) {
    const dir = join(SRC, group)
    if (!existsSync(dir)) {
      console.error(`  ✗ 缺少源目录：media-src/credentials/${group}`)
      process.exit(1)
    }
    for (const file of readdirSync(dir).sort()) {
      const ext = extname(file).toLowerCase()
      if (!SOURCE_EXT.has(ext)) continue
      out.push({ group, file, stem: file.slice(0, -ext.length), src: join(dir, file) })
    }
  }
  return out
}

const sources = listSources()
const emitted = sources.filter(s => !PLAN[s.group]?.[s.stem]?.unused)

const stampInputs = [...sources.map(s => s.src), fileURLToPath(import.meta.url)]
const stampOutputs = emitted.map(s => join(OUT, s.group, `${s.stem}.webp`))

if (checkOnly) {
  const { fresh, reason } = checkFresh(STAMP_NAME, stampInputs, stampOutputs)
  console.log(`  ${fresh ? '·' : '!'} 荣誉与证书图片  ${reason}`)
  console.log(fresh
    ? '\n[同步] 证书图片已是最新'
    : '\n[待处理] 跑 node scripts/media/optimize-credentials.mjs')
  process.exit(fresh ? 0 : 1)
}

let problems = 0
let before = 0
let after = 0

for (const { group, file, stem, src } of sources) {
  mkdirSync(join(OUT, group), { recursive: true })
  const target = PLAN[group]?.[stem]
  const srcKb = statSync(src).size / 1024

  if (!target) {
    console.error(`  ✗ ${group}/${stem} 没有在 PLAN 里声明是文件还是照片`)
    problems += 1
    continue
  }
  if (target.unused) {
    console.log(`  · ${`${group}/${file}`.padEnd(58)} 数据未引用，不发（见 PLAN 注释）`)
    continue
  }

  before += srcKb
  const dst = join(OUT, group, `${stem}.webp`)
  const meta = await sharp(src).metadata()

  await sharp(src)
    .rotate()
    .resize(target.maxSide, target.maxSide, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: target.quality, effort: 6 })
    .toFile(dst)

  const outMeta = await sharp(dst).metadata()
  const dstKb = statSync(dst).size / 1024
  after += dstKb
  const shrink = Math.round((1 - dstKb / srcKb) * 100)
  console.log(
    `  ✓ ${`${group}/${file}`.padEnd(58)} ${meta.width}x${meta.height} → ${outMeta.width}x${outMeta.height}` +
    `  ${srcKb.toFixed(0).padStart(5)} KB → ${dstKb.toFixed(0).padStart(4)} KB  (−${shrink}%)`,
  )
}

if (problems === 0) writeStamp(STAMP_NAME, digestOf(stampInputs), stampOutputs)

console.log(`\n合计 ${before.toFixed(0)} KB → ${after.toFixed(0)} KB（省下 ${(before - after).toFixed(0)} KB）`)
process.exit(problems === 0 ? 0 : 1)
