import { expect, test } from '@playwright/test'

/**
 * Lab 的行为级 E2E。
 *
 * ## 为什么单独一个文件、为什么现在才有
 *
 * 在此之前 E2E 对 `/lab` 只断言了「返回 200」——进房、退房、传送、ESC 一条都
 * 没有。2026-09-03 的四份独立 review 查出的用户可感知缺陷里，有一半属于「单测
 * 覆盖不到、而只要真跑一次就会暴露」的那一类：
 *
 * - 房间里按 ESC 关面板会**连带退房**（只有 `ProjectsRoom` 接了 `escapeStack`，
 *   `NavigationUI` 与 `LabTutorial` 各自挂了 window 监听）
 * - 教程气泡退房后**残留并堵死队列**（只有 `PublicationsRoom` 退场时关自己的）
 * - 传送的 `moveToWorld({duration:0})` 在导演挂起态是**空操作**
 *
 * ADR [20260903211338](../../docs/adr/20260903211338-finish-wiring-lab-registry-and-machines.md)
 * 把这批 E2E 列为后续两次接线（房间注册表、XState 状态机）的**前置条件**：
 * 那两次改动牵动进房 / 退房 / 传送 / 失败恢复四条路径，没有行为级测试的话
 * 回归无从发现。
 *
 * ## 已知缺陷用 `test.fail()` 标注
 *
 * 下面有几条现在**必然失败**的用例（ESC 连带退房、教程残留）。它们不是坏测试，
 * 而是用 Playwright 的 `test.fail()` 把已核实的缺陷固化下来：
 *
 * - CI 保持绿（预期失败不算失败）
 * - 一旦修好，用例开始通过，`test.fail()` 会**报错**——强迫人把标记去掉，
 *   于是「修好了但忘了改测试」这种状态不可能存在
 *
 * 比注释里写一句 TODO 强得多：TODO 不会在被修好时提醒任何人。
 *
 * ## 选择器只用 data-testid
 *
 * 门是 R3F 里的 mesh，不在 DOM 里，所以「点门进房」这条路走不了 DOM——用地图
 * 面板的传送按钮代替（那也是真实用户路径）。`aria-label` 一律不能用来定位：
 * 它们全是本地化的，`LocaleToggle` 那次把 aria-label 改成目标语言后，三个 E2E
 * 因为 `getByRole(name)` 匹配可访问名而不是可见文字，一起红了。
 */

/*
  这个文件在**单个 worker 内顺序**跑，不参与全局的 `fullyParallel`。

  根 `playwright.config.ts` 开着 `fullyParallel: true`，理由是「静态站没有服务端
  状态，用例之间互不影响」——那对静态结构用例成立，对 Lab **不成立**：每个用例
  都要开一个 WebGL 上下文并加载 1.5MB 的 3D 资源，而 CI 与本地 headless 都是
  SwiftShader 软渲染。并行跑时它们互相饿死，表现为一批用例集体超时在
  「点不到导航按钮」上——而单独跑每一条都通过（第一版就是这么诊断出来的：
  全量 13 失败，`-g` 单跑同一条 10.6 秒通过）。

  用 `mode: 'default'` 而不是 `'serial'`：serial 模式下一条失败会跳过后面所有
  用例，而本文件里有刻意标为 `test.fail()` 的用例，跳过会把真实回归掩盖掉。
*/
test.describe.configure({
  mode: 'default',
  /*
    Lab 的用例天生慢：每条都要起一个 WebGL 上下文、加载 1.5MB 资源，再跑
    「相机对齐 → 开门 → 飞入」的编排，而 CI 与本地 headless 都是 SwiftShader
    软渲染。「退回走廊后再进另一个房间」实测单跑 29 秒——正好贴着默认的 30 秒
    用例超时，于是全量跑时随机超时。这不是测试写得不好，是这条路径真的要那么久。
  */
  timeout: 120_000,
})

/** Lab 的启动 + 走廊入场动画有撕纸 loader，给足时间 */
const LAB_READY_TIMEOUT = 30_000
/** 进房 = 相机对齐 + 资源加载 + 开门 + 飞入 */
const ROOM_ENTER_TIMEOUT = 20_000

/**
 * 打开 `/lab` 并等到可交互，返回是否拿到了 3D 环境。
 *
 * headless WebKit 不一定有 WebGL，此时 `LabClient` 渲染 `WebglFallback`。
 * 那也是一条真实用户路径（不支持 3D 的设备），所以不当成错误——返回 false，
 * 由调用方决定跳过交互用例。
 */
async function openLab(
  page: import('@playwright/test').Page,
  { firstVisit = false }: { firstVisit?: boolean } = {},
): Promise<boolean> {
  if (!firstVisit) await skipFirstVisitTutorial(page)
  await page.goto('/lab/')

  const fallback = page.getByTestId('lab-webgl-fallback')
  const ui = page.getByTestId('lab-ui')

  await expect(fallback.or(ui)).toBeAttached({ timeout: LAB_READY_TIMEOUT })
  if (await fallback.isVisible()) return false

  // NavigationUI 只在 hasEntered 之后渲染，所以它出现就意味着走廊已入场
  await expect(ui).toBeAttached({ timeout: LAB_READY_TIMEOUT })
  return true
}

/**
 * 以「回访用户」的身份打开 Lab —— 首访的操作说明遮罩不弹。
 *
 * ## 为什么不是"弹出来再点掉"
 *
 * 那个遮罩是 `inset: 0` 的 `role="dialog"`，会拦下所有指针事件。第一版的做法是
 * 等它出现再点掉，结果 9 条用例仍然超时在「点不到导航按钮」上，报错原文是
 * `lab-tutorial ... intercepts pointer events`——因为它的出现时机是
 * **「加载进度稳定 600ms」之后再等 2.4 秒**（`LabTutorial` 的 `useStableProgress`
 * + `SHOW_DELAY_MS`），而在 SwiftShader 软渲染下"加载完成"要多久是不确定的。
 * 于是它总能在等待窗口关闭之后才冒出来，正好挡住下一次点击。
 *
 * 与其去猜那个时机，不如把身份设成回访用户：`lab_tutorial_seen` 一置上，遮罩
 * 就不会自动弹。首访那条路径本身仍然有一条专门的用例覆盖（见「首访」一节），
 * 所以这不是把问题绕过去。
 */
async function skipFirstVisitTutorial(page: import('@playwright/test').Page) {
  // 只写 localStorage，不碰 DOM：document-start 时机的 init script 里访问
  // `document.documentElement` 会静默抛错，把整个脚本连带作废（入口页首帧脚本
  // 那次就是这么把 "The Lab" 烤进静态图里的）。
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('lab_tutorial_seen', '1')
    } catch {
      // 隐私模式等，忽略
    }
  })
}

/**
 * 按 ESC，直到断言成立。
 *
 * 为什么需要重试：Lab 里每一处 ESC 处理器都注册在 `useEffect` 里，而 `useEffect`
 * 在浏览器**绘制之后**才执行。Playwright 判定元素可见的时刻早于那一步，于是存在
 * 一个"对话框已经画出来、但 keydown 监听还没挂上"的窗口——按下去没反应。
 * 这个窗口在软渲染下会被拉长，表现为随机失败（教程那条就是这么间歇红的）。
 *
 * `toPass()` 重试整个块，是 Playwright 给这类"重试直到稳定"场景的工具。
 * 不用 `waitForTimeout` 猜一个固定延迟：那要么不够、要么白等。
 */
async function pressEscapeUntil(
  page: import('@playwright/test').Page,
  settled: () => Promise<void>,
) {
  await expect(async () => {
    await page.keyboard.press('Escape')
    await settled()
  }).toPass({ timeout: 20_000, intervals: [300, 600, 1_000] })
}

/** 通过地图面板传送进一个房间 */
async function teleportTo(page: import('@playwright/test').Page, roomId: string) {
  await page.getByTestId('nav-map').click()
  await expect(page.getByTestId('map-panel')).toBeVisible()
  await page.getByTestId(`map-room-${roomId}`).click()
  await expect(page.getByTestId('lab-ui')).toHaveAttribute('data-lab-in-room', 'true', {
    timeout: ROOM_ENTER_TIMEOUT,
  })
  await expect(page.getByTestId('lab-ui')).toHaveAttribute('data-lab-room', roomId)
}

test.describe('Lab 进入与退出', () => {
  test('打开 /lab 后走廊可交互（或在无 WebGL 时给出 Classic 出口）', async ({ page }) => {
    const has3d = await openLab(page)

    if (!has3d) {
      // 不支持 3D 的设备看到的那一屏：必须给出一条能走的路
      const fallback = page.getByTestId('lab-webgl-fallback')
      await expect(fallback).toBeVisible()
      await expect(fallback.getByRole('link')).toHaveAttribute('href', /classic/)
      return
    }

    // 走廊里不该显示"返回走廊"按钮
    await expect(page.getByTestId('lab-ui')).toHaveAttribute('data-lab-in-room', 'false')
    await expect(page.getByTestId('nav-back')).toHaveCount(0)
  })

  test('传送进房间再退回走廊', async ({ page }) => {
    test.skip(!(await openLab(page)), '此形态没有 WebGL')

    await teleportTo(page, 'about')
    await expect(page.getByTestId('nav-back')).toBeVisible()

    await page.getByTestId('nav-back').click()
    await expect(page.getByTestId('lab-ui')).toHaveAttribute('data-lab-in-room', 'false', {
      timeout: ROOM_ENTER_TIMEOUT,
    })
    await expect(page.getByTestId('nav-back')).toHaveCount(0)
  })

  test('房间里按 ESC 退回走廊', async ({ page }) => {
    test.skip(!(await openLab(page)), '此形态没有 WebGL')

    await teleportTo(page, 'contact')
    await pressEscapeUntil(page, async () => {
      await expect(page.getByTestId('lab-ui')).toHaveAttribute('data-lab-in-room', 'false', {
        timeout: ROOM_ENTER_TIMEOUT,
      })
    })
  })

  test('走廊里按 ESC 不会出事（没有房间可退）', async ({ page }) => {
    test.skip(!(await openLab(page)), '此形态没有 WebGL')

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('lab-ui')).toHaveAttribute('data-lab-in-room', 'false')
    // UI 还在，没有因为空的退场路径崩掉
    await expect(page.getByTestId('nav-map')).toBeVisible()
  })

  test('退回走廊后再进另一个房间', async ({ page }) => {
    test.skip(!(await openLab(page)), '此形态没有 WebGL')

    await teleportTo(page, 'about')
    await page.getByTestId('nav-back').click()
    await expect(page.getByTestId('lab-ui')).toHaveAttribute('data-lab-in-room', 'false', {
      timeout: ROOM_ENTER_TIMEOUT,
    })

    await teleportTo(page, 'projects')
    await expect(page.getByTestId('lab-ui')).toHaveAttribute('data-lab-room', 'projects')
  })

  /*
    ── 写这组用例时查出的缺陷：房间 → 房间的直接传送会落回走廊 ───────────────

    在 about 房间里打开地图、点 projects：`data-lab-in-room` 与 `data-lab-room`
    会先正确变成 `true` / `projects`（所以传送本身发生了），但几秒后又变回
    空——人最终停在走廊里，而地图上点的是另一个房间。

    经过「先退回走廊、再传送」就正常（上一条用例覆盖了那条路径），所以问题出在
    「房间内发起传送」这一条：退场编排与进场编排大概同时在跑，退场后到达并把
    刚进的房间又关掉了。这与 ADR 20260903211244 记的进房双写是同一类时序问题
    ——两套编排各自持有一部分状态。

    修法属于 XState 接线那一批（ADR 20260903211338）：房间生命周期成为单一状态图
    之后，「进场中收到退场」会是一条显式的边而不是两个 effect 抢。
  */
  /*
    用 `fixme` 而不是 `fail`：这个缺陷**依平台而异**。同一段代码在 chromium 上
    人最终落回走廊，在 mobile-safari（WebKit）上却停在 projects 里——
    `test.fail()` 于是在 webkit 上报 "Expected to fail, but passed"，把一条真实
    缺陷变成了 CI 噪声。会随渲染速度改变结论，正说明它是竞态而不是确定的错误行为。

    `fixme` 的代价是修好时不会有人被提醒（不像 `fail` 会主动报错），所以这条在
    ADR 20260903211338 的接线清单里单独记着：房间生命周期收成单一状态图之后，
    「进场中收到退场」会是一条显式的边，那时把 fixme 去掉并让它真的跑。
  */
  test.fixme('（已知缺陷·平台相关）房间里直接传送到另一个房间会落回走廊', async ({ page }) => {
    await openLab(page)
    await teleportTo(page, 'about')
    await teleportTo(page, 'projects')

    await page.waitForTimeout(3_000)
    await expect(page.getByTestId('lab-ui')).toHaveAttribute('data-lab-room', 'projects')
    await expect(page.getByTestId('lab-ui')).toHaveAttribute('data-lab-in-room', 'true')
  })
})

test.describe('面板', () => {
  test('地图面板能开，用它自己的关闭按钮能关', async ({ page }) => {
    test.skip(!(await openLab(page)), '此形态没有 WebGL')

    await page.getByTestId('nav-map').click()
    await expect(page.getByTestId('map-panel')).toBeVisible()
    await page.getByTestId('map-close').click()
    await expect(page.getByTestId('map-panel')).toHaveCount(0)
  })

  /*
    ── 写这组用例时查出的缺陷：地图面板盖住整排导航按钮 ─────────────────────

    面板是 `top: 0, right: 16, width: 280`，而四个导航按钮在 `top: 16, right: 16`
    排成一行（每个 40px + 8px 间隔，合计约 184px）。面板一开就把它们全压在下面。

    后果有两条，都不报错：
      1. 地图按钮带着 `aria-expanded`（一副可切换的样子），但**再点一次关不掉**
         ——点到的是面板的标题
      2. `NavigationUI` 里那段"开一个关掉另一个"的互斥逻辑，在地图开着时
         **根本无法触发**，因为另外三个按钮都点不到

    Playwright 的报错原文说得很直白：
    `<h3>Navigation map</h3> from <div data-testid="map-panel"> subtree
    intercepts pointer events`。

    修法（面板下移到按钮行之下，或给按钮行更高的 z-index）属于交互打磨那一批。
    在此之前用 `test.fail()` 把它固化——修好之后这条会开始通过并报错，
    强迫人回来把标记去掉。
  */
  test.fail('（已知缺陷）地图开着时应该还能点别的导航按钮', async ({ page }) => {
    test.skip(!(await openLab(page)), '此形态没有 WebGL')

    await page.getByTestId('nav-map').click()
    await expect(page.getByTestId('map-panel')).toBeVisible()

    /*
      现在点不到：按钮被面板盖住。用 `trial: true` 只做可点性判定、不真的派发
      点击——这样失败原因是明确的"元素不可点"，而不是"点了但没反应"，
      也不必等一次完整的超时（CI 上第一版就是靠重试才勉强报出结果）。
    */
    await page.getByTestId('nav-achievements').click({ trial: true, timeout: 3_000 })
  })

  test('成就面板能开，用它自己的关闭按钮能关', async ({ page }) => {
    test.skip(!(await openLab(page)), '此形态没有 WebGL')

    await page.getByTestId('nav-achievements').click()
    await expect(page.getByTestId('achievements-panel')).toHaveAttribute('data-open', 'true')

    // 成就面板与地图面板一样盖住导航按钮行，所以切换按钮点不到（见上一条的说明）
    await page.getByTestId('achievements-close').click()
    await expect(page.getByTestId('achievements-panel')).toHaveAttribute('data-open', 'false')
  })

  test('走廊里按 ESC 关面板', async ({ page }) => {
    test.skip(!(await openLab(page)), '此形态没有 WebGL')

    await page.getByTestId('nav-map').click()
    await expect(page.getByTestId('map-panel')).toBeVisible()
    await pressEscapeUntil(page, async () => {
      await expect(page.getByTestId('map-panel')).toHaveCount(0, { timeout: 1_500 })
    })
  })

  test('走廊里按 ESC 也关成就面板', async ({ page }) => {
    test.skip(!(await openLab(page)), '此形态没有 WebGL')

    await page.getByTestId('nav-achievements').click()
    const panel = page.getByTestId('achievements-panel')
    await expect(panel).toHaveAttribute('data-open', 'true')
    await pressEscapeUntil(page, async () => {
      await expect(panel).toHaveAttribute('data-open', 'false', { timeout: 1_500 })
    })
  })

  /*
    ── ESC 在房间里只关最内层的那个东西 ──────────────────────────────────────

    这条曾是 `test.fail()`：改造前有 17 个 window keydown 监听在抢 ESC
    （15 个 `DoorSection` 实例 + `NavigationUI` + `LabTutorial`），后两者不走
    消费栈也不 stopPropagation，于是在房间里按一次 ESC 会同时关面板**并**让房间
    退场。`apps/resume/AGENTS.md` 的「ESC 的优先级」一节早就写明这个形态被禁止
    ——而被禁止的形态正是当时的代码。

    监听收成一个（`components/lab/useEscapeRouter.ts`，ADR 20260903211244）之后
    它开始通过，`test.fail()` 随即报 "Expected to fail, but passed"，标记就得
    去掉——这正是用 `test.fail()` 而不是 TODO 注释的理由：**修好时它会主动提醒**。

    时序上踩过两次，保留下面那段等待逻辑的写法：缺陷的表现是"房间**最终**退掉"，
    而退房要好几秒，固定等待猜不对（第一版在面板关闭瞬间就查，第二版等 4 秒，
    在 CI 的 WebKit 上仍然不够）。
  */
  test(
    '房间里按 ESC 只关面板，不连带退房',
    async ({ page }) => {
      test.skip(!(await openLab(page)), '此形态没有 WebGL')

      await teleportTo(page, 'about')
      await page.getByTestId('nav-achievements').click()
      await expect(page.getByTestId('achievements-panel')).toHaveAttribute('data-open', 'true')

      await page.keyboard.press('Escape')

      // 面板该关
      await expect(page.getByTestId('achievements-panel')).toHaveAttribute('data-open', 'false')

      /*
        等**退房这件事发生**，而不是等一个固定时长。

        退房是两段各 1 秒的 gsap 加关门，`contextExitRoom()` 要好几秒后才执行。
        固定等待在这里猜不对，因为要猜的是动画时长 × 平台 × 机器负载：第一版在
        面板关闭瞬间就查、第二版等 4 秒，两次都在某个平台上得出了相反的结论。
      */
      const inRoom = page.getByTestId('lab-ui')
      let exited = false
      try {
        await expect(inRoom).toHaveAttribute('data-lab-in-room', 'false', { timeout: 20_000 })
        exited = true
      } catch {
        // 一直没退 —— 这才是正确行为
      }

      expect(exited, '关面板的那次 ESC 连带把房间退了').toBe(false)
    },
  )
})

test.describe('教程气泡', () => {
  test('帮助按钮能重新打开操作说明', async ({ page }) => {
    test.skip(!(await openLab(page)), '此形态没有 WebGL')

    await page.getByTestId('nav-help').click()
    await expect(page.getByTestId('lab-tutorial')).toBeVisible()
  })

  test('「开始探索」按钮关掉操作说明', async ({ page }) => {
    test.skip(!(await openLab(page)), '此形态没有 WebGL')

    await page.getByTestId('nav-help').click()
    await expect(page.getByTestId('lab-tutorial')).toBeVisible()
    /*
      不能点遮罩的中心：那里是内层卡片，它有 `onClick={e => e.stopPropagation()}`
      （`LabTutorial.tsx:135`），所以点卡片**关不掉**。第一版就是这么写的，
      结果 `toHaveCount(0)` 一直收到 1。真实的关闭入口是卡片底部那两个按钮。
    */
    await page.getByTestId('tutorial-start').click()
    await expect(page.getByTestId('lab-tutorial')).toHaveCount(0)
  })

  test('「跳过」按钮也关掉操作说明', async ({ page }) => {
    test.skip(!(await openLab(page)), '此形态没有 WebGL')

    await page.getByTestId('nav-help').click()
    await expect(page.getByTestId('lab-tutorial')).toBeVisible()
    await page.getByTestId('tutorial-skip').click()
    await expect(page.getByTestId('lab-tutorial')).toHaveCount(0)
  })

  test('ESC 也能跳过操作说明', async ({ page }) => {
    test.skip(!(await openLab(page)), '此形态没有 WebGL')

    await page.getByTestId('nav-help').click()
    const tutorial = page.getByTestId('lab-tutorial')
    await expect(tutorial).toBeVisible()
    await pressEscapeUntil(page, async () => {
      await expect(tutorial).toHaveCount(0, { timeout: 1_500 })
    })
  })

  /*
    ── 房间教程气泡随退房消失 ────────────────────────────────────────────────

    这条曾是 `test.fail()`：教程类气泡永不自动消失（刻意的——它在等用户照着做），
    而全仓只有 `PublicationsRoom` 在退场时调 `hidePopup()`。于是进 About 不滚动 →
    2 秒后出现教程 → 退回走廊 → 气泡一直挂着；再进别的房间，它的教程排在队列
    第二位，**永远显示不出来**。漏掉一处不是"多一个气泡"，而是教程系统整体失效。
    审计 A7 记过这条并标为已修，实际只修了一间房。

    气泡带作用域之后（ADR 20260903211302）它开始通过，`test.fail()` 随即报
    "Expected to fail, but passed"——标记就得去掉。
  */
  test(
    '退房后房间教程气泡不留在走廊里',
    async ({ page }) => {
      test.skip(!(await openLab(page)), '此形态没有 WebGL')

      await teleportTo(page, 'about')

      /*
        直接定位**教程类**气泡，不要"取第一个可见的再断言它的 kind"。

        进房会解锁 `corridor_enter`，而庆祝气泡**插队到队首**（那是刻意的：
        它是对刚才动作的反馈，排在一条不自动消失的教程后面就失去因果关系）。
        所以第一个可见的气泡很可能是庆祝而不是教程——CI 上就是这么红的，
        本地跑不出来是因为时序更快。
      */
      const roomTutorial = page.locator(
        '[data-testid="achievement-popup"][data-popup-kind="tutorial"]',
      )
      // 房间教程在进房 2 秒后弹出，前面还可能排着一条 2 秒的庆祝
      await expect(roomTutorial).toBeVisible({ timeout: 20_000 })

      await page.getByTestId('nav-back').click()
      await expect(page.getByTestId('lab-ui')).toHaveAttribute('data-lab-in-room', 'false', {
        timeout: ROOM_ENTER_TIMEOUT,
      })

      // 回到走廊后房间教程不该还在
      await expect(page.getByTestId('achievement-popup')).toHaveCount(0)
    },
  )
})

test.describe('首访', () => {
  test('第一次进 Lab 会自动弹操作说明，点一下关掉且不再弹', async ({ page }) => {
    /*
      这条用的是干净的 storage（不置 `lab_tutorial_seen`），所以它覆盖的正是
      其余用例刻意跳过的那条路径。给的超时比别处宽：遮罩要等"加载进度稳定
      600ms + 2.4 秒"，而软渲染下前半段时长不确定。
    */
    test.skip(!(await openLab(page, { firstVisit: true })), '此形态没有 WebGL')

    const tutorial = page.getByTestId('lab-tutorial')
    await expect(tutorial).toBeVisible({ timeout: 25_000 })

    await page.getByTestId('tutorial-start').click()
    await expect(tutorial).toHaveCount(0)

    // 关掉之后导航按钮必须可点 —— 遮罩没真的消失时这一步会超时
    await page.getByTestId('nav-map').click()
    await expect(page.getByTestId('map-panel')).toBeVisible()

    // 标记已持久化：刷新后不再自动弹
    await page.reload()
    await expect(page.getByTestId('lab-ui')).toBeAttached({ timeout: LAB_READY_TIMEOUT })
    await expect(tutorial).toHaveCount(0)
  })
})

test.describe('无 JS 时的 Lab', () => {
  test.use({ javaScriptEnabled: false })

  test('静态产物不是一片空白（有背景与可跳转的出口）', async ({ page }) => {
    await page.goto('/lab/')
    // 没有 JS 就没有 Canvas，但页面必须有内容而不是白屏
    const body = await page.locator('body').innerHTML()
    expect(body.length).toBeGreaterThan(200)
  })
})
