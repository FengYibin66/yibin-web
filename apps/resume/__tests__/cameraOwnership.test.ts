import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import { cameraWrites, importsModule, scanTree, walkSources } from './helpers/sourceScan'

/**
 * 相机所有权门禁（ADR 20260903140617，形态由 20260903211320 修订）。
 *
 * 「房间转场的相机动画由 DoorSection 统一编排，房间组件只提供目标 pose」
 * 这条约定被违反了四次。约定靠不住，所以换成机制。
 *
 * ## 两处与第一版的不同，各自都是被变异测试逼出来的
 *
 * **1. 扫描器从正则换成 TS AST。** 正则版对 20 个绕过形态活了 10 个：
 * `camera.rotation.set(`、`position.setZ(`、`rotateX(`、`applyMatrix4(`、
 * `gsap.to(camera.rotation`、别名 `const cam = camera` 全都不认；而
 * `camera.rotation.set` 正是 `DoorSection.tsx` 眼下在用、白名单注释里也登记过
 * 的写法——门禁连自己登记过的形态都抓不到。手写的字符串剥离器还会被一个
 * JSX 撇号或一条含 `//` 的 URL 骗到，吞掉同文件后面所有代码。
 * 换 AST 之后这些按构造消失，理由与边界见 `helpers/sourceScan.ts`。
 *
 * **2. 白名单从文件级换成写点计数棘轮。** 文件级白名单的漏洞很直接：已经在
 * 名单里的文件，再加 20 个写点也是绿的。`DoorSection` 当时已有 8 个写点。
 * 现在每个文件登记**期望写点数**，多一个就红。
 *
 * ## 为什么是白名单/棘轮，不是"全禁"
 *
 * 一次性把走廊导轨、出版物翻页、入口预览全迁到 CameraDirector 是个大改动，
 * 风险集中。棘轮允许分次迁移，且每次迁移的完成标记就是把数字改小或删掉一行。
 * 「跑必然失败的步骤只会训练人忽略红灯」（根 CLAUDE.md 记着 lint 的教训），
 * 反过来说：一个从第一天起就是绿的门禁，才会在变红时被当真。
 */

const ROOT = join(import.meta.dirname, '..')
const SCAN_DIRS = ['components', 'lib', 'hooks', 'context', 'app'] as const

/**
 * 允许写相机的文件、**期望的写点数**、以及为什么。
 *
 * 键是相对 `apps/resume/` 的路径。数字是当前实测值——它只能变小。
 * 要加写点，先说明为什么这个文件应该比现在写得更多；通常正确答案是把它迁进
 * `CameraDirector`，而不是把数字改大。
 */
const ALLOWED: Readonly<Record<string, { count: number, reason: string }>> = {
  'lib/lab/app/camera/CameraDirector.ts': {
    count: 2,
    reason:
      '它就是所有者。两处是 `applyLean` 的 `camera.rotateX/rotateZ`——探身是叠加在 ' +
      'controls 结果之上的相对旋转，camera-controls 没有对应概念，只能直接写。' +
      '（第一版门禁的注释断言"CameraDirector 从不碰 camera，只经 setLookAt"，' +
      '换成 AST 扫描后发现这句是错的：那两行一直在。文档说谎比没有文档更糟，' +
      '所以现在如实登记。）',
  },

  // ── 待迁移。每一项都是一次独立的迁移，把数字改小或删掉整行就是完成标记 ──
  'hooks/useCorridorCamera.ts': {
    count: 4,
    reason:
      '走廊是导轨（x/y 固定、z 随滚动），与 orbit 模型不同。迁移要先给 ' +
      'CameraDirector 加一个 rail 模式，是独立一步。ADR 20260903211244 决定' +
      '**不迁**：走廊传送改为写这条导轨的目标 z，导演在走廊里根本不参与',
  },
  'components/lab/DoorSection.tsx': {
    count: 10,
    reason:
      '门对齐 + 开门推进的编排。它是"原本正确的那一方"（约定就是它统一编排）。' +
      '与导演的同帧双写已经解决，但**不是靠把飞行迁进导演**：改成了让房间等到 ' +
      '`phase === \'entered\'` 才 `claim()`，于是两个写者前后相继而不是同时。' +
      '「同时」这件事本身由 `CameraRig` 的开发态断言守着（持有期间相机被别人写过' +
      '就抛）——那比静态扫描强，因为写点棘轮看不出"在错误的时刻写"。' +
      '真要迁的话是把整套编排搬进导演，改动面大且收益只是少一条白名单',
  },
  'components/rooms/publications/usePublicationBrowseCamera.ts': {
    count: 2,
    reason:
      'Publications 的卡片浏览。这个房间是移植时唯一被完整重做过的，自成一套。' +
      'ADR 20260903211244 决定**保留**它自有的 gsap 相机，但要求它先 ' +
      '`director.release()` 再写——所有权在这里是"显式让位"而非"统一持有"',
  },
  'components/rooms/publications/usePublicationCardMotion.ts': {
    count: 4,
    reason: '同上：翻页时的相机跟随',
  },
  'components/rooms/publications/publicationOpenPose.ts': {
    count: 4,
    reason: '同上：打开单篇的位姿计算与还原',
  },
  'components/entry/EntryPreviewScene.tsx': {
    count: 4,
    reason: '入口页的独立小场景，不在 Lab 的相机语境里（自己的 Canvas）',
  },
  'lib/scene/ThreeScene.ts': {
    count: 4,
    reason: 'Classic 视图的独立场景，与 Lab 无关',
  },
}

const found = scanTree(ROOT, SCAN_DIRS, cameraWrites)

function describeHits(file: string): string {
  return (found.get(file) ?? []).map(h => `${h.line}: ${h.text}`).join('\n      ')
}

describe('相机所有权', () => {
  it('没有白名单之外的文件写相机', () => {
    const offenders = [...found.keys()].filter(f => !(f in ALLOWED)).sort()
    expect(
      offenders,
      '这些文件写了相机但不在白名单里。相机只能由 CameraDirector 写' +
      '（ADR 20260903140617）——房间组件只声明目标 pose，交给 ' +
      '`cameraDirector.claim(root, pose, freedom)`。\n' +
      offenders.map(f => `\n  ${f}\n      ${describeHits(f)}`).join(''),
    ).toEqual([])
  })

  it('没有文件写得比登记的更多 —— 棘轮只能往下', () => {
    const grown: string[] = []
    for (const [file, { count }] of Object.entries(ALLOWED)) {
      const actual = found.get(file)?.length ?? 0
      if (actual > count) {
        grown.push(
          `${file}：登记 ${count} 个写点，实际 ${actual} 个\n      ${describeHits(file)}`,
        )
      }
    }
    expect(
      grown,
      '这些文件新增了相机写点。正确做法通常是把它迁进 CameraDirector，' +
      '而不是把 ALLOWED 里的数字改大：\n' + grown.join('\n\n'),
    ).toEqual([])
  })

  it('登记数与实测一致 —— 写点变少了就把数字改小（否则棘轮会松掉）', () => {
    const stale: string[] = []
    for (const [file, { count }] of Object.entries(ALLOWED)) {
      const actual = found.get(file)?.length ?? 0
      if (actual < count) stale.push(`${file}：登记 ${count}，实际 ${actual}`)
    }
    expect(
      stale,
      '这些文件的写点比登记的少——迁移已经发生了一部分。把 ALLOWED 里的数字' +
      '改成实际值（改成 0 就直接删掉整行），否则棘轮留着一截空档，' +
      '下一个人可以在不触发红灯的情况下加回写点：\n' + stale.join('\n'),
    ).toEqual([])
  })

  it('白名单里没有已经不写相机的僵尸条目', () => {
    const zombies = Object.keys(ALLOWED).filter(f => !found.has(f))
    expect(
      zombies,
      '这些条目已经不写相机了，从 ALLOWED 里删掉（迁移完成的标记就是删这一行）',
    ).toEqual([])
  })

  it('白名单每一项都写了理由', () => {
    for (const [file, { reason }] of Object.entries(ALLOWED)) {
      expect(reason.length, file).toBeGreaterThan(10)
    }
  })

  it('camera-controls 只能被 CameraDirector import —— orbit 路径的所有权不变量', () => {
    const importers: string[] = []
    for (const dir of SCAN_DIRS) {
      for (const file of walkSources(join(ROOT, dir))) {
        if (importsModule(readFileSync(file, 'utf8'), 'camera-controls', file)) {
          importers.push(relative(ROOT, file))
        }
      }
    }
    expect(importers).toEqual(['lib/lab/app/camera/CameraDirector.ts'])
  })
})

describe('门禁自身没有退化', () => {
  /*
    这两条防的是「有人为了让红灯变绿，把扫描器改弱」——那比留着违例更糟，
    因为之后所有人都会以为门禁在守着。扫描器本身的双向锁定在
    `sourceScan.test.ts`（70 个用例）。
  */
  it('扫描器仍能抓到正则版漏掉的写法', () => {
    const probes = [
      'camera.rotation.set(0, 1, 0)',
      'camera.position.setZ(5)',
      'camera.rotateX(0.1)',
      'gsap.to(camera.rotation, { y: 1 })',
      'const cam = camera\ncam.position.set(1, 2, 3)',
      'camera.position.applyMatrix4(m)',
    ]
    for (const probe of probes) {
      expect(cameraWrites(probe, 'probe.ts'), probe).not.toEqual([])
    }
  })

  it('扫描确实覆盖到了文件 —— 目录名写错会让门禁静默变成空扫描', () => {
    // 8 个白名单文件都必须在扫描结果里；一个都扫不到说明路径或遍历坏了
    expect(found.size).toBeGreaterThanOrEqual(Object.keys(ALLOWED).length)
  })
})
