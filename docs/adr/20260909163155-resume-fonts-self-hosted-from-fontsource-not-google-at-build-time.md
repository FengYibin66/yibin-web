# 20260909163155. resume 的四款界面字体改为自托管：从 `@fontsource` npm 包经 `next/font/local` 装船，构建时不再联 Google，并删除 `font-mocks.js`

- 状态：提议
- 索引：resume 的 Space Grotesk / Inter / JetBrains Mono / Cormorant Garamond 四款界面字体自 mock 引入以来**从未在线上生效**——`pnpm build` 带着 `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`，而 Next 在该模式下把 mock CSS 里的 `https://fonts.gstatic.com/...` 地址**原样当作字体文件内容写出**，线上每个 woff2 都是 89 字节的 URL 字符串，浏览器报 `OTS parsing error`，全部回退到系统字体。决定：① 字体改为 npm 依赖 `@fontsource-variable/{inter,space-grotesk,jetbrains-mono}` + `@fontsource/cormorant-garamond`（OFL-1.1，npmmirror 可拉），经 `next/font/local` 引用包内 latin 子集 woff2；② 删除 `scripts/font-mocks.js` 与 `build` 脚本里的环境变量，`next/font/google` 从 resume 退出；③ 补一道产物门禁：`out/` 里每个 `.woff2` 必须以 `wOF2` 魔数开头。判定原则：**构建必须在离线的大陆机器上产出与本机完全相同的产物；任何「为了让构建过」而伪造的输入，都会变成线上的静默缺陷**
- 日期：2026-09-09

## 背景

2026-09-09 手工上线后排查另一个问题时，Playwright 控制台里冒出四条：

```
Failed to decode downloaded font: /_next/static/media/ad3c903c96ec6e2b-s.woff2
OTS parsing error: invalid sfntVersion: 1752462448
```

`1752462448` 十六进制是 `0x68747470`，ASCII 是 **`http`**。直接抓线上文件：

```
GET /_next/static/media/ad3c903c96ec6e2b-s.woff2
200  content-type: font/woff2  content-length: 89
https://fonts.gstatic.com/s/spacegrotesk/v15/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gozwUi9bA.woff2
```

**字体文件的全部内容就是一个 URL。** 根因链条：

1. `apps/resume/package.json`：`"build": "NEXT_FONT_GOOGLE_MOCKED_RESPONSES=$(pwd)/scripts/font-mocks.js next build"`
2. `scripts/font-mocks.js` 头部自述：*"minimal but valid @font-face CSS **so the build succeeds**"*——它的目标是让 `next build` 在无外网时不报错，从来不是让字体能用。它返回的 CSS 里 `src: url(https://fonts.gstatic.com/...)`。
3. Next 15.5.20 的 `fetchFontFile`（`next/dist/compiled/@next/font/dist/google/fetch-font-file.js`）：

   ```js
   if (process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES) {
       if (url.startsWith('/')) return fs.readFileSync(url);
       return Buffer.from(url);          // ← URL 字符串本身成了「字体」
   }
   ```

于是**每一次用 `pnpm build` 产出的构建，四款字体都是坏的**，包括 7 月那次。这不是本次上线的回归，是 mock 写下那天起的常态。DOM 层所有用到 `--font-display` / `--font-sans` / `--font-mono` / `--font-gallery` 的文字，线上都是系统回退字体；只有 Lab 的手绘字体（`public/fonts/`，走 `subset-fonts.py` 流水线）是真的。

为什么一直没人发现：`next build` 绿，vitest 绿，E2E 绿（Playwright 不检查字体是否解码成功），巡检截图在本机——而本机没有 mock 那一步时字体就是对的？不：本机 `pnpm build` 也带那个环境变量，产物同样是坏的；只是没人拿放大镜看过截图里的字形。**测试只测了「构建成功」和「页面可达」，没有一处断言「产物里的字体是字体」。**

约束：

- 生产构建在北京的 CVM 上进行（`deploy-prod.sh`），**Google 不可达**。这是 mock 存在的原因，也是任何「构建时联 Google」方案的死刑。
- ADR [20260903140619](./20260903140619-lab-external-assets-and-runtime-sketch.md) 已确立：外部素材进仓库必须记录来源与许可（`public/CREDITS.md`）。
- 平台路线图计划 A 的方向是「构建不依赖外网、可在任何地方复现」。

不决策会发生什么：线上继续用系统字体；下一次有人在本机开一个真能访问 Google 的环境构建，产物突然「变好看」，再到 CVM 构建又变回去——**同一份代码在两台机器上产出不同的站点**，这比一直坏更难查。

## 选项

- **A. `@fontsource` npm 包 + `next/font/local`**：四款都在 npm 上（`@fontsource-variable/inter`、`@fontsource-variable/space-grotesk`、`@fontsource-variable/jetbrains-mono`、`@fontsource/cormorant-garamond`，均 v5.3.0、OFL-1.1，**npmmirror 已核实可拉**）。包内有 `files/<font>-latin-wght-normal.woff2`（可变字重）或 `files/<font>-latin-{400,500,600}-normal.woff2`（静态字重），并随包附 `LICENSE`。`layout.tsx` 改用 `next/font/local` 指向这些文件，其余（CSS 变量名、`display: swap`、`preload: false`）不变。优点：字体成为普通依赖——版本锁在 `pnpm-lock.yaml`、许可全文随包装船、大陆可拉、构建零外网、本机与 CVM 产物逐字节一致；mock 与环境变量整个删掉。缺点：多 4 个依赖；产物多约 200–400 KB woff2（但现在那 4 个 89 字节的假文件本来就得换成真的，这不是新增，是把该有的补上）。
- **B. 手动下载 woff2 进 `media-src/fonts/`，走 `subset-fonts.py`**：与 Lab 字体同一条流水线，能按实际用到的字符子集化（latin 界面字体本来就小，收益有限）。缺点：要有人在能访问 Google 的机器上下载，且 Google Fonts 的 URL 带版本（`/v15/`）会漂——本机实测那个 v15 地址已经 404；来源不可机械复现，版本无法从 lockfile 追溯。
- **C. 去掉 mock，让 `next/font/google` 在构建时真去 Google**：CVM 不可达，构建必失败。即使计划 A 第 1 期把构建挪到 GitHub runner，也等于把「站点能不能构建」押在 Google 可用性上。否决。
- **D. 保留 `next/font/google` + 把 mock 改成指向本地文件**：Next 在 mock 模式下对以 `/` 开头的路径会 `readFileSync`，所以 mock CSS 写 `src: url(/abs/path.woff2)` 就能读到真文件。缺点：字体文件仍要以 B 的方式进仓库；多一层只为测试设计的 mock 间接；`next/font/google` 的存在会持续误导读者以为字体来自 Google。是 B 加上一层没有收益的间接。

## 决策

**A。**

- `apps/resume/package.json`：加四个 `dependencies`（必须是 **直接**依赖——pnpm 的严格 `node_modules` 下，`next/font/local` 的相对路径只能解析到本包声明过的依赖）；`build` 脚本改回裸的 `next build`。
- 删除 `apps/resume/scripts/font-mocks.js`。
- `app/layout.tsx`：`next/font/google` → `next/font/local`。可变字重三款各指一个 `*-latin-wght-normal.woff2`，声明 `weight: '100 900'` 等区间；Cormorant Garamond 指三个静态字重文件。CSS 变量名、`display: 'swap'`、`preload: false` 保持不变，`globals.css` 与所有消费方零改动。
- `public/CREDITS.md` 字体表加四行；OFL 全文由包内 `LICENSE` 提供——这顺带给了「待补」那三款 Lab 字体一个可复用的做法（本 ADR 不处理它们，只登记）。
- **门禁**：`e2e/staticExport.spec.ts` 新增用例——枚举 `out/_next/static/media/*.woff2`，断言数量 ≥ 4、每个文件前四字节为 `wOF2`（`77 4F 46 32`）且大小 > 1 KB。它在 CI 的 `resume-e2e` job 里随既有用例运行，不需要新接线。这条门禁会把今天的缺陷抓成一行明确的失败：`ad3c903c96ec6e2b-s.woff2: 89 bytes, starts with "http"`。
- `docs/specs/resume-site.md:359` 的「字体：`next/font/google` 自动 subset」改为实际做法。

**判定原则**：*构建必须在离线的大陆机器上产出与本机完全相同的产物；任何「为了让构建过」而伪造的输入，都会变成线上的静默缺陷。* 以后再有「CI/CVM 上拉不到 X，先 mock 一下让构建过」的冲动，先按这句衡量：mock 掉的东西会不会进产物？会，就不能 mock，要把 X 变成仓库内可复现的输入。

## 影响

- 正面：线上第一次真正显示设计选定的四款字体；本机与 CVM 构建产物一致；删掉一个专为绕过外网而存在的 mock 及其环境变量；字体版本与许可进入 lockfile 与包管理的正常轨道；新增门禁让「产物里的字体不是字体」这类缺陷在 PR 阶段现形。
- 负面：产物体积增加约 200–400 KB（latin 子集、woff2）——这是「应有而缺失」的体积，不是膨胀；四个新依赖要随 renovate/手工升级；`next/font/local` 不做 Google 那种按 `subsets` 自动裁剪，但 `@fontsource` 已按 unicode-range 拆成 `latin` / `latin-ext` 文件，只引 `latin` 即等价于原先的 `subsets: ['latin']`。
- 影响面：`apps/resume/package.json`、`pnpm-lock.yaml`、`apps/resume/app/layout.tsx`、删除 `apps/resume/scripts/font-mocks.js`、`apps/resume/public/CREDITS.md`、`apps/resume/e2e/staticExport.spec.ts`、`docs/specs/resume-site.md`、`apps/resume/AGENTS.md`（字体一节）。**生效需要一次完整部署**（`deploy-prod.sh` 重新构建 resume）——字体是构建时烙进产物的，重建 nginx 容器无效。

## 与既有 ADR 的关系

- [20260903140619](./20260903140619-lab-external-assets-and-runtime-sketch.md)（外部素材记录许可）：**沿用**。四款字体进 `CREDITS.md`，许可全文随 npm 包装船。
- [20260822120803](./20260822120803-resume-ssg-no-runtime-backend.md)（resume 是静态导出）：**不变**。字体仍是构建期静态产物。
- 平台路线图计划 A（构建不依赖外网）：本 ADR 是它在字体这一项上的提前兑现——无论构建在 CVM 还是 GitHub runner，都不再需要 Google 可达。
