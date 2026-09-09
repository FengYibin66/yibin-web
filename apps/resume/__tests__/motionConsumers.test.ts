import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

import { importsModule, walkSources } from './helpers/sourceScan'

/**
 * 「持续动画必须读动效开关」门禁（ADR 20260908172231）。
 *
 * ## 守什么
 *
 * Lab 是全站动效最密的地方，而它在 2026-09-08 之前**完全不响应
 * `prefers-reduced-motion`** —— 全仓 5 处命中全在 Classic 与加载指示器。对前庭
 * 功能敏感的访客，这一页是"进去就晃"。
 *
 * 判据取「`useFrame` + 读时钟」：**由时间驱动**的动画就是自发运动，必须能被
 * 关掉。由用户动作驱动的（相机距离触发的侧身、hover 上色、点击反馈）不在此列
 * —— 关掉它们等于把交互也关掉。
 *
 * ## 为什么用棘轮而不是全禁
 *
 * 走廊层（`components/lab/`）已经全部接上，所以那一组是**零例外**。
 * 房间层（`components/rooms/`）还有一批没接（云、桶、纸、灯的呼吸…），
 * 那是后续几期的事。把它们**逐个列出来**而不是整个目录豁免：
 *
 * - 新增一个不读开关的房间动画 → 门禁红（因为它不在清单里）
 * - 接好一个就要把它从清单里删掉 → 清单只能变短
 *
 * 文件级"整目录豁免"的漏洞正是相机写点棘轮当年吃过的教训：已在名单里的文件
 * 再加 20 个写点也是绿的。
 */

const ROOT = join(__dirname, '..')

/**
 * 读到动效开关的两种合规写法。
 *
 * 推荐 `useMotionScale`（唯一入口，见该文件的说明）；直接订阅 store 也算，
 * 因为 hook 本身就是它的薄封装，硬禁只会让人绕。
 */
const MOTION_MODULES = ['@/hooks/useMotionScale', '@/lib/lab/app/stores/corridorStore'] as const

/**
 * 房间层尚未接入动效开关的文件。
 *
 * **已清空**（2026-09-08）：九个房间层的时间驱动动画全部接完 —— 云、桶、纸、
 * 海浪、船、机柜 LED、纸材质 shader、论文卡的风摆。
 *
 * 这张表**只能减，不能增**：新增的动画一开始就该读开关。留着空表而不是删掉
 * 整条断言，是因为它现在守的是「不许回退」——同 `labContrast.test.ts` 的
 * `KNOWN_LOW_CONTRAST` 刻意留空。
 */
const ROOM_LEVEL_PENDING: readonly string[] = []

/** 由时间驱动（= 自发运动）的文件 */
/**
 * 判据：`useFrame` 且（读时钟 **或** 用回调的第二个形参 delta）。
 * 第一版只认时钟：`useFrame((_, delta) => …)` 用 dt 推进相位的自发运动（狗）看不见，
 * 门禁没红只是因为作者恰好读了开关——判据要覆盖实际写法，不是覆盖当时恰好存在的写法。
 */
export function isTimeDriven(source: string): boolean {
  const usesFrame = source.includes('useFrame')
  const readsClock = source.includes('clock.elapsedTime') || source.includes('clock.getElapsedTime')
  const usesDelta = /useFrame\(\s*\(\s*[\w$_]*\s*,\s*[\w$_]+\s*\)\s*=>/.test(source)
  return usesFrame && (readsClock || usesDelta)
}

/**
 * 用 delta 做**阻尼平滑**（相机 / 停靠 / hover 显形 / 轮播滚动向用户设定的目标逼近）的文件：
 * 它们随时间变，但不是自发运动——目标由用户动作决定，停手就停。判据放宽到 delta 后会把它们
 * 一并抓进来，所以显式豁免；每一项必须**不读时钟**（读了就是真运动，不该在这里）。
 * 这份名单只能变短。
 */
const USER_DRIVEN_SMOOTHING: readonly string[] = [
  'components/lab/CameraRig.tsx',
  'components/lab/CorridorDecorations.tsx',
  'components/rooms/projects/ProjectMonitor.tsx',
  'components/rooms/publications/usePublicationCarousel.ts',
]

function timeDrivenFiles(dir: string): string[] {
  const out: string[] = []
  for (const file of walkSources(join(ROOT, dir))) {
    const rel = relative(ROOT, file)
    if (USER_DRIVEN_SMOOTHING.includes(rel)) continue
    if (isTimeDriven(readFileSync(file, 'utf8'))) out.push(rel)
  }
  return out.sort()
}

function guarded(file: string): boolean {
  const source = readFileSync(join(ROOT, file), 'utf8')
  return MOTION_MODULES.some(mod => importsModule(source, mod, file))
}

describe('持续动画必须读动效开关', () => {
  it('走廊层零例外：每个时间驱动的组件都读 motionScale', () => {
    const unguarded = timeDrivenFiles('components/lab').filter(file => !guarded(file))
    expect(
      unguarded,
      '这些走廊组件由时间驱动却读不到动效开关，`prefers-reduced-motion` 对它们无效。\n' +
        "修法：`const motion = useMotionScale()`（'@/hooks/useMotionScale'），" +
        '把幅度乘上去；乘不掉的（呼吸的灯、shader 的 uTime、按时间推进的漂移）' +
        '用分支冻结在一个好看的值上，不要归零 —— 亮度为 0 的灯看起来是坏的。\n' +
        `未接开关：\n  ${unguarded.join('\n  ')}`,
    ).toEqual([])
  })

  it('走廊层确实有时间驱动的组件（门禁不能因为判据失效而空跑）', () => {
    /*
      若判据（`useFrame` + 读时钟）因为某次重构不再匹配任何文件，上面那条会
      "全绿"——而那是最坏的情况：门禁在，但什么都没检查。
    */
    expect(timeDrivenFiles('components/lab').length).toBeGreaterThanOrEqual(3)
  })

  it('房间层的未接清单与实际一致（只能变短）', () => {
    const unguarded = timeDrivenFiles('components/rooms').filter(file => !guarded(file))
    expect(
      unguarded,
      '房间层未接动效开关的文件与清单不一致。\n' +
        '· 多出来的：新增的房间动画请一开始就读 motionScale，不要往清单里加。\n' +
        '· 少了的：接好一个就把它从 ROOM_LEVEL_PENDING 里删掉（清单只能变短）。',
    ).toEqual([...ROOM_LEVEL_PENDING].sort())
  })

  it('房间层确实有时间驱动的组件（同上，防判据失效后空跑）', () => {
    expect(timeDrivenFiles('components/rooms').length).toBeGreaterThanOrEqual(9)
  })

  it('清单里的每个文件都真实存在（防僵尸豁免）', () => {
    for (const file of ROOM_LEVEL_PENDING) {
      expect(() => readFileSync(join(ROOT, file), 'utf8'), `${file} 不存在`).not.toThrow()
    }
  })
})

describe('判据自测：时间驱动的两种写法都认', () => {
  it('读时钟', () => {
    expect(isTimeDriven("useFrame(state => { mesh.rotation.y = state.clock.elapsedTime })")).toBe(true)
  })
  it('用 delta 推进', () => {
    expect(isTimeDriven("useFrame((_, delta) => { phase.current += delta })")).toBe(true)
    expect(isTimeDriven("useFrame((state, dt) => { t += dt })")).toBe(true)
  })
  it('只读一次状态、不随时间变的 useFrame 不算', () => {
    expect(isTimeDriven("useFrame(() => { mesh.visible = camera.position.z < 10 })")).toBe(false)
    expect(isTimeDriven("useFrame(state => { syncListener(state.camera) })")).toBe(false)
  })
  it('没有 useFrame 就不算，哪怕有 delta 字样', () => {
    expect(isTimeDriven("const delta = 1; setInterval(() => {}, delta)")).toBe(false)
  })
})

describe('阻尼平滑的豁免名单', () => {
  it('每一项都存在，用 delta，且不读时钟（读了就是真运动，不该被豁免）', () => {
    for (const rel of USER_DRIVEN_SMOOTHING) {
      const source = readFileSync(join(ROOT, rel), 'utf8')
      expect(source.includes('useFrame'), rel).toBe(true)
      expect(source.includes('clock.elapsedTime') || source.includes('clock.getElapsedTime'), `${rel} 读了时钟`).toBe(false)
    }
  })
})
