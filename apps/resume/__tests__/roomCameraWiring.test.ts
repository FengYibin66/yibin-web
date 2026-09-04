import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import ts from 'typescript'

import { walkSources } from './helpers/sourceScan'
import { ROOMS } from '@/lib/lab/domain/rooms'

/**
 * 门禁：声明了 `entryPose` 的房间，必须有组件消费它。
 *
 * ## 抓到过什么
 *
 * About / Contact 的 `entryPose` 在 `lib/lab/domain/rooms/` 里声明了很久，ADR
 * 20260903140615 还写着「A1/A3 由 entryPose 修复」——而运行时只有 Projects 调了
 * `useRoomCamera`。于是 About 的相机停在门口 25 单位外，天空平面的边缘直接露出
 * （那个"蓝框"），Contact 的一组数值从未被应用、也从未被验证（接上时发现相机站在
 * 走廊墙里）。2026-09-04 实机验收时两条一起炸。
 *
 * 这与 `machineEventWiring.test.ts` 是同一类问题：**声明了 ≠ 接上了**。声明的
 * 数据有类型检查、有单测，看起来"已完成"，而唯一能感知到它没接上的是用户。
 *
 * ## 豁免要写理由
 *
 * 不是每间房都该走 `useRoomCamera`。豁免表里每一条都要有能被反驳的理由，
 * 空字符串不算。
 */

/** 刻意不用 `useRoomCamera` 的房间 */
const EXEMPT: Readonly<Partial<Record<keyof typeof ROOMS, string>>> = {
  publications:
    'ADR 20260903211244 决定保留它自有的 gsap 相机（卡片浏览 / 打开单篇），' +
    '所有权形态是显式 `release()` 而非 `claim()`；见 usePublicationBrowseCamera.ts',
  gallery:
    '不是 R3F 房间：门对齐后 `router.push(\'/gallery\')` 跳独立路由，没有房间根可锚定',
}

/** `useRoomCamera('<roomId>', …)` 的第一个字面量参数 */
function roomCameraCalls(source: string, fileName: string): string[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const out: string[] = []
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'useRoomCamera' &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      out.push(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

function consumedRoomIds(): Set<string> {
  const found = new Set<string>()
  for (const file of walkSources(join(process.cwd(), 'components'))) {
    for (const id of roomCameraCalls(readFileSync(file, 'utf8'), file)) found.add(id)
  }
  return found
}

describe('每个声明了 entryPose 的房间都有相机消费方', () => {
  const declared = Object.keys(ROOMS) as Array<keyof typeof ROOMS>

  it('前置：注册表里确实有房间', () => {
    expect(declared.length).toBeGreaterThanOrEqual(4)
  })

  it('没有"声明了 entryPose 却无人消费"的房间', () => {
    const consumed = consumedRoomIds()
    const orphans = declared.filter(id => !(id in EXEMPT) && !consumed.has(id))
    expect(
      orphans,
      `这些房间的 entryPose 是死声明，相机会停在门口：${orphans.join(', ')}`,
    ).toEqual([])
  })

  it('豁免的房间确实没在用 useRoomCamera —— 否则豁免理由就是过期的', () => {
    const consumed = consumedRoomIds()
    const stale = (Object.keys(EXEMPT) as Array<keyof typeof ROOMS>).filter(id => consumed.has(id))
    expect(stale, '这些房间已经接了 useRoomCamera，把它们从 EXEMPT 里删掉').toEqual([])
  })

  it('每条豁免都有理由', () => {
    for (const [id, reason] of Object.entries(EXEMPT)) {
      expect(reason.length, id).toBeGreaterThan(20)
    }
  })

  it('扫描器能认出调用 —— 变异测试', () => {
    expect(roomCameraCalls("useRoomCamera('about', ref, opts)", 'm.tsx')).toEqual(['about'])
    // 注释里的不算
    expect(roomCameraCalls("// useRoomCamera('about', ref, opts)", 'm.tsx')).toEqual([])
    // 非字面量看不见 —— 这是已知边界，出现了要在这里加断言而不是放宽
    expect(roomCameraCalls('useRoomCamera(roomId, ref, opts)', 'm.tsx')).toEqual([])
  })
})
