# docs/adr/

架构决策记录（Architecture Decision Record）。制度本身见 [ADR 20260822120805](./20260822120805-adopt-adr-with-forward-pointers.md)，格式与使用约定见 [`TEMPLATE.md`](./TEMPLATE.md)。

## 三条硬规则

1. **ADR 不可变。** 决策变了新写一份，不重写旧文件。
2. **修订旧 ADR 只改两个字段**：`- 状态：` 和 `- 索引：`（在索引末尾追加「注记：X 已被 `<新ID>` 修订…；其余不受影响」）。不加这个前向指针，一份被局部修订的 ADR 会被整体误判为过期或整体误用。
3. **下面的表是生成物。** 改完 ADR 头部字段后运行 `python3 scripts/docs/gen_docs_index.py`，不要手改表体。

## 什么该写 ADR

ADR 记录**有备选方案的选择**。写不出两个真实备选的，不是决策而是事实——写进 `docs/architecture/` 或对应目录的 `AGENTS.md`。

## 索引

<!-- BEGIN:adr-index (生成物，勿手改；见 scripts/docs/gen_docs_index.py) -->

共 19 份。按 ID（创建时间）升序。

| ID | 结论 | 状态 | 索引 |
|----|------|------|------|
| [`20260822120801`](./20260822120801-monorepo-carries-three-sites.md) | Monorepo 承载三站：部署耦合决定仓库边界 | 已接受 | 三站（portal / resume / auto-wechat）同仓，理由是共用一台 CVM、一份 nginx、一条 compose，部署耦合度高于代码耦合度；代价是 CI 需 path-based 过滤（尚未落地，见 20260822120807） |
| [`20260822120802`](./20260822120802-portal-uses-libsql-not-shared-mysql.md) | Portal 用 libSQL 单文件库，不复用 auto-wechat 的 MySQL | 已接受 | portal 的持久层是 libSQL（SQLite 兼容）单文件 + Drizzle ORM，**不是** MySQL；纠正 `docs/ARCHITECTURE.md` 两处「MySQL（shared）」「Portal & Auto-Wechat share MySQL」的错误陈述 |
| [`20260822120803`](./20260822120803-resume-ssg-no-runtime-backend.md) | Resume 用 Next.js SSG 静态导出，不保留运行时后端 | 已接受 | resume 站 `output: export` 纯静态、由 nginx 直接提供，无 Node 运行时；代价是任何动态需求都必须外置成独立接口，不能在 resume 内加 API route |
| [`20260822120804`](./20260822120804-single-cvm-compose-not-k8s.md) | 单台 CVM + Docker Compose 编排，不上 K8s | 已接受 | 生产是一台腾讯云 CVM 上的 docker compose，不引入 K8s / 托管容器服务；判定原则是「没有需要弹性的负载轴就不引入编排平台」 |
| [`20260822120805`](./20260822120805-adopt-adr-with-forward-pointers.md) | 引入 ADR 制度：不可变 + 前向指针 + 生成式索引 | 已接受 | 决策记录用时间戳 ID 的不可变 ADR；被后续修订时只改旧 ADR 的 `状态：`/`索引：` 两个字段追加前向指针；索引表由脚本生成不手改 |
| [`20260822120806`](./20260822120806-layered-agents-md-context.md) | AGENTS.md 分层上下文：就近加载，且必须标注「现状 ≠ 目标」 | 已接受 | 每个有约定的目录放一份 AGENTS.md，操作该目录前先读；根目录不放 AGENTS.md 以 CLAUDE.md 为准；临时实现必须显式标注不可作为目标架构反推依据 |
| [`20260822120807`](./20260822120807-ci-quality-gate-and-manual-prod-promote.md) | CI 质量门禁前置，生产发布改为人工 promote | 已接受 | 新增 `ci.yml` 在 PR 与 push 上跑 lint + test（path-based 过滤）；`deploy.yml` 去掉 `push: main` 自动触发，改为仅 `workflow_dispatch` 人工触发；部署与发布解耦 |
| [`20260822120808`](./20260822120808-portal-types-derived-from-schema.md) | Portal 接口类型从 Drizzle schema 派生，不手写 | 已接受 | portal 的 `Profile` / `Project` 类型由 `schema.ts` 经 Drizzle `$inferSelect` 派生并置于共享位置，前后端同源；不引入 OpenAPI codegen（规模不匹配）。注记：本文初稿称「enum 约束落在数据库侧」，**该说法已被本文「勘误」一节推翻**——SQLite 的 `text({enum})` 只是类型层约束，真正的库侧约束由后补的 CHECK 提供 |
| [`20260822120809`](./20260822120809-preooluse-hooks-as-mechanical-gates.md) | 用 PreToolUse hooks 做机制门禁，且必须 fail-closed | 已接受 | AI 红线用 `.claude/hooks/` 的 PreToolUse 脚本机制拦截而非文档请求；拦截须 `exit 2`，守卫自身异常必须映射为拦截；每条 hook 明确声明覆盖边界，不制造虚假安全感 |
| [`20260822132001`](./20260822132001-signed-session-cookie.md) | 会话改用 HMAC 签名 cookie，修复认证绕过 | 已接受 | portal 的 `portal_session` cookie 原为固定明文 `authenticated`，任何人手设该 cookie 即获完整管理员权限；改为 Hono 签名 cookie（值为签发时间戳）+ 服务端独立判过期 + secret 缺失时 fail-closed |
| [`20260903140615`](./20260903140615-lab-room-registry-and-derived-assets.md) | Lab 房间改为数据驱动注册表，预载表由注册表派生而非手写 | 已接受 | resume 的 Lab 五个房间由 `lib/lab/domain/rooms/` 的 `RoomDefinition` 注册表声明（门位、entryPose、雾、环境音、资产、教程、视图），编排代码只消费声明；纹理预载表改为从注册表 + 走廊布局**派生**的生成物，禁止手写，与 ADR 20260822120808 的类型派生同一纪律。注记：注册表已定义，但**渲染 / 教程 / 预载三条消费路径尚未接线**（运行时仍是 `RoomInterior` 的 `switch` 与手写预载表 `roomAssets.ts` / `texturePreload.ts`），因此本文「A1/A3 由 entryPose 修复」「Gallery 特例消失」「预载表由派生生成物提供」三处描述的是**目标而非现状**；接线计划见 `20260903211338`。门坐标单一来源与 `pre-generated-edit` 保护名单亦未兑现，同上。 |
| [`20260903140616`](./20260903140616-lab-xstate-and-zustand-replace-context.md) | Lab 生命周期改用 XState 状态图，共享状态改用 zustand，替换手写 reducer 与 Context | 已接受 | resume 的 Lab 用 XState v5 表达走廊/房间/停靠三条生命周期（失败边与超时是状态图的一等公民，`@xstate/graph` 生成全路径测试），共享状态从 35 字段的 `SceneContext` 迁到 zustand（selector 订阅 + persist 中间件）；替换 `doorEntryFlow` / `roomLoadMachine` / `publicationMotionMachine` 三套手写 reducer。注记（2026-09-04，ADR 20260903211338 接线后）：`room.machine` **已接线**——`SceneContext` 用 `useMachine(roomMachine)`，手写的 `roomLoadMachine.ts` / `doorEntryFlow.ts` 已删，8 秒超时是 `loading` 的一行 `after`，审计 A8 的 `entered → failed` 边现在运行时真的存在；`@xstate/graph` 的全路径测试已兑现（`__tests__/roomMachineFlow.test.ts`）。**`corridor.machine` 仍零引用**：走廊传送与其失败取消仍是 `SceneContext` 里的手写 state + `cancelTeleport`，因此本文关于审计 B1 的修复描述仍未在运行时生效。`dockMachine` 只有 Projects 使用，Publications 仍用 `publicationMotionMachine`。zustand 部分（音频 store）已落地。 |
| [`20260903140617`](./20260903140617-lab-single-camera-owner.md) | Lab 相机收归单一导演，底层换成 camera-controls；手势统一用 @use-gesture | 已接受 | resume 的 Lab 只允许 `lib/lab/app/camera/CameraDirector` 写 `camera.position/rotation/lookAt`，底层委托 `camera-controls`（drei `<CameraControls>`）；房间内相机自由度由 `RoomDefinition.cameraFreedom` 声明；四套手写 wheel/pointer/touch 处理统一换成 `@use-gesture/react`。注记：所有权的**形态**已被 `20260903211244` 修订——`suspended` 布尔改为显式 `claim()` / `release()`，进房飞行由导演持有、走廊传送不再经由导演；原形态导致三条已核实缺陷（进房双写相机、传送不瞬移、About 探身失效）。「只有 CameraDirector 能写相机」这条**结论不变**。`@use-gesture` 迁移未做（未安装，装了不用等于空依赖）。 |
| [`20260903140618`](./20260903140618-lab-audio-howler-mixer.md) | Lab 音频统一为 Howler 混音器；保留 3D 定位，但替换 drei 的 PositionalAudio 包装 | 已接受 | resume 的 Lab 音频收归 `lib/lab/app/audio/AudioMixer`（底层 howler.js + spatial 插件，三条总线 music/sfx/ambience），格式数组解决 Safari 不支持 OGG，自动解锁重试解决自动播放拦截；房间环境音保留距离衰减但不再阻塞房间 READY，全局静音对其生效；替换 `context/AudioContext.tsx`、drei `<PositionalAudio>` 与成就的裸 `AudioContext` |
| [`20260903140619`](./20260903140619-lab-external-assets-and-runtime-sketch.md) | Lab 引入外部创意素材，风格统一为手绘线稿；程序化草图用 Rough.js 运行时生成 | 已接受 | resume 的 Lab 首次引入外部创意素材，限定为手绘线稿类并记录许可（Rough.js MIT、Excalidraw MIT、Khushmeen Doodle Icons 免费商用、Open Doodles CC0、Google Fonts OFL、freesound CC0）；重复性草图元素（白板高亮、便签、机柜、刻度盘）用 Rough.js 运行时生成 `CanvasTexture` 而非预制位图；Projects 房间据此重做为「深夜实验室」。注记：许可记录的落点 `apps/resume/public/CREDITS.md` 在本文写下时并未创建，已于 `20260903211338` 那批补齐；中文门牌的字形问题（`CabinSketch` 无汉字字形，troika 缺字时默认回退到 jsDelivr 拉 Noto，大陆访客看到空白门牌）由 `20260903211244` 那批修正为使用仓库内的 `ZCOOLKuaiLe` 并禁用外网回退。 |
| [`20260903211244`](./20260903211244-lab-camera-owner-is-explicit-not-suspended-flag.md) | 相机所有权改为显式持有者，取代「挂起布尔」；走廊传送不再经由导演 | 已接受 | 修订 ADR 20260903140617 的所有权形态——`CameraDirector.suspended` 布尔改为显式 `claim(root, pose, freedom)` / `release()`，进房飞行由导演持有（删掉 `DoorSection` 直接写相机的 gsap tween），走廊传送改写走廊导轨的 z 而不再调用导演；`CameraRig` 在开发态每帧断言「本帧只有持有者写过相机」，让所有权违规在首次实机运行就炸而不是靠肉眼看截图 |
| [`20260903211302`](./20260903211302-lab-tutorial-popups-carry-scope.md) | 教程气泡带作用域，离开作用域即消失；成就解锁的判定基线在存储恢复之后建立 | 已接受 | resume 的 Lab 教程气泡从「只能由队首 DISMISS 关掉」改为**声明作用域**（`corridor` / `room:<id>`），离开作用域时按作用域批量出队；`corridor_explore` 的解锁点从 `wheel`/`touchmove` 事件移到走廊导轨位移（键盘用户此前永远拿不到）；解锁音的比较基线改在存储 HYDRATE 之后建立，修掉回访用户每次进 Lab 都响一声的问题 |
| [`20260903211320`](./20260903211320-source-gates-use-ts-ast-not-regex.md) | 源码门禁改用 TypeScript AST 扫描，不用正则；产物指纹同时覆盖输出 | 已接受 | resume 的三条源码门禁（相机所有权、Lab 漏译、覆盖层对比度）从「grep + 手写字符串剥离器」改为共用一个基于 `typescript` 编译器 API 的扫描器（`__tests__/helpers/sourceScan.ts`）；变异测试证明正则版对 20 个变异漏掉 10 个，其中包括仓库自己白名单里登记过的写法；素材指纹从「只算输入」改为「输入 + 输出」，让手改派生产物也能被 `--check` 抓到 |
| [`20260903211338`](./20260903211338-finish-wiring-lab-registry-and-machines.md) | 已定义未接线的三条路径：接线，不删除；接线完成前文档一律标「未接线」 | 已接受 | ADR 20260903140615 的房间注册表（渲染 / 教程 / 预载三条消费路径）与 20260903140616 的 `room`/`corridor` 状态图，实现后**从未接入运行时**——运行时仍是 `RoomInterior` 的 `switch`、手写预载表与旧的 `doorEntryFlow`/`roomLoadMachine` 三件套，而两份 ADR 与 `AGENTS.md` 把它们描述为「已落地 / 已用」；本 ADR 决定补完接线（而非删除新代码回退），并立一条规则：未接线的实现在文档里一律标「已定义、未接线」，测试覆盖它不算落地 |

<!-- END:adr-index -->
