#!/usr/bin/env node
/**
 * 入口页纹理瘦身。
 *
 * ## 问题
 *
 * 入口页一次拉 1626 KB 图片，最大的一张是 `wall_bricks_2.webp`
 * ——2048×1024、**604 KB**。它是入口面板的背景砖墙，实际显示宽度在桌面上
 * 约 720px、手机上约 390px。2048 的横向分辨率一半都用不到。
 *
 * 砖墙这类高熵纹理特别吃码率（砖缝是密集的高频细节），所以它一张就占了
 * 入口页图片总量的 37%。
 *
 * ## 做法
 *
 * 按"实际显示尺寸的 2 倍"（覆盖 2x DPR）设上限重编码。上限写在声明里而不是
 * 一刀切，因为不同贴图的用途差别很大——背景砖墙可以降，而鸭子对话框里的
 * 文字如果降糊了会看不清。
 *
 * ## 为什么不用 next/image
 *
 * 这些贴图是 **three.js 的纹理**，由 `useTexture` 加载，不经过 Next 的图片
 * 管线（而且 `output: 'export'` 下 Next 的图片优化本来就不可用——
 * ADR 20260822120803：没有运行时）。所以瘦身必须在构建前做。
 *
 * 用法：
 *   node scripts/media/optimize-textures.mjs           生成
 *   node scripts/media/optimize-textures.mjs --check    校验产物比源新
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { checkFresh, digestOf, writeStamp } from './freshness.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, '../../media-src/textures')
const OUT = resolve(HERE, '../../public/textures')

/**
 * 每个纹理的最大边长与质量。
 *
 * 上限的依据是"实际显示尺寸 × 2（DPR）"，逐个量的，不是一刀切：
 *
 * - `wall_bricks_2`：入口面板背景，桌面显示宽约 720px → 1024 够
 * - `pot_with_duck`：鸭子那一块，显示宽约 260px → 768 够（留余量，
 *   它有细线条）
 * - `sign`：门牌，显示宽约 300px → 768
 * - 其余 1024² 的贴图显示尺寸都在 200px 以内 → 512
 *
 * 两个例外（`skip: true`）见 `targets` 里的注释。
 */
const PLAN = {
  dir: 'entrance',
  targets: {
    wall_bricks_2: { maxSide: 1024, quality: 78 },
    pot_with_duck: { maxSide: 768, quality: 84 },
    sign: { maxSide: 768, quality: 84 },
    tree_sketch: { maxSide: 512, quality: 84 },
    window_sketch: { maxSide: 512, quality: 84 },
    avatar_window: { maxSide: 512, quality: 84 },
    bug_sketch: { maxSide: 512, quality: 86 },
    cat_front_body: { maxSide: 512, quality: 84 },
    mouse_hanging: { maxSide: 512, quality: 84 },
    floor_paper: { maxSide: 768, quality: 80 },
    /*
      这两个不动。

      - `speech_bubble` 里有文字，糊了看不清，所以尺寸不能降；而按
        quality 88 重编码**比原图还大 7%**——原图的编码参数已经更优，
        重压一遍只是白白多一次有损。
      - `stone-path` 是 389×779 的竖长图，`fit: inside` 会按短边缩到
        256×512，把纵向的石板路压得比需要的还小。

      「不动它」也是一种优化结果。显式的 skip 比在 targets 里填一个
      形同虚设的上限诚实。
    */
    speech_bubble: { skip: true },
    'stone-path': { skip: true },
  },
}


/*
  `--check` 判的是**内容指纹**（`./freshness.mjs`），不是 mtime。

  git 不保存 mtime：新克隆里所有文件的 mtime 都是签出那一刻，先后顺序取决于
  checkout 的写入顺序。按 mtime 判定属于"本地永远绿、CI 永远红"，CI 第一次跑
  就抓到了。指纹里也包含生成脚本本身——改了参数而源没变时，产物同样过期。
*/
const STAMP_NAME = 'optimize-textures'

const checkOnly = process.argv.includes('--check')

if (!existsSync(join(SRC, PLAN.dir))) {
  console.error(`  ✗ 缺少源目录：media-src/textures/${PLAN.dir}`)
  process.exit(1)
}

mkdirSync(join(OUT, PLAN.dir), { recursive: true })

const stampSources = readdirSync(join(SRC, PLAN.dir))
  .filter(f => f.endsWith('.webp'))
  .sort()
const stampInputs = [
  ...stampSources.map(f => join(SRC, PLAN.dir, f)),
  fileURLToPath(import.meta.url),
]
const stampOutputs = stampSources.map(f => join(OUT, PLAN.dir, f))

if (checkOnly) {
  const { fresh, reason } = checkFresh(STAMP_NAME, stampInputs, stampOutputs)
  console.log(`  ${fresh ? '·' : '!'} 入口页纹理  ${reason}`)
  console.log(fresh
    ? '\n[同步] 纹理已是最新'
    : '\n[待处理] 跑 node scripts/media/optimize-textures.mjs')
  process.exit(fresh ? 0 : 1)
}

let problems = 0
let before = 0
let after = 0

for (const file of readdirSync(join(SRC, PLAN.dir)).sort()) {
  if (!file.endsWith('.webp')) continue
  const stem = file.replace(/\.webp$/, '')
  const src = join(SRC, PLAN.dir, file)
  const dst = join(OUT, PLAN.dir, file)
  const target = PLAN.targets[stem]

  if (!target) {
    console.error(`  ✗ ${stem} 没有在 PLAN.targets 里声明上限`)
    problems += 1
    continue
  }

  const meta = await sharp(src).metadata()
  const srcKb = statSync(src).size / 1024
  before += srcKb

  if (target.skip) {
    /*
      **原样拷字节**，不能走 sharp。

      `sharp(src).toFile(dst)` 会解码再编码一遍——即使不改尺寸也是一次有损
      重压。`stone-path` 因此从 92 KB 变成 111 KB：比不动它还差。
      "skip" 的意思是不动它，那就真的不要动。
      （这是测试「产物都比原图小或相等」抓出来的。）
    */
    copyFileSync(src, dst)
    after += statSync(dst).size / 1024
    console.log(`  · ${file.padEnd(24)} ${meta.width}x${meta.height} 原样拷贝（见 PLAN 注释）`)
    continue
  }

  /*
    `withoutEnlargement`：源图本来就比上限小时不放大。放大只会变模糊、变大，
    没有任何好处——`stone-path` 就是 389px 宽。
  */
  await sharp(src)
    .resize(target.maxSide, target.maxSide, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: target.quality, effort: 6 })
    .toFile(dst)

  const outMeta = await sharp(dst).metadata()
  const dstKb = statSync(dst).size / 1024
  after += dstKb

  const shrink = srcKb > 0 ? Math.round((1 - dstKb / srcKb) * 100) : 0
  console.log(
    `  ✓ ${file.padEnd(24)} ${meta.width}x${meta.height} → ${outMeta.width}x${outMeta.height}` +
    `  ${srcKb.toFixed(0).padStart(4)} KB → ${dstKb.toFixed(0).padStart(4)} KB  (−${shrink}%)`,
  )
}

if (problems === 0) writeStamp(STAMP_NAME, digestOf(stampInputs), stampOutputs)

console.log(
  `\n合计 ${before.toFixed(0)} KB → ${after.toFixed(0)} KB` +
  `（省下 ${(before - after).toFixed(0)} KB）`,
)
process.exit(problems === 0 ? 0 : 1)
