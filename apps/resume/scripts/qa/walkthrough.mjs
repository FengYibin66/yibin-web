#!/usr/bin/env node
/**
 * 用户路径巡检：像用户一样把 Classic 走一遍，每一步截一张整屏。
 *
 * **这不是测试，是给人看的。** 它不断言任何东西；产出是一叠截图，改完视觉之后
 * 必须**逐张看完**再说"好了"。
 *
 * 为什么要有它（2026-09-07）：滚动显形那次事故，E2E 与复现脚本全绿，但截图里
 * 项目卡半透明、hash 落在半路、卡片被扭成 88°——任何人看一眼都能发现。原因是
 * 我只在自己已经怀疑的地方截图、只量自己想验证的那个数（opacity），从没像用户
 * 一样走「首页 → Classic → 点阅读详情 → 返回 → 往上滚」这条路并看每一屏。
 * 断言守的是已知的坏法；巡检抓的是没想到的坏法。
 *
 * 用法：
 *   node scripts/qa/walkthrough.mjs                       # 打 dev（127.0.0.1:3000）
 *   BASE=http://127.0.0.1:4321 node scripts/qa/walkthrough.mjs   # 打别的地址
 *   OUT=/tmp/walk node scripts/qa/walkthrough.mjs         # 截图目录（默认 .qa/walk，已 gitignore）
 *
 * 选择器一律加 `:visible`：`TimelineItem` 同时渲染手机版（`md:hidden`）与桌面版，
 * 不加会命中隐藏的那份。
 */
import { chromium } from '@playwright/test'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3000'
const OUT = resolve(process.env.OUT ?? '.qa/walk')
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', e => errors.push(e.message.slice(0, 160)))

let n = 0
async function shot(label) {
  n += 1
  await page.waitForTimeout(900)
  const file = `${String(n).padStart(2, '0')}-${label}.png`
  await page.screenshot({ path: `${OUT}/${file}` })
  console.log(`${file.padEnd(48)} scrollY=${await page.evaluate(() => Math.round(scrollY))}`)
}
async function wheel(dy) {
  await page.mouse.move(700, 450)
  await page.mouse.wheel(0, dy)
  await page.waitForTimeout(700)
}
async function jumpTo(selector) {
  await page.evaluate(sel => document.querySelector(sel)?.scrollIntoView({ behavior: 'instant' }), selector)
  await page.waitForTimeout(1200)
}

// ── 门户 → Classic → 从上滚到底 ───────────────────────────────────────────────
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForTimeout(2500)
await shot('portal')
const classicEntry = page.getByText('Classic Résumé', { exact: true }).or(page.getByText('常规简历', { exact: true })).first()
await classicEntry.click()
await page.waitForURL(/\/classic/, { timeout: 30000 })
await shot('classic-top')
for (let i = 1; i <= 7; i++) { await wheel(1400); await shot(`classic-scroll-${i}`) }

// ── 论文详情 → 返回 → 往上滚（原始事故路径）──────────────────────────────────
await jumpTo('#publications')
await shot('publications-in-view')
await page.locator('a[href^="/classic/publications/"]:visible').first().getByRole('heading').first().click()
await page.waitForURL(/\/classic\/publications\//, { timeout: 30000 })
await shot('publication-detail')
await page.getByTestId('classic-back-link').click()
await page.waitForURL(/#publications/, { timeout: 30000 })
await shot('after-back-publications')
for (let i = 1; i <= 3; i++) { await wheel(-1200); await shot(`after-back-publications-up-${i}`) }

// ── 经历详情 → 返回 → 上下滚 ─────────────────────────────────────────────────
await jumpTo('#experience')
const exp = page.locator('a[href^="/classic/experience/"]:visible').first()
await exp.scrollIntoViewIfNeeded(); await page.waitForTimeout(700)
await shot('experience-before-click')
await exp.click()
await page.waitForURL(/\/classic\/experience\//, { timeout: 30000 })
await shot('experience-detail')
await wheel(900); await shot('experience-detail-scroll')
await page.getByTestId('classic-back-link').click()
await page.waitForURL(/#experience/, { timeout: 30000 })
await shot('after-back-experience')
await wheel(1200); await shot('after-back-experience-down')
await wheel(-2400); await shot('after-back-experience-up')

// ── 证书页 → 返回 → 上下滚 ───────────────────────────────────────────────────
await page.goto(`${BASE}/classic/credentials/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForTimeout(2000)
await shot('credentials')
await wheel(900); await shot('credentials-scroll')
await page.locator('a[href="/classic/#credentials"]:visible').first().click()
await page.waitForURL(/#credentials/, { timeout: 30000 })
await shot('after-back-credentials')
await wheel(-1000); await shot('after-back-credentials-up-1')
await wheel(-1000); await shot('after-back-credentials-up-2')
await wheel(2500); await shot('after-back-credentials-down-to-contact')

await browser.close()
console.log(`\n${n} 张截图 → ${OUT}`)
console.log(errors.length ? `页面异常 ${errors.length} 条：\n  ${errors.join('\n  ')}` : '页面异常：0')
console.log('接下来：逐张看。')
