# 20260903211302. 教程气泡带作用域，离开作用域即消失；成就解锁的判定基线在存储恢复之后建立

- 状态：已接受
- 索引：resume 的 Lab 教程气泡从「只能由队首 DISMISS 关掉」改为**声明作用域**（`corridor` / `room:<id>`），离开作用域时按作用域批量出队；`corridor_explore` 的解锁点从 `wheel`/`touchmove` 事件移到走廊导轨位移（键盘用户此前永远拿不到）；解锁音的比较基线改在存储 HYDRATE 之后建立，修掉回访用户每次进 Lab 都响一声的问题
- 日期：2026-09-03

## 背景

ADR 20260903140616 把成就弹窗改成纯 reducer 队列，规则本身是对的（庆祝 2s、`UNLOCK` 插队、教程不自动消失），reducer 有完整单测。但独立 review 查出**队列的策略正确而生命周期没有归属**，三条已核实的缺陷：

1. **教程气泡退房后残留，并堵死后续所有教程。** 教程永不自动消失，而全仓只有 `PublicationsRoom` 在退场时调 `hidePopup()`。复现：进 About 不滚动 → 2 秒后出现「Sky Walker」教程 → 退回走廊 → 气泡一直挂着；再进 Projects，它的教程排在队列第二位，**永远显示不出来**。审计 A7 记录过这条并标为已修，实际只修了一间房。
2. **键盘用户拿不到 `corridor_explore` 成就，且被自己的教程气泡永久遮挡。** 解锁只挂在 `wheel` / `touchmove` 上，方向键 / PgUp / 空格前进不触发。于是「Scroll or swipe to explore」这条教程气泡永远关不掉（关它的唯一途径是滚轮），而它与底部操作提示**位置完全重叠**（两者都是 `bottom: 32px; left: 50%`），气泡的白底盖住提示——E10 花力气修好对比度的那条提示，实际一直被挡着。
3. **回访用户每次进 Lab 都听到一声解锁音。** 判定用 `lastCompletedCount` ref 比较前后长度，初始值 `-1` 表示「首帧不响」；但存储恢复是异步 `HYDRATE`，它在 ref 已被置为 0 之后才到达，于是 `length: 0 → N` 被判为「新解锁 N 条」。代码注释写着「首次（含从存储恢复）不响」，与实际行为相反。`AchievementsContext` 这一层**零测试**（其余测试全部 mock 掉 `useAchievements`），所以 reducer 再正确也保不住 React 侧接线。

不决策会发生什么：队列的所有权在调用方手里，而调用方是四个互不知情的房间组件加一个走廊。每加一个房间就多一处「记得在卸载时关掉自己的气泡」的口头约定，漏掉不报错——表现为下一个访客的教程系统整体失效，而且没有任何症状指向队列。

## 选项

- **A. 每个房间在卸载时自己 `dismiss` 自己的教程。** 优点：改动最小，不动 reducer。缺点：把已经漏了三次的约定再重复四遍；`queue` 的 `DISMISS` 只能关队首，按 id 关需要先扩 action，扩了以后仍然依赖每个调用方记得调。
- **B. 气泡声明作用域，出队由作用域驱动。** `showTutorial(id, { scope })`，`scope` 取 `corridor` 或 `room:<RoomId>`；场景切换（进房 / 退房 / 传送）时 dispatch `DISMISS_SCOPE`，把不属于当前作用域的教程整批出队。优点：生命周期归属从调用方转移到状态本身，加房间不需要记住任何事；「进房时清掉走廊教程」这类跨作用域规则一处表达。缺点：`showTutorial` 多一个必填参数，所有调用点要改；作用域的取值与 `RoomId` 耦合。
- **C. 教程也自动消失（给它一个长时限，比如 15 秒）。** 优点：不需要作用域概念，`DURATIONS.tutorial` 那个当前是死配置的字段终于生效。缺点：教程的用途是「告诉用户此刻能做什么」，在用户照做之前消失就失去意义；而且不解决遮挡问题，只是把「永久遮挡」变成「遮挡 15 秒」。可以叠加在 B 之上作为兜底，但不能替代 B。

## 决策

选 **B**，并把 C 作为拒绝项记录：教程不设自动时限，`DURATIONS.tutorial` 这个从未生效的字段删除（留着它会让下一个人以为教程会自动消失）。

**判定原则：一个对象的生命周期归属，要么由它自己的状态声明，要么由持有它的作用域声明；不能由「每个创建者记得销毁」的约定承担。** 这与前一份 ADR（相机所有权改显式持有者）是同一条规则在 UI 状态侧的应用——凡是「漏了不报错、症状远离原因」的约定，都要换成能被结构保证的形态。

配套的三条修正（各自不构成决策，形态唯一，记录在此以便追溯）：

- `corridor_explore` 的解锁点下移到 domain：走廊导轨位移超过阈值即解锁，滚轮 / 触摸 / 键盘统一走同一条路径。
- 教程气泡与底部操作提示错开（气泡上移），两者不再重叠。
- 解锁音的比较基线在 `hydrated` 首次为真时建立，而非首帧；`AchievementsContext` 补组件测试，覆盖「回访用户挂载后不响」。
- `UNLOCK` 插队时若队首正处于淡出（`hiding`）则直接丢弃它，避免它在庆祝播完后以淡出状态重新出现（review 查出的「幽灵气泡」）。

## 影响

- 正面：教程系统的失效模式从「静默整体失效」变成不可能；键盘用户的成就与提示可达；回访体验不再有莫名的解锁音；`AchievementsContext` 从零覆盖变为有测试。
- 负面：`showTutorial` 的签名变化波及所有调用点；作用域取值与 `RoomId` 耦合，将来出现「跨房间持续显示」的教程需要扩作用域枚举。
- 影响面：`apps/resume/lib/lab/domain/achievements/queue.ts`、`context/AchievementsContext.tsx`、`hooks/useRoomTutorial.ts`、`components/lab/{LabScene,NavigationUI,LabTutorial}.tsx`、`hooks/useCorridorCamera.ts`、`app/globals.css`、`__tests__/achievementQueue.test.ts` 及新增的 `__tests__/achievementsContext.test.tsx`。
