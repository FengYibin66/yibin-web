# 20260907120701. GSAP 的创建物归创建者所有：一律 `gsap.context()` 持有、只 `revert()` 自己的；全仓禁止 `ScrollTrigger.getAll()`

- 状态：已接受
- 索引：Classic 页滚动显形在「详情页 → 返回简历（客户端导航 + hash）→ 上滚」路径上把卡片留在 3%–83% 透明度（dev 必现，线上不出现）。根因是 `ClassicPage` 与 `SmoothScrollProvider` 都用 `ScrollTrigger.getAll().forEach(t => t.kill())` 清全局——不分归属、连带杀播放中的 tween——叠加 StrictMode 双跑 effect 与 `gsap.from` 以当前值为终点。决定：每个 GSAP 使用方用 `gsap.context()` 持有自己创建的一切，cleanup 只 `revert()` 自己的；显形用 `fromTo` 显式终点 + `clearProps`；已滚过的触发器快进到终点；尊重 `prefers-reduced-motion`；AST 门禁禁止 `ScrollTrigger.getAll()`；显形声明的每条选择器必须在渲染出的页面上匹配到元素（此前三条是死的）；顺带修掉线上也在的 hash 跳转半路被掐断（`html { scroll-behavior: smooth }` 与 Lenis 互抢），平滑滚动只有 Lenis 一个主人
- 日期：2026-09-07

## 背景

2026-09-07 实机：从论文详情点「返回简历」落到 `/classic/#publications`，往上滚，项目卡 /
时间轴 / 技能徽章停在半透明。Playwright 复现（生产产物 + dev 各测）：

| 场景 | 生产产物 | dev |
|---|---|---|
| 直接 `/classic/#publications` | 正常 | 正常 |
| 详情 → 返回，落地时 | 正常 | 正常 |
| 详情 → 返回 → 上滚到 `#projects` | 正常 | **project-card 3/16（最低 0.42）、timeline-item 3/5（0.03）、skill-badge 7/19（0.22）** |

根因是三件事叠加，缺一不发生：

1. `app/classic/page.tsx` 的 cleanup 是 `ScrollTrigger.getAll().forEach(t => t.kill())`。
   `getAll()` 不分归属（根 layout 的 `SmoothScrollProvider` 也这么写，两者会互相清掉）；
   `ScrollTrigger.kill()` 默认**连带杀掉关联的 tween**。
2. dev 的 StrictMode 把 effect 跑两遍。客户端导航进来时 hash 已就位、`document.readyState`
   已是 `complete`，注册走同步分支，触发器一注册就对视口上方的区开播；几十毫秒后
   cleanup 把播放中的 tween 杀在半路，元素带着 0.03–0.8 的内联 opacity。
3. 第二次注册用 `gsap.from`——「从给定值动画**到元素当前值**」——把残值当成了终点。

线上没有 StrictMode，所以看不到。但结构上任何第二次挂载（HMR、路由往返）都会触发，
而且第 1 条本身就是错的：一个页面组件不该有权清掉全局。

顺着 review 又发现三条显形声明**匹配不到任何元素**（`#about .edu-card`、
`#contact .contact-item`），教育卡翻转、联系区渐入从来没跑过，线上每次进 Classic 打
3 条 gsap 空目标警告。这是「声明了 ≠ 接上了」的又一例（同 ADR 20260903211338）。

把显形改成 `fromTo`（未触发即隐藏）之后，又暴露出被旧写法掩盖的第四件事，**线上也在**：
`/classic/#publications` 直达时生产停在 scrollY 30、dev 停在 1744，目标在 8500px 下方——
**hash 跳转根本没到位**。`globals.css` 给 `html` 设了 `scroll-behavior: smooth`，浏览器 / Next
的 hash 跳转变成一段原生动画；Lenis 把中途的原生 scroll 事件当成外部滚动、把目标改成
当前值再写回，跳转被掐断在半路。用户截图里「论文发表」标题落在视口底部而非顶部，正是它。
旧的 `gsap.from` 不动未触发的元素，所以"没滚到位"看起来像"正常"。

不决策的后果：继续在 effect 里手写 `getAll().kill()`，下一个用 GSAP 的组件照抄，
互相清掉对方的触发器，症状随机、只在某些导航路径出现，排查靠运气。

## 选项

- **A. 每个使用方 `gsap.context()` 归属，cleanup 只 `revert()` 自己的；AST 门禁禁止 `getAll()`**：
  GSAP 官方的 React 集成模式；`revert()` 同时撤销 tween、触发器与内联样式，StrictMode
  天然安全；门禁把"清全局"这种写法从源头堵死。缺点：每个使用方多两行样板。
- **B. 中央动画注册表**：一个 store 记录谁创建了什么，统一按 owner 撤销。
  等于自己再实现一遍 `gsap.context()`，多一层间接，且不能阻止有人绕过注册表直接
  `getAll().kill()`。
- **C. 放弃 GSAP 显形，改 IntersectionObserver + CSS transition**：无 GSAP 生命周期
  问题。但 Classic 的显形有 stagger、back ease、3D 翻转，CSS 要逐个手写关键帧；
  且 `SmoothScrollProvider` 的 Lenis + ScrollTrigger 联动仍在，问题只是换了地方。

## 决策

选 **A**，并把四条不变量一起落地：

1. **归属**：一切创建物在 `gsap.context()` 里；cleanup 只 `ctx.revert()`。
   全仓 `ScrollTrigger.getAll()` 零调用，AST 门禁 `__tests__/noGlobalScrollTriggerKill.test.ts`
   守着（`getAll()` 唯一合理用途是读——仓库里没有这种用法，整个方法禁掉比区分读写
   简单且不会漏）。
2. **终点显式**：显形用 `gsap.fromTo`，终点是常量，不读 DOM 当前值；完成后 `clearProps`，
   DOM 无痕。
3. **已滚过的直接呈现**：挂载后 `refresh()`，`progress === 1` 的触发器快进到终点。带 hash
   进入时视口上方的内容不补播 0.6–1.7 秒的入场动画。
4. **尊重 `prefers-reduced-motion`**：不注册就是最好的动画。
5. **平滑滚动只有一个主人**：全站由 Lenis 做，`html` 不设 `scroll-behavior: smooth`
   （改 `auto`），程序化滚动一律 `behavior: 'instant'` 或 `lenis.scrollTo`。引入 Lenis 官方
   基础 CSS（此前从未引入）。E2E 断言 hash 目标真的落在视口顶部——第一版只断言"目标在
   DOM 里"，跳转没发生时照样绿，是这次漏网的直接原因。

**判定原则：谁创建，谁撤销，且只撤销自己的。** 任何"清全局"的写法（`getAll().kill()`、
`gsap.killTweensOf('*')`、`gsap.globalTimeline.clear()`）都是同一类错误。

显形声明是数据（`REVEALS`），单测断言每条 `targets` / `trigger` 在渲染出的 Classic 各区里
匹配到元素——死选择器直接红。

## 影响

- 正面：StrictMode / HMR / 路由往返下不再有残值；线上少 3 条空目标警告；教育卡与联系区
  的入场动画第一次真的跑起来；reduced-motion 用户不再被强制看动画。
- 负面：显形逻辑多了约 40 行（context、快进、reduced-motion 分支）；E2E 多 9 条用例
  （约 +1 分钟）。
- 影响面：`lib/animations/{revealSpecs,scrollReveal}.ts`（取代 `scrollAnimations.ts`）、
  `app/classic/page.tsx`、`app/globals.css`（`scroll-behavior`）、`app/layout.tsx`（Lenis CSS）、
  `components/providers/SmoothScrollProvider.tsx`、`components/gallery/GalleryTrack.tsx`、
  `components/classic/ClassicBackLink.tsx`（testid）、
  `components/sections/{Education,Contact}Section.tsx`（补类）、
  `__tests__/{scrollReveal,noGlobalScrollTriggerKill}.test.ts(x)`、
  `__tests__/helpers/sourceScan.ts`（新增 `memberCalls`）、`e2e/classicReveal.spec.ts`、
  `apps/resume/AGENTS.md`。
