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

/** 写下指纹。生成流程的最后一步 */
export function writeStamp(name, digest) {
  mkdirSync(STAMP_DIR, { recursive: true })
  writeFileSync(
    stampPath(name),
    `${JSON.stringify({ digest, note: '内容指纹，见 scripts/media/freshness.mjs' }, null, 2)}\n`,
  )
}

/** 读回指纹。没有 stamp 时返回 null（视为过期） */
export function readStamp(name) {
  const path = stampPath(name)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')).digest ?? null
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
  return digest === stamp
    ? { fresh: true, reason: '指纹一致' }
    : { fresh: false, reason: '源或生成脚本变了，指纹不一致' }
}
