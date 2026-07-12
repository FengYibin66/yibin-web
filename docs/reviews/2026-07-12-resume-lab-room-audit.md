# Resume Lab / Publications 综合验收与全房间走查

## 1. 审查范围与结论

- 审查日期：2026-07-12
- 分支：`feat/publication-carousel-math`
- 审查基线：`5294eb0a0f31912c434aca08bc8bddb5dce08b35`
- 自动化结论：type-check、全量测试、production build 最终均为 exit 0。
- 手工结论：当前执行环境未提供真实浏览器、DevTools 网络节流与触屏设备，因此桌面、Slow 3G、Offline 和触屏验收均未执行，不能据此判定视觉与交互通过。
- 发布判断：自动化门禁通过；建议在发布前补齐 P1 项及真实浏览器手工验收。

## 2. 分级说明

- **P0**：阻断发布、导致数据/安全事故或核心流程普遍不可用。
- **P1**：用户可感知的功能、性能或可靠性问题，建议发布前处理。
- **P2**：可维护性、局部一致性或低影响体验问题，可排期收敛。

## 3. Findings

### P0

本次静态走查与自动化验证未发现 P0。

### P1-1 Projects 房间相机动画存在竞争

**证据**

- `apps/resume/components/lab/DoorSection.tsx` 统一编排对齐门、开门、飞入房间与退出时的 `camera.position` 动画。
- `apps/resume/components/rooms/ProjectsRoom.tsx:108-111` 在 `showRoom` 变为 true 后，另行对同一 `camera.position` 启动 0.8 秒 GSAP tween，将相机移至 `x: 3, y: CAMERA_Y_OFFSET`。
- Projects tween 未持有 DoorSection 的动画所有权，也未在 cleanup 中 kill；两个模块可在房间挂载/开门/飞入阶段同时写入相机位置。

**影响**

进入 Projects 时可能出现轨迹偏移、跳位或退出基准不一致；具体复现率依赖资源完成时序和设备性能。

**建议**

由 DoorSection/统一 room transition controller 独占相机位置写入。Projects 只提供目标 pose，或等待全局状态进入 `entered` 后通过可取消、可恢复的单一 timeline 执行；同时为退出、传送和卸载增加明确 cleanup。

### P1-2 About / Projects 纹理加载呈组件级瀑布风险

**证据**

- About 的纹理请求分散在 `IntroMilestone`、`JourneyMilestone` 等子组件内部，例如 `AboutRoom.tsx:35-44` 和 `97-109`；子组件各自通过 `useLoader` suspend。
- Projects 的每个 `MonitorBlock` 都无条件声明 monitor、TV、phone 三类共 26 个纹理 loader，见 `ProjectsRoom.tsx:259-301`，即使该卡片只使用其中一种 platform。
- 当前 `RoomReadyBoundary` 能统一展示 loading/error，但不能消除首次渲染按子树发现资源、以及无关平台资源被强制加入关键路径的问题。

**影响**

冷缓存或弱网下，房间 ready 时间、GPU/内存峰值和重试成本被放大；About 子树还存在后续 suspend 批次形成 waterfall 的风险。

**建议**

为每个房间建立单一 manifest，并在门接近时批量 preload；组件从共享 texture bundle 取资源。Projects 按 platform 选择必要纹理，或一次加载去重后的数组，避免每张卡声明全部平台资产。完成后用 Slow 3G waterfall 和 texture 数量/体积做验收。

### P1-3 Gallery 路由缺少可见 loading

**证据**

- `apps/resume/app/gallery/page.tsx` 直接渲染 `GalleryClient`，路由目录没有 `loading.tsx`。
- `GalleryClient` 的动态 import 设置 `ssr: false`，但未提供 `loading` UI。
- Lab 的 Gallery 门在相机对齐后直接 `router.push('/gallery?from=lab')`；该路径绕过普通房间的 `RoomReadyBoundary` 与 room load machine。
- `GalleryRoomPortal` 的动态加载 fallback 同样是 `null`。

**影响**

首次加载 Gallery chunk 或图片时可能短暂空白，Offline/资源失败也没有与其他房间一致的错误和 Retry 反馈。

**建议**

增加 `app/gallery/loading.tsx` 和动态组件可见 fallback；为路由导航定义 route-ready/error/retry 契约。若 Gallery 继续采用独立路由，明确把路由状态适配到统一加载 UI，而不是复用 R3F 房间挂载状态。

### P1-4 Contact 存在空交互

**证据**

- `apps/resume/components/rooms/ContactRoom.tsx:147-153` 的 `MESSAGE` SocialBarrel 带有可点击视觉与标签，但 `onClick={() => {}}` 不执行任何动作。
- 同一场景已有 `MessagePaper` 的发送入口，因此空桶既不打开表单，也不给出引导或禁用反馈。

**影响**

用户点击明确的交互控件后无响应，容易被判断为页面故障；触屏设备没有 hover 线索，问题更明显。

**建议**

让 MESSAGE 桶聚焦/展开 `MessagePaper`，或删除其交互样式并改为说明性元素；增加点击/键盘测试和触屏手工验收。

### P2-1 Gallery 遗留 R3F 房间为死代码

**证据**

- `apps/resume/components/rooms/GalleryRoom.tsx` 实现了另一套 R3F Gallery。
- `RoomInterior.tsx:37-39` 对 `gallery` 明确返回 null，实际 Gallery 使用 `components/gallery/GalleryTrack.tsx`。
- 全仓 import 搜索未发现对 `components/rooms/GalleryRoom` 的引用。

**影响**

两套同名实现容易误导维护者，也会让 Gallery 的交互、文案和 bugfix 发生分叉。

**建议**

确认无回滚依赖后删除 R3F 遗留实现；若需保留实验版本，移动到明确的 prototype 区并从生产源码排除。

### P2-2 DoorSection / SceneContext 仍有双轨状态

**证据**

- SceneContext 已维护 `currentRoom`、`exitRequested`、teleport 状态和 `roomLoadState`。
- 每个 DoorSection 仍维护 `isInsideRoom`、`isAnimating`、`showRoom` 及多个 ref，并在进入、失败、退出、传送路径中手动同步全局状态。
- 例如进入完成同时调用 `enterRoom(roomId)` 与 `setIsInsideRoom(true)`；退出完成再分别 `setShowRoom(false)`、`contextExitRoom()`、`resetRoomLoad()`。

**影响**

当前测试已覆盖主要竞态，但新增路径仍可能出现全局 phase 已变化、局部门状态未同步的组合，增加恢复逻辑和测试矩阵复杂度。

**建议**

后续以 `roomLoadState + currentRoom` 为唯一业务状态源，将 DoorSection 本地状态缩减为纯动画句柄/瞬时 ref；用 reducer command/effect adapter 驱动 mount、camera、door timeline。迁移时先定义状态映射和 invariant，再逐步删除 `isInsideRoom/showRoom`，不要一次性大改。

### P2-3 Publications 卡片固定英文 UI

`publicationCardViewModel.ts` 仍硬编码 `ABSTRACT` 与 `VIEW PAPER`。中文 locale 下正文会本地化，但两个 UI 标签保持英文。该项不影响 Task 10 自动验收，本次为避免扩大生产代码范围未修改；建议后续将 label 纳入 content adapter 并补中英文测试。

## 4. 本分支已完成项摘要

- 建立确定性的房间加载状态机，覆盖对齐、加载、开门、进入、失败、超时、Retry、退出和传送复位。
- SceneContext 暴露统一加载状态；RoomReadyBoundary、恢复 UI、纹理 preload/reload 和门进入编排已接入，并修复退出/传送竞态。
- Publications 数据按稳定 DOI 适配，carousel 数学支持无限循环、输入归一化和数值精度保护。
- Publications 卡片完成悬挂、居中、翻面、关闭、取消恢复及 hover paint；DOI 使用 `noopener,noreferrer` 打开。
- Publications 场景、飞鸟/城市氛围、paint reveal、教程、传送/退出锁定及旧房间清理已完成。
- 自动化覆盖 27 个测试文件、430 项测试，并完成 production static export。

## 5. 自动化验收

- `pnpm --filter @yibin/resume type-check`：通过，exit 0；`tsc --noEmit` 无输出错误。
- `pnpm --filter @yibin/resume test`：通过，exit 0；27/27 files、430/430 tests。
- `pnpm --filter @yibin/resume build`：通过，exit 0；Next.js 15.5.20 编译成功，8/8 静态页面、2/2 export。

构建期间仍报告既有 ESLint ESM 导入 warning：`eslint-config-next/core-web-vitals` 缺少 `.js` 后缀。该警告没有使 build 失败，但意味着 build 内嵌 lint 实际未完成，不能表述为 lint 已通过。

测试在受限沙箱内首次启动时因 `getaddrinfo ENOTFOUND localhost` 退出 1，Vitest 未进入用例执行；放宽沙箱权限后原命令重跑并以 430/430、exit 0 完成。最终门禁以成功重跑结果为准。

## 6. 手工验收状态

### Publications 桌面

- 滚轮无限循环、卡片不跳位：**未执行**
- hover paint reveal：**未执行**
- 点击自动居中并完整翻面：**未执行**
- A → B 严格先关闭 A：**未执行**
- VIEW PAPER 安全打开 DOI：**未执行**（仅有自动化/静态代码证据）

### Publications 手机/触屏

- 横拖循环、纵拖不抢：**未执行**
- 点击展开、内容可读且无反向/穿模：**未执行**
- 展开期间拖动不改变 carousel：**未执行**

### 房间加载与导航

- Slow 3G：**未执行**
- Offline：**未执行**
- Retry：**未执行**
- Back：**未执行**
- 地图传送：**未执行**
- 退出后重入：**未执行**

未执行原因：当前执行环境没有可用的真实浏览器/DevTools Slow 3G 与 Offline 控制，也没有触屏设备。上述项目必须在目标浏览器和设备上补验，不能由单元测试或 production build 替代。
