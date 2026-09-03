#!/usr/bin/env node
/**
 * 从房间注册表与走廊布局**派生**纹理预载表。
 *
 * 为什么必须是生成物（ADR 20260903140615）：预载表原先是手写的，
 * `lib/lab/{roomAssets,texturePreload}.ts` 两份清单与实际渲染树各自漂移，
 * 结果是——
 *
 *   - 为已删除的死代码（CorridorWindow / InspectableFrame）预载 4 张纹理
 *   - `ROOM_ASSETS.contact` 漏收整批云纹理 → 云退化成四个无贴图的灰矩形（A2）
 *
 * 两类都不报错。「用到什么」和「预载什么」只要是两份人手清单，就一定会漂。
 *
 * 用法：
 *   node scripts/lab/gen-asset-manifest.mjs           重新生成
 *   node scripts/lab/gen-asset-manifest.mjs --check    校验同步（CI 用）
 *
 * 与 `scripts/docs/gen_docs_index.py` 同一套纪律：生成物入 git、`--check`
 * 进 CI、文件加入 `.claude/hooks/pre-generated-edit.sh` 保护名单。
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = resolve(HERE, '../..')
const OUT_PATH = join(APP_ROOT, 'lib/lab/app/assets/manifest.gen.ts')

/**
 * 读 TS 源里的字符串字面量资源路径。
 *
 * 刻意不 import 这些模块：它们带 `@/` 别名、JSX 与 `import()`，在裸 node 里
 * 跑不起来。资源路径都是字面量，正则足够——而 `--check` 与
 * `__tests__/roomRegistry.test.ts` 会从两侧校验结果。
 */
const ASSET_RE = /'(\/(?:textures|sounds|fonts|gallery|projects|images|publications)\/[^']+\.\w{2,5})'/g

function collectFrom(relPath) {
  const full = join(APP_ROOT, relPath)
  if (!existsSync(full)) return []
  const src = readFileSync(full, 'utf8')
  return [...src.matchAll(ASSET_RE)].map(m => m[1])
}

function walk(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

// ── 走廊：从渲染根做 import 可达性遍历 ─────────────────────────────────────
//
// 刻意**不**扫整个 `components/lab/` 目录。第一版那样做，结果把未挂载的
// `CorridorWindow.tsx` 的两张纹理又加回了预载表——正是这次要消灭的浪费。
// 从渲染根出发遍历 import 图，不被任何人引用的文件自然落在图外。
const RENDER_ROOTS = ['components/lab/LabScene.tsx', 'components/lab/CorridorSegment.tsx']

/** 把一条 import 说明符解析成仓库内的文件路径；解析不到（三方包）返回 null */
function resolveImport(fromFile, specifier) {
  let base
  if (specifier.startsWith('@/')) base = join(APP_ROOT, specifier.slice(2))
  else if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier)
  else return null // node_modules

  for (const candidate of [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    join(base, 'index.tsx'),
    join(base, 'index.ts'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g
const DYNAMIC_IMPORT_RE = /import\(\s*['"]([^'"]+)['"]\s*\)/g

/** 从渲染根可达的全部仓库内文件 */
function reachableFiles(roots) {
  const seen = new Set()
  const queue = roots.map(r => join(APP_ROOT, r)).filter(existsSync)

  while (queue.length > 0) {
    const file = queue.pop()
    if (seen.has(file)) continue
    seen.add(file)

    const src = readFileSync(file, 'utf8')
    for (const re of [IMPORT_RE, DYNAMIC_IMPORT_RE]) {
      re.lastIndex = 0
      for (const m of src.matchAll(re)) {
        const target = resolveImport(file, m[1])
        if (target && !seen.has(target)) queue.push(target)
      }
    }
  }
  return seen
}

/**
 * 从扫描里排除的文件。
 *
 * 这两份就是本生成器要取代的**手写清单**。不排除的话生成器会读到自己的
 * 前身——第一次跑出来 304 条资源（比手写版还多），因为 `texturePreload.ts`
 * 同时含 `CORRIDOR_TEXTURES` 与 `ENTRANCE_TEXTURES` 两个数组，于是入口页
 * 的纹理被算进了走廊。接线完成后这两个文件会删除，届时本列表也可以删。
 */
const EXCLUDED_FROM_SCAN = new Set(
  ['lib/lab/texturePreload.ts', 'lib/lab/roomAssets.ts'].map(p => join(APP_ROOT, p)),
)

/**
 * 走廊纹理只从 `components/lab/` 里收。
 *
 * 可达性遍历会经 `RoomInterior` 走进 `components/rooms/**`，把房间纹理也算
 * 成走廊——第二次跑出来 190 条（手写版约 60 条）就是这个原因。房间资源属于
 * `ROOM_ASSETS`，按门位距离在 idle 时预取；把它们塞进首屏 loader 正是审计
 * G1 要修的问题（loader 原先要下完 7.6MB 才退场）。
 */
const CORRIDOR_SCOPE = join(APP_ROOT, 'components/lab')

function corridorTextures() {
  const found = new Set()
  for (const file of reachableFiles(RENDER_ROOTS)) {
    if (EXCLUDED_FROM_SCAN.has(file)) continue
    if (!file.startsWith(CORRIDOR_SCOPE)) continue
    const src = readFileSync(file, 'utf8')
    // 只收真正调用 useTexture / useLoader 的文件；纯常量表由房间声明负责
    if (!/useTexture|useLoader/.test(src)) continue
    for (const m of src.matchAll(ASSET_RE)) {
      if (m[1].startsWith('/textures/')) found.add(m[1])
    }
  }
  return [...found]
}

// ── 房间：从注册表的 assets 字段读 ────────────────────────────────────────
const ROOM_FILES = ['about', 'projects', 'publications', 'contact', 'gallery'].map(
  id => `lib/lab/domain/rooms/${id}.ts`,
)

function roomAssets() {
  const byRoom = {}
  for (const rel of ROOM_FILES) {
    const id = rel.match(/rooms\/(\w+)\.ts$/)[1]
    const direct = collectFrom(rel)
    // 房间文件里可能 `...CLOUD_TEXTURES` 展开，展开项要单独拿
    const usesClouds = readFileSync(join(APP_ROOT, rel), 'utf8').includes('CLOUD_TEXTURES')
    const clouds = usesClouds ? collectFrom('lib/lab/cloudTextures.ts').filter(p => p.startsWith('/textures/clouds/')) : []
    byRoom[id] = [...new Set([...direct, ...clouds])].sort()
  }
  return byRoom
}

// 壁画（走廊里从相册取的照片）不进生成物：`corridorMurals.getCorridorMurals()`
// 从 gallery 数据里按避让规则挑图，路径既非字面量也非固定规则。它由
// `manifest.gen.ts` 在运行时展开（见生成模板里的 muralTexturePaths 调用）。

function build() {
  const corridor = corridorTextures().sort()
  const rooms = roomAssets()
  const sounds = collectFrom('lib/lab/domain/audio/manifest.ts').filter(p => p.startsWith('/sounds/')).sort()

  const lines = [
    '// ⚠️ 生成物，勿手改 —— 由 scripts/lab/gen-asset-manifest.mjs 从',
    '//    lib/lab/domain/rooms/*.ts 与 components/lab/** 派生。',
    '//    改资源请改那些来源，然后运行：',
    '//        node scripts/lab/gen-asset-manifest.mjs',
    '//',
    '//    存在的理由见 ADR 20260903140615：预载表原先手写，与渲染树漂移后',
    '//    表现为"为死代码预载纹理"与"漏收云纹理导致灰矩形"，两者都不报错。',
    '',
    "import { DERIVED_CORRIDOR_TEXTURES } from '@/lib/lab/domain/corridor/assets'",
    "import { getCorridorMuralTexturePaths } from '@/lib/lab/corridorMurals'",
    '',
    '/**',
    ' * 走廊几何、门、装饰用到的纹理 —— 进首屏 loader。',
    ' *',
    ' * 三部分：静态扫描到的字面量、domain 里按规则算出的组（头像 9 帧 +',
    ' * 门贴图 sketch/painted 两层）、以及从相册取的壁画。后两类是模板字面量',
    ' * 或数据驱动，静态扫描抓不到——漏它们的表现不是报错，是走廊走到一半',
    ' * 突然闪空。',
    ' */',
    'const CORRIDOR_TEXTURE_LITERALS: readonly string[] = [',
    ...corridor.map(p => `  '${p}',`),
    '] as const',
    '',
    '/** 首屏只载前 1 段的壁画；更深的段在 idle 时预取（审计 G1：原先要下完 7.6MB 才退场） */',
    'export const FIRST_SCREEN_MURAL_SEGMENTS = 1',
    '',
    'export const CORRIDOR_TEXTURES: readonly string[] = [',
    '  ...new Set([',
    '    ...CORRIDOR_TEXTURE_LITERALS,',
    '    ...DERIVED_CORRIDOR_TEXTURES,',
    '    ...getCorridorMuralTexturePaths(FIRST_SCREEN_MURAL_SEGMENTS),',
    '  ]),',
    ']',
    '',
    '/** 每个房间声明的资源 —— 按门位距离在 idle 时预取 */',
    'export const ROOM_ASSETS: Readonly<Record<string, readonly string[]>> = {',
    ...Object.entries(rooms).flatMap(([id, assets]) => [
      `  ${id}: [`,
      ...assets.map(p => `    '${p}',`),
      '  ],',
    ]),
    '} as const',
    '',
    '/** 音频清单里出现的全部文件 */',
    'export const SOUND_FILES: readonly string[] = [',
    ...sounds.map(p => `  '${p}',`),
    '] as const',
    '',
    '/** 全部资源的扁平去重列表（供存在性校验用） */',
    'export const ALL_ASSETS: readonly string[] = [',
    ...[...new Set([...corridor, ...Object.values(rooms).flat(), ...sounds])].sort().map(p => `  '${p}',`),
    '] as const',
    '',
  ]
  return lines.join('\n')
}

const generated = build()
const checkOnly = process.argv.includes('--check')

if (checkOnly) {
  if (!existsSync(OUT_PATH)) {
    console.error(`[不同步] ${OUT_PATH} 不存在。运行 node scripts/lab/gen-asset-manifest.mjs`)
    process.exit(1)
  }
  const current = readFileSync(OUT_PATH, 'utf8')
  if (current !== generated) {
    console.error('[不同步] 预载表与声明不一致。运行 node scripts/lab/gen-asset-manifest.mjs')
    process.exit(1)
  }
  const count = (generated.match(/^\s+'\//gm) ?? []).length
  console.log(`[同步] 预载表已是最新（${count} 条资源）`)
} else {
  writeFileSync(OUT_PATH, generated)
  const count = (generated.match(/^\s+'\//gm) ?? []).length
  console.log(`[已更新] ${OUT_PATH.replace(APP_ROOT + '/', '')}（${count} 条资源）`)
}
