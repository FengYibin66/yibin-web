#!/usr/bin/env node
/**
 * 音频重编码（ADR 20260903140618）。
 *
 * 两件事：
 *
 * 1. **环境音降码率。** 三段房间环境音原先是 320kbps 立体声——环境声不需要
 *    那个码率，而它们**阻塞房间 READY**（审计 A5：drei 的 PositionalAudio
 *    走 useLoader 会 Suspend，Projects 的 2.35MB 与 Contact 的 1.66MB 挂在
 *    房间的 Suspense 边界里，8 秒加载超时很容易被撑爆）。改用 Howler 回调式
 *    加载后不再阻塞，但下载量本身仍值得降。单声道 64kbps 对定位音效足够：
 *    3D 定位由 PannerNode 做，源本身是不是立体声无关。
 *
 * 2. **格式兜底。** WebKit 不支持 OGG Vorbis，走廊 BGM 原先只有 .ogg，
 *    于是在所有 Safari 与全部 iOS 浏览器完全静音（审计 C1）。m4a 已在止血批
 *    里补好，这里把它纳入统一脚本以便日后重跑。
 *
 * 依赖系统 ffmpeg（`brew install ffmpeg`）。刻意不加 ffmpeg-static 作为
 * devDependency：那是 30MB+ 的二进制，而这个脚本是一次性构建步骤，不进 CI。
 *
 * 成就提示音是合成的，不来自素材，命令记在这里以便重现：
 *
 *   ffmpeg -y -f lavfi -i "sine=frequency=440:duration=0.14" \
 *          -f lavfi -i "sine=frequency=659.25:duration=0.42" \
 *          -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1[c];\
 *            [c]afade=t=in:st=0:d=0.02,afade=t=out:st=0.22:d=0.34,\
 *            volume=0.6,aformat=sample_rates=44100[a]" \
 *          -map "[a]" -c:a aac -b:a 96k -ac 1 achievement_chime.m4a
 *
 * A4 → E5，与原先裸 AudioContext 现场合成的那组音一致（审计 C4）。
 *
 * 用法：
 *   node scripts/media/encode-audio.mjs            重新编码（跳过已是最新的）
 *   node scripts/media/encode-audio.mjs --force     强制重编
 *   node scripts/media/encode-audio.mjs --check     只报告，不写文件
 */
import { execFileSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
/**
 * 源与产物分开放：
 *
 * - `media-src/sounds/`  原始素材（320kbps 立体声 mp3、ogg），**不在 public 下**
 * - `public/sounds/`     部署产物（重编码后的 m4a）
 *
 * 分开的理由是 `public/` 会被 Next 整体拷进 `out/`，而 `out/` 就是线上目录。
 * 原始素材留在 public 里的时候，四段共 6.8MB 的 mp3 每次部署都被发到 CVM 上、
 * 占着构建产物体积，却再也不会有任何请求命中它们。
 */
const SRC = resolve(HERE, '../../media-src/sounds')
const OUT = resolve(HERE, '../../public/sounds')

/** 环境音：单声道 64kbps AAC。3D 定位由 PannerNode 做，源不必是立体声 */
const AMBIENCE = [
  { from: 'szumwiatru.mp3', to: 'amb_about.m4a', bitrate: '64k', channels: 1 },
  { from: 'szummonitorow.mp3', to: 'amb_projects.m4a', bitrate: '64k', channels: 1 },
  { from: 'szummorza.mp3', to: 'amb_contact.m4a', bitrate: '64k', channels: 1 },
  { from: 'szummiasta.mp3', to: 'amb_publications.m4a', bitrate: '64k', channels: 1 },
]

/** BGM：立体声（音乐性内容，单声道会明显变窄），64kbps 已足够 */
const MUSIC = [
  { from: 'bg_corridor.ogg', to: 'bg_corridor.m4a', bitrate: '64k', channels: 2 },
]

const force = process.argv.includes('--force')
const checkOnly = process.argv.includes('--check')

/**
 * `bg_corridor.ogg` 仍住在 `public/`——它是音频清单里声明的 fallback 源，
 * `__tests__/soundManifest.test.ts` 会断言清单里每个候选文件真实可达。
 * 其余源只用于离线重编码，放 `media-src/`。
 */
function srcDirFor(from) {
  return from.endsWith('.ogg') ? OUT : SRC
}

function hasFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function kb(path) {
  return existsSync(path) ? Math.round(statSync(path).size / 1024) : 0
}

function needsWork({ from, to }) {
  const src = join(srcDirFor(from), from)
  const dst = join(OUT, to)
  if (!existsSync(src)) return { skip: true, reason: `源文件缺失：${from}` }
  if (!existsSync(dst)) return { skip: false }
  if (force) return { skip: false }
  // 目标比源新 → 已是最新
  if (statSync(dst).mtimeMs >= statSync(src).mtimeMs) {
    return { skip: true, reason: '已是最新' }
  }
  return { skip: false }
}

let encoded = 0
let savedKb = 0
let problems = 0

for (const job of [...AMBIENCE, ...MUSIC]) {
  const { from, to, bitrate, channels } = job
  const src = join(srcDirFor(from), from)
  const dst = join(OUT, to)
  const state = needsWork(job)

  if (state.skip) {
    console.log(`  · ${to.padEnd(24)} ${state.reason}`)
    if (state.reason?.startsWith('源文件缺失')) problems += 1
    continue
  }

  if (checkOnly) {
    console.log(`  ! ${to.padEnd(24)} 需要重新编码`)
    problems += 1
    continue
  }

  if (!hasFfmpeg()) {
    console.error('需要 ffmpeg：brew install ffmpeg')
    process.exit(1)
  }

  const before = kb(src)
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-i', src,
    '-c:a', 'aac',
    '-b:a', bitrate,
    '-ac', String(channels),
    dst,
  ])
  const after = kb(dst)
  encoded += 1
  savedKb += before - after
  console.log(`  ✓ ${to.padEnd(24)} ${before} KB → ${after} KB（${channels === 1 ? '单声道' : '立体声'} ${bitrate}）`)
}

if (checkOnly) {
  console.log(problems === 0 ? '\n[同步] 音频已是最新' : `\n[待处理] ${problems} 个文件`)
  process.exit(problems === 0 ? 0 : 1)
}

console.log(`\n重编码 ${encoded} 个文件，共省下 ${savedKb} KB`)
if (problems > 0) process.exit(1)
