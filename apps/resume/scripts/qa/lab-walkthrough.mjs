#!/usr/bin/env node
/**
 * Lab 巡检：像用户一样把走廊与房间走一遍，每一步截一张整屏。
 *
 * **这不是测试，是给人看的。** 它不断言任何东西；产出是一叠截图，改完视觉之后
 * 必须**逐张看完**再说"好了"。
 *
 * ## 为什么要有它
 *
 * `apps/resume/AGENTS.md` 早就写着「改 Lab 的视觉或性能之前，先跑一遍带截图的
 * 复现，再看 E2E」——但 Lab 一直**没有**这样的工具（Classic 有
 * `walkthrough.mjs`）。2026-09-04 实机验收抓到的四个缺陷里三个是纯视觉的
 * （About 的蓝框、Projects 门口的深棕色块、滚动卡顿），`data-*` 属性断言对它们
 * 全部失明。E2E 看不见画面，这就是那道缺口。
 *
 * ## 用法
 *
 *   node scripts/qa/lab-walkthrough.mjs                  # 打 dev（127.0.0.1:3000）
 *   BASE=http://127.0.0.1:4321 node scripts/qa/lab-walkthrough.mjs   # 打静态产物
 *   OUT=/tmp/lab node scripts/qa/lab-walkthrough.mjs     # 截图目录（默认 .qa/lab）
 *   REDUCED=1 node scripts/qa/lab-walkthrough.mjs        # 模拟"减少动效"
 *
 * 跑两遍（一遍常规、一遍 `REDUCED=1`）再对比，是验收动效开关的方式：
 * reduced 那遍里涂鸦、虫子、头像逐帧、字母漂浮都应当**静止**。
 *
 * ## 两个坑（与 e2e/lab.spec.ts 同源）
 *
 * - **首访操作说明是 `inset: 0` 遮罩，会拦下所有点击**。这里在 initScript 里
 *   置 `lab_tutorial_seen`，以回访身份进场。想看首访体验就临时去掉那一行。
 * - **门是 R3F 的 mesh，不在 DOM 里**，所以进房走地图面板的传送按钮 —— 那也是
 *   真实用户路径。
 */
import { chromium } from '@playwright/test'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3000'
const OUT = resolve(process.env.OUT ?? '.qa/lab')
const REDUCED = process.env.REDUCED === '1'

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

/*
  SwiftShader 软渲染：CI 与本地 headless 都没有真 GPU。不加这三个参数时
  Chromium 直接拿不到 WebGL 上下文，`LabClient` 会渲染 `lab-webgl-fallback`
  ——那时截图里只有一个"不支持 3D"的兜底页，看起来像 Lab 坏了。
*/
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: REDUCED ? 'reduce' : 'no-preference',
})
await page.addInitScript(() => {
  try {
    window.localStorage.setItem('lab_tutorial_seen', '1')
  } catch {
    // 隐私模式等，忽略
  }
})

const errors = []
page.on('pageerror', e => errors.push(e.message.slice(0, 200)))

let n = 0
async function shot(label, wait = 1200) {
  n += 1
  await page.waitForTimeout(wait)
  const file = `${String(n).padStart(2, '0')}-${label}.png`
  await page.screenshot({ path: `${OUT}/${file}` })
  const state = await page.evaluate(() => {
    const ui = document.querySelector('[data-testid="lab-ui"]')
    const html = document.documentElement.dataset
    return {
      room: ui?.getAttribute('data-lab-room') ?? '-',
      phase: ui?.getAttribute('data-lab-phase') ?? '-',
      mode: html.labMode ?? '-',
      dog: html.labDog ?? '-',
      cat: html.labCat ?? '-',
    }
  })
  console.log(`${file.padEnd(44)} room=${state.room} phase=${state.phase} mode=${state.mode} dog=${state.dog} cat=${state.cat}`)
}

/** 方向键前进。走廊是一维导轨，不是 WASD */
async function walk(steps) {
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(110)
  }
}

// ── 门户 → Lab 走廊 ──────────────────────────────────────────────────────────
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
await shot('portal', 2500)

await page.goto(`${BASE}/lab/`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
await page.getByTestId('lab-ui').waitFor({ timeout: 60_000 })
await shot('corridor-start', 4000)

// 沿走廊走到底：门、家具、壁画、彩蛋、段末门依次入画。
// 同一路上还能看到：年份刻度（墙脚）、履历便签（墙上方）、三扇窗（右 −12.5 / 左 −40.5 / 右 −62）、
// 跟跑的狗（画面下方靠右）。第 8 张附近猫应当已醒（data-lab-cat）。
for (let i = 1; i <= 8; i += 1) {
  await walk(6)
  await shot(`corridor-${i}`)
}

// ── 狗：停 3 秒该坐下（sit），再走该起来 ─────────────────────────────────
await shot('dog-sit', 3500)
await walk(2)
await shot('dog-up', 600)

// ── 招聘官路线：从这里按脚印，取三站截图，再滚一下轮打断 ──────────────────
// 注意：路线是 wall-clock 驱动的 tween，软渲染下相机会落后于目标，截图看的是
// 字幕与模式切换，不是精确位置。走完全程 58 秒不在巡检里等。
await page.getByTestId('nav-tour').click()
await shot('tour-start', 800)
await page.waitForTimeout(7000)
await shot('tour-stop-2', 200)
await page.waitForTimeout(7000)
await shot('tour-stop-3', 200)
await page.mouse.move(720, 450)
await page.mouse.wheel(0, 120)
await shot('tour-interrupted', 600)

// ── 地图：未进过的房间应带手写问号 ───────────────────────────────────────────
await page.getByTestId('nav-map').click()
await shot('map-before-visits', 800)
await page.getByTestId('map-close').click()

// ── 逐个房间进出。退回走廊那张要能看出门已上色（墨迹记忆）─────────────────
for (const room of ['about', 'projects', 'publications', 'contact']) {
  await page.getByTestId('nav-map').click()
  await page.waitForTimeout(500)
  await page.getByTestId(`map-room-${room}`).click()
  await shot(`room-${room}-enter`, 9000)
  await page.mouse.move(720, 450)
  await page.mouse.wheel(0, 600)
  await shot(`room-${room}-look`, 1500)
  await page.getByTestId('nav-back').click()
  await shot(`room-${room}-back`, 6500)
}

// ── 地图：进过的房间不再有问号 ───────────────────────────────────────────────
await page.getByTestId('nav-map').click()
await shot('map-after-visits', 800)
await page.getByTestId('map-close').click()

// ── 成就面板 ─────────────────────────────────────────────────────────────────
await page.getByTestId('nav-achievements').click()
await shot('achievements', 800)
await page.getByTestId('achievements-close').click()

// ── 回访：刷新之后墨迹记忆应当还在（门保持上色）───────────────────────────
await page.reload({ waitUntil: 'domcontentloaded' })
await page.getByTestId('lab-ui').waitFor({ timeout: 60_000 })
await shot('revisit-corridor', 4000)
await walk(6)
await shot('revisit-inked-doors')
await page.getByTestId('nav-map').click()
await shot('revisit-map', 800)

await browser.close()

console.log(`\n${n} 张截图 → ${OUT}${REDUCED ? '（reduced-motion）' : ''}`)
console.log(errors.length ? `页面异常 ${errors.length} 条：\n  ${errors.join('\n  ')}` : '页面异常：0')
console.log('接下来：逐张看。三件事——构图有没有错位 / 门的上色对不对 / 有没有该动却不动的东西。')
