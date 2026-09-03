/**
 * 素材流水线的「产物是否最新」判定。
 *
 * ## 为什么不能用 mtime
 *
 * 四条流水线（音频 / 门贴纸 / 纹理 / 字体）的 `--check` 第一版都是比
 * `mtime`：产物比源新就算最新。本地跑没问题，**CI 上必然失败**——
 * git 不保存 mtime，新克隆里所有文件的 mtime 都是签出那一刻，先后顺序
 * 完全取决于 checkout 的写入顺序。
 *
 * 这个错误在 CI 第一次跑就暴露了（`校验音频重编码产物` 挂掉）。它属于
 * "本地永远绿、CI 永远红"的那一类，而不是"偶发"。
 *
 * ## 做法
 *
 * 记一份**内容指纹**：源文件 + 生成脚本 + 计划声明各自的 sha256，合起来
 * 再哈希一次，写进 `media-src/.stamps/<name>.json`（跟着源一起提交，不部署）。
 *
 * 脚本也进指纹，因为改了编码参数（码率、质量、尺寸上限）而源没变时，
 * 产物同样是过期的——只看源的哈希抓不到这种情况。
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP = resolve(HERE, '../..')
const STAMP_DIR = join(APP, 'media-src/.stamps')

function fileHash(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

/**
 * 计算指纹。
 *
 * @param inputs 参与指纹的文件绝对路径（源 + 脚本 + 计划声明）
 */
export function digestOf(inputs) {
  const parts = [...inputs].sort().map(path => {
    const rel = relative(APP, path)
    return existsSync(path) ? `${rel}:${fileHash(path)}` : `${rel}:MISSING`
  })
  return createHash('sha256').update(parts.join('\n')).digest('hex')
}

function stampPath(name) {
  return join(STAMP_DIR, `${name}.json`)
}

/**
 * 写下指纹。生成流程的最后一步。
 *
 * `outputs` 是可选的第三个参数：给了就同时记下**产物**的指纹，于是手改
 * `public/` 下的派生文件也会被 `--check` 抓到。不给的话只记输入指纹
 * （`entry-firstframe` 那条的"源"是整个 `out/`，不适用）。
 */
export function writeStamp(name, digest, outputs) {
  mkdirSync(STAMP_DIR, { recursive: true })
  const payload = { digest, note: '内容指纹，见 scripts/media/freshness.mjs' }
  if (outputs !== undefined) payload.outputDigest = digestOf(outputs)
  writeFileSync(stampPath(name), `${JSON.stringify(payload, null, 2)}\n`)
}

/** 读回指纹。没有 stamp 时返回 null（视为过期） */
export function readStamp(name) {
  return readStampField(name, 'digest')
}

/** 读回产物指纹。没记过（旧 stamp）时返回 null */
export function readOutputStamp(name) {
  return readStampField(name, 'outputDigest')
}

function readStampField(name, field) {
  const path = stampPath(name)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))[field] ?? null
  } catch {
    return null
  }
}

/**
 * 产物是否与当前的源 + 脚本一致。
 *
 * @returns `{ fresh, reason }`——`reason` 用于让 `--check` 的输出说清是
 *   "没有 stamp"还是"指纹不一致"，而不是只说一句"过期"。
 */
export function checkFresh(name, inputs, outputs) {
  const missing = outputs.filter(path => !existsSync(path)).map(p => relative(APP, p))
  if (missing.length > 0) {
    return { fresh: false, reason: `产物缺失：${missing.join(', ')}` }
  }

  const stamp = readStamp(name)
  if (stamp === null) {
    return { fresh: false, reason: `没有指纹（media-src/.stamps/${name}.json）` }
  }

  const digest = digestOf(inputs)
  if (digest !== stamp) {
    return { fresh: false, reason: '源或生成脚本变了，指纹不一致' }
  }

  /*
    产物指纹。只记输入的话，**手改 public/ 下的派生文件完全静默**——追加一个
    字节、换一张图，`--check` 依然全绿。根 CLAUDE.md 的「[机制] 不手改派生
    产物」这条红线，对素材产物原本没有机制。

    旧 stamp 没记过产物指纹（值为 null），此时跳过而不是判过期：否则升级这段
    代码本身会让全部四条流水线一起变红，而那不是"产物过期"。重跑一次生成就会
    补上。
  */
  const outputStamp = readOutputStamp(name)
  if (outputStamp !== null && digestOf(outputs) !== outputStamp) {
    return { fresh: false, reason: '产物被手改过（产物指纹与生成时不一致）' }
  }

  return { fresh: true, reason: '指纹一致' }
}
