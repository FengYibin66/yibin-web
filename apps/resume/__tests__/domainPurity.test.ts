import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

import { importSpecifiers, importsModule, walkSources } from './helpers/sourceScan'

/**
 * `lib/lab/domain` 的依赖方向门禁（ADR 20260903211338）。
 *
 * ## 这条规则从哪来
 *
 * 根 CLAUDE.md 的「分层」以 `auto-wechat/backend` 为先例：`domain`（业务核心）/
 * `application`（用例编排）/ `infrastructure`（外部依赖实现）/ `interface`（传输层），
 * **依赖方向单向朝内**。`apps/resume/AGENTS.md` 也声称「domain 不感知 React /
 * three / DOM」。
 *
 * 而实际上它感知了：`domain/rooms/types.ts` 为一个 `view` 字段
 * `import type { ComponentType } from 'react'`，五个房间定义各自
 * `import('@/components/rooms/...')`——**domain 指向 interface 层**，正好反着。
 *
 * 这不是"风格问题"。房间定义一旦引用组件，domain 的测试就要拖起整个 React 与
 * R3F 的依赖树（jsdom、WebGL 替身、纹理 mock），而 domain 的价值恰恰是"纯逻辑，
 * 拿来就能测"。`view` 已搬到 `components/rooms/registry.ts`。
 *
 * ## 为什么用 AST 而不是 grep
 *
 * 与三条源码门禁同一个理由（ADR 20260903211320）：`import` 出现在注释或字符串里
 * 是常态（这个文件自己就在注释里写 `import type { ComponentType } from 'react'`），
 * 而 grep 分不清。`importsModule` 只看 AST 上真正的 import 声明。
 */

const ROOT = join(import.meta.dirname, '..')
const DOMAIN = join(ROOT, 'lib/lab/domain')

/**
 * domain 不许 import 的东西。
 *
 * `xstate` **不在**这张表里：状态图是纯逻辑（一台状态机就是一组转移规则），
 * 它不碰 DOM 也不碰渲染，放在 domain 是对的。ADR 20260903140616 的判断是
 * 「失败边与超时应当是状态图的一等公民」，那属于业务核心。
 */
const FORBIDDEN = [
  { module: 'react', why: 'domain 不该知道渲染框架的存在' },
  { module: 'react-dom', why: '同上' },
  { module: 'three', why: '3D 是渲染细节；domain 用纯数组/数字表达坐标' },
  { module: '@react-three/fiber', why: '同上' },
  { module: '@react-three/drei', why: '同上' },
  { module: 'gsap', why: '补间是编排层的事（lib/lab/app）' },
  { module: 'howler', why: '音频实现属于 app/infra' },
  { module: 'camera-controls', why: '只有 CameraDirector 能碰它' },
]

/** 也不许指向这些目录（那是 interface / app 层） */
const FORBIDDEN_PREFIXES = ['@/components/', '@/hooks/', '@/context/', '@/app/']

const files = walkSources(DOMAIN)

describe('domain 层的依赖方向', () => {
  it('domain 里有文件可扫 —— 路径写错会让门禁静默变成空扫描', () => {
    expect(files.length, 'lib/lab/domain 下一个源文件都没扫到').toBeGreaterThan(10)
  })

  it.each(FORBIDDEN.map(f => [f.module, f.why] as const))(
    'domain 不 import %s',
    (module, why) => {
      const offenders: string[] = []
      for (const file of files) {
        const rel = relative(ROOT, file)
        if (importsModule(readFileSync(file, 'utf8'), module, rel)) {
          offenders.push(rel)
        }
      }
      expect(offenders, `${module}：${why}\n` + offenders.join('\n')).toEqual([])
    },
  )

  it('domain 不指向 components / hooks / context / app', () => {
    /*
      这一条查的是**方向**：domain 可以被上面几层引用，反过来不行。
      `view` 字段就是这么违反的——五个房间定义各自动态
      `import('@/components/rooms/...')`。
    */
    const offenders: string[] = []
    for (const file of files) {
      const rel = relative(ROOT, file)
      const source = readFileSync(file, 'utf8')
      for (const prefix of FORBIDDEN_PREFIXES) {
        // `importsModule` 要精确模块名，这里要匹配前缀，所以按 AST 取全部 import
        for (const spec of importSpecifiers(source, rel)) {
          if (spec.startsWith(prefix)) offenders.push(`${rel} → ${spec}`)
        }
      }
    }
    expect(
      [...new Set(offenders)],
      'domain 指向了外层。房间"是什么"留在 domain，"长什么样"归 components：\n'
      + [...new Set(offenders)].join('\n'),
    ).toEqual([])
  })

  it('允许 import 的：domain 内部、lib 里的纯模块、类型', () => {
    // 反向确认门禁没把合法依赖也拦掉（否则它会逼人把纯逻辑搬出 domain）
    const sample = join(DOMAIN, 'rooms/about.ts')
    const specs = importSpecifiers(readFileSync(sample, 'utf8'), 'about.ts')
    expect(specs.length, 'about.ts 一个 import 都没有？门禁可能在空跑').toBeGreaterThan(0)
    for (const spec of specs) {
      expect(spec.startsWith('@/components/')).toBe(false)
    }
  })
})
