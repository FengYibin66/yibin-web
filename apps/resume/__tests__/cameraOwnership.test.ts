import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 相机所有权门禁（ADR 20260903140617）。
 *
 * 「房间转场的相机动画由 DoorSection 统一编排，房间组件只提供目标 pose」
 * 这条约定被违反了四次。约定靠不住，所以换成机制。
 *
 * ## 白名单，而不是"全禁"
 *
 * 一次性把走廊导轨、出版物翻页、入口预览全迁到 CameraDirector 是个大改动，
 * 风险集中。所以这里用**白名单**：现存的写点逐一登记，任何**新增**的写点
 * 立刻红灯。白名单只能缩不能涨——`ALLOWED` 里每一项都写了为什么还在，
 * 删一项就是完成一次迁移。
 *
 * 这个形态是刻意选的。「跑必然失败的步骤只会训练人忽略红灯」（根 CLAUDE.md
 * 记着 lint 的教训），反过来说：一个从第一天起就是绿的门禁，才会在变红时
 * 被当真。
 */

const ROOT = join(import.meta.dirname, '..')

/** 写相机的形态。读（`camera.position.clone()`、传参给 lookAt 的对象）不算 */
const WRITE_PATTERNS: readonly RegExp[] = [
  /\bcamera\.position\.(set|copy|lerp|lerpVectors|add|addScaledVector|sub|setFromSpherical)\s*\(/,
  /\bcamera\.position\.[xyz]\s*(=|\+=|-=|\*=)[^=]/,
  /\bgsap\.(to|set|fromTo)\s*\(\s*camera\.position/,
  /\bcamera\.lookAt\s*\(/,
  /\bcamera\.rotation\.[xyz]\s*(=|\+=|-=)[^=]/,
  /\bcamera\.quaternion\.(set|copy|slerp|setFromEuler|multiply)\s*\(/,
  /\bcamera\.up\.set\s*\(/,
]

/**
 * 允许写相机的文件，以及为什么。
 *
 * 键是仓库内相对 `apps/resume/` 的路径。
 */
const ALLOWED: Readonly<Record<string, string>> = {
  /*
    注意 `CameraDirector` 本身**不在**这张表里，而这不是遗漏：它经
    `camera-controls` 的 `setLookAt` 写相机，从不碰 `camera.position`。
    所以直接写点的白名单里没有它，取而代之的不变量是下面那条——
    `camera-controls` 只能被它 import。

    （写这条门禁时我先放了个"CameraDirector 应该被扫到"的哨兵，跑出来是红的
    ——哨兵的前提本身错了。留下这段注释是因为下一个人很可能想加回那条断言。）
  */

  // ── 待迁移（每一项都是一次独立的迁移，删掉它就算完成）──
  'hooks/useCorridorCamera.ts':
    '走廊是导轨（x/y 固定、z 随滚动），与 orbit 模型不同。迁移要先给 ' +
    'CameraDirector 加一个 rail 模式，是独立一步',
  'components/lab/DoorSection.tsx':
    '门对齐 + 开门推进的编排。它是"原本正确的那一方"（约定就是它统一编排），' +
    '迁移它等于把编排整体搬进 CameraDirector，改动面大',
  'components/rooms/publications/usePublicationBrowseCamera.ts':
    'Publications 的卡片浏览。这个房间是移植时唯一被完整重做过的，自成一套',
  'components/rooms/publications/usePublicationCardMotion.ts':
    '同上：翻页时的相机跟随',
  'components/rooms/publications/publicationOpenPose.ts':
    '同上：打开单篇的位姿计算',
  'components/entry/EntryPreviewScene.tsx':
    '入口页的独立小场景，不在 Lab 的相机语境里（自己的 Canvas）',
  'lib/scene/ThreeScene.ts':
    'Classic 视图的独立场景，与 Lab 无关',
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'out' || name === '__tests__') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(name)) out.push(full)
  }
  return out
}

/**
 * 去掉注释与字符串字面量。
 *
 * 必须做：本文件与被测文件里的注释都会提到 `camera.position.set(...)`
 * 这种写法来解释为什么禁止它。规则约束的是**代码**，不是说明文字——
 * 这个坑之前已经踩过两次（Navbar 的颜色门禁、push-main 守卫的反引号）。
 */
export function stripCommentsAndStrings(source: string): string {
  let out = ''
  let i = 0
  const n = source.length
  while (i < n) {
    const two = source.slice(i, i + 2)
    if (two === '//') {
      while (i < n && source[i] !== '\n') i += 1
      continue
    }
    if (two === '/*') {
      i += 2
      while (i < n && source.slice(i, i + 2) !== '*/') i += 1
      i += 2
      continue
    }
    const ch = source[i]!
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      i += 1
      while (i < n) {
        if (source[i] === '\\') { i += 2; continue }
        if (source[i] === quote) { i += 1; break }
        i += 1
      }
      // 用空格占位，避免把两侧标识符粘在一起
      out += ' '
      continue
    }
    out += ch
    i += 1
  }
  return out
}

function scan(): Map<string, string[]> {
  const found = new Map<string, string[]>()
  for (const dir of ['components', 'lib', 'hooks', 'context', 'app']) {
    let files: string[]
    try {
      files = walk(join(ROOT, dir))
    } catch {
      continue
    }
    for (const file of files) {
      const code = stripCommentsAndStrings(readFileSync(file, 'utf8'))
      const hits: string[] = []
      for (const [lineNo, line] of code.split('\n').entries()) {
        for (const pattern of WRITE_PATTERNS) {
          if (pattern.test(line)) {
            hits.push(`${lineNo + 1}: ${line.trim().slice(0, 80)}`)
            break
          }
        }
      }
      if (hits.length > 0) found.set(relative(ROOT, file), hits)
    }
  }
  return found
}

describe('stripCommentsAndStrings', () => {
  it('去掉行注释', () => {
    expect(stripCommentsAndStrings('const a = 1 // camera.lookAt(x)')).not.toContain('lookAt')
  })

  it('去掉块注释（跨行）', () => {
    const src = 'a\n/*\n gsap.to(camera.position, {})\n*/\nb'
    expect(stripCommentsAndStrings(src)).not.toContain('gsap')
  })

  it('去掉字符串字面量与模板串', () => {
    expect(stripCommentsAndStrings('const s = "camera.lookAt("')).not.toContain('lookAt')
    expect(stripCommentsAndStrings('const s = `camera.position.set(`')).not.toContain('position')
  })

  it('保留代码', () => {
    const out = stripCommentsAndStrings('camera.lookAt(target) // 说明')
    expect(out).toContain('camera.lookAt(target)')
  })

  it('转义引号不会提前结束字符串', () => {
    const out = stripCommentsAndStrings(`const s = 'a\\'b' ; camera.lookAt(t)`)
    expect(out).toContain('camera.lookAt(t)')
  })
})

describe('相机所有权', () => {
  const found = scan()

  it('没有白名单之外的文件写相机', () => {
    const offenders = [...found.keys()].filter(f => !(f in ALLOWED))
    expect(
      offenders,
      `这些文件写了相机但不在白名单里。相机只能由 CameraDirector 写` +
      `（ADR 20260903140617）——房间组件只声明目标 pose，交给 ` +
      `cameraDirector.enterRoom / frameObject。\n` +
      offenders.map(f => `\n  ${f}\n    ${found.get(f)!.join('\n    ')}`).join(''),
    ).toEqual([])
  })

  it('白名单里没有已经不写相机的僵尸条目 —— 白名单只能缩', () => {
    const stale = Object.keys(ALLOWED).filter(f => !found.has(f))
    expect(
      stale,
      `这些条目已经不写相机了，从 ALLOWED 里删掉（迁移完成的标记就是删这一行）`,
    ).toEqual([])
  })

  it('白名单每一项都写了理由', () => {
    for (const [file, reason] of Object.entries(ALLOWED)) {
      expect(reason.length, file).toBeGreaterThan(10)
    }
  })

  it('camera-controls 只能被 CameraDirector import —— 这才是 orbit 路径的所有权不变量', () => {
    const importers: string[] = []
    for (const dir of ['components', 'lib', 'hooks', 'context', 'app']) {
      let files: string[]
      try { files = walk(join(ROOT, dir)) } catch { continue }
      for (const file of files) {
        const code = readFileSync(file, 'utf8')
        if (/from\s+['"]camera-controls['"]/.test(code)) importers.push(relative(ROOT, file))
      }
    }
    expect(importers).toEqual(['lib/lab/app/camera/CameraDirector.ts'])
  })

  it('扫描逻辑能抓到各种写法（自检）', () => {
    const samples = [
      'camera.position.set(1,2,3)',
      'camera.position.copy(v)',
      'camera.position.x = 5',
      'camera.position.z += delta',
      'gsap.to(camera.position, { x: 3 })',
      'camera.lookAt(0, 0, 0)',
      'camera.rotation.y = 1',
      'camera.quaternion.slerp(q, 0.1)',
      'camera.up.set(0, 1, 0)',
    ]
    for (const sample of samples) {
      expect(
        WRITE_PATTERNS.some(p => p.test(sample)),
        `没抓到：${sample}`,
      ).toBe(true)
    }
  })

  it('扫描逻辑不误伤读操作（自检）', () => {
    const reads = [
      'const p = camera.position.clone()',
      'camera.getWorldPosition(vec)',
      'const d = camera.position.distanceTo(target)',
      'if (camera.position.z > 10) {}',
      'mesh.lookAt(camera.position)',
      'obj.position.set(1, 2, 3)',
      'const y = camera.position.y',
    ]
    for (const sample of reads) {
      expect(
        WRITE_PATTERNS.some(p => p.test(sample)),
        `误伤了读操作：${sample}`,
      ).toBe(false)
    }
  })
})
