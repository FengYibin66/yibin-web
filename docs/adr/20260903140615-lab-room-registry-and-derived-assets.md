# 20260903140615. Lab 房间改为数据驱动注册表，预载表由注册表派生而非手写

- 状态：提议
- 索引：resume 的 Lab 五个房间由 `lib/lab/domain/rooms/` 的 `RoomDefinition` 注册表声明（门位、entryPose、雾、环境音、资产、教程、视图），编排代码只消费声明；纹理预载表改为从注册表 + 走廊布局**派生**的生成物，禁止手写，与 ADR 20260822120808 的类型派生同一纪律
- 日期：2026-09-03

## 背景

`docs/reviews/2026-09-02-resume-lab-full-audit.md` 记录的 63 条问题里，有一整类的共同根因是**「用到什么」和「声明了什么」是两份人手维护的清单**：

- `lib/lab/roomAssets.ts` 与 `lib/lab/texturePreload.ts` 为已删除的死代码（`CorridorWindow`、`InspectableFrame`）预载纹理，同时 `ROOM_ASSETS.contact` 漏收云纹理——于是 Contact 房间的天空是四个没贴图的灰矩形（审计 A2）。
- `SOUND_PATHS.paper_tear` 指向不存在的 `/sounds/paper_tear.mp3`（真实文件叫 `papersound.mp3`），`achievement` 同样不存在——每次传送两次 404，纸撕声从未响过（审计 B2）。
- 门的 Z 坐标在 `CorridorSegment`、`useCorridorCamera`、`TeleportRoom` 三处各写一份，`DoorSection` 里还有一个裸 `/ 100`（审计 B3）。
- 房间之间的差异（谁动相机、动到哪、有没有雾、环境音怎么放）散落在各房间组件里：`PublicationsRoom` 有专门的 `usePublicationBrowseCamera` 因此取景正确，`ProjectsRoom` 用**世界坐标** tween 因此塔偏在画面右侧且被雾洗白，`AboutRoom` 与 `ContactRoom` 干脆没有房间级相机（审计 A1/A3/A4）。

不决策会发生什么：每加一个房间、每换一张纹理，都要人手同步 3–5 处清单，而漏掉任何一处都不会报错——只会在某个访客的屏幕上表现为「一片米色虚空」或一次静默 404。审计里这类问题占 63 条中的 19 条，且**全部无法被现有测试发现**。

## 选项

- **A. 保持现状，逐条修。** 优点：改动最小、无学习成本、不引入抽象。缺点：只修症状；下一个房间、下一张纹理会以完全相同的方式再犯。审计里「已修」的 P1-1（ProjectsRoom 抢相机）正是这个模式的既有证据——修了一个症状，同一根因又产生了 A1/A3/A4 三条。
- **B. 声明式注册表 + 派生预载表。** 每个房间一个文件声明其全部差异；走廊布局集中为一份常量；预载表由脚本从注册表派生，加入 `pre-generated-edit` 保护名单；测试断言「派生表 ⊇ 组件内 `useTexture` 字面量集合」。优点：加房间 = 加一个文件；漏声明在测试期报错而非线上表现为白屏；相机/雾/音频的房间差异变成可截图验收的数据。缺点：引入一层间接；`RoomDefinition` 的字段集需要一次设计，早期可能改几轮。
- **C. 更进一步，把房间做成外部配置（JSON / CMS）。** 优点：非代码改动即可调房间。缺点：本站是单人开发的静态站，没有非开发者编辑的场景；JSON 失去类型检查，而类型检查正是本 ADR 要的核心收益。规模不匹配。

## 决策

选 **B**。

**判定原则：同一事实在两处以上人手维护时，选一处为唯一来源，其余改为派生，并用测试锁定派生关系。** 这与 ADR 20260822120808（portal 接口类型从 schema 派生）是同一条规则在前端资源侧的应用；那份 ADR 的理由「不手写可派生的代码」在此完全适用。

具体形态：

- `lib/lab/domain/rooms/{about,projects,publications,contact,gallery}.ts` 各导出一个 `RoomDefinition`，`index.ts` 汇总为 `ROOMS: Record<RoomId, RoomDefinition>`。
- `lib/lab/domain/corridor/layout.ts` 为门位、装饰锚点、段长的唯一来源。
- `lib/lab/domain/audio/manifest.ts` 为音频的唯一来源，每条含**格式数组**（顺带解决 Safari 不支持 OGG 的审计 C1）。
- `lib/lab/app/assets/manifest.ts` 是**生成物**，由 `scripts/lab/gen-asset-manifest.mjs` 从上述声明派生，`--check` 模式供 CI，文件加入 `.claude/hooks/pre-generated-edit.sh` 保护名单。
- Gallery 不再是编排代码里的 `if (roomId === 'gallery')` 特例：它的 `RoomDefinition.view` 是一个执行 `router.push` 的组件，`entryPose` 仍然生效（相机照常对齐门），特例分支消失。

## 影响

- 正面：审计 A1/A2/A3/A4/B2/B3/C1 与 H2/H3（为死代码预载）在结构上不再可能发生；房间取景成为数据，可用 Playwright 截图基线验收；新增房间的成本从「改 5 处」降到「加 1 个文件」。
- 负面：多一层间接，读代码时要先看声明再看组件；`RoomDefinition` 字段集是新设计，前几轮可能需要调整；新增一个生成物与一条 CI 校验。
- 影响面：新增 `apps/resume/lib/lab/domain/**`、`apps/resume/lib/lab/app/assets/manifest.ts`、`apps/resume/scripts/lab/`；改动 `components/lab/{CorridorSegment,DoorSection,TeleportRoom}.tsx`、`components/rooms/**`、`hooks/useCorridorCamera.ts`；删除 `lib/lab/roomAssets.ts` 与 `lib/lab/texturePreload.ts` 的手写清单部分；`.claude/hooks/pre-generated-edit.sh` 增一条保护；`apps/resume/AGENTS.md` 增「声明层」一节。
