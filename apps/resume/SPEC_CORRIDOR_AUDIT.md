# Corridor Lab — 完整还原 Spec & 修复计划

## 走查结论（我们 vs itomdev）

### ✅ 已正确实现
1. CorridorDoor 墙壁主动旋转（双层 pivot group）
2. 门板铰链边缘旋转
3. 门底部对齐地板（DOOR_CENTER_Y=-0.65）
4. 门 hover 变彩色（sketch overlay fade out 露出 painted 层）
5. 走廊背景音 + 门音效 + 静音按钮
6. Avatar 居中 + 帧动画 + dodge
7. 猫眼睛跟随鼠标
8. Doodles 5 个浮动装饰物
9. CorridorWindow 朝向正确（-π/2 rotation）
10. 壁画 hover 浮起效果
11. BugEaster 彩蛋
12. SegmentDoor 过渡门（靠近自动开关）
13. HeroText "YIBIN" RubikScribble + 分裂动画
14. 双 loop 走廊（10 扇门，MIN_Z=-190）
15. 入口砖墙场景（树/猫/双开门/窗/盆栽）

### ❌ 缺失 / 有 bug 的细节

**P0 — 视觉 bug，用户必然注意到**

1. **入口页砖墙场景没有地板**
   - 当前：摄像机向下看到走廊地板（CorridorGeometry），与砖墙场景不匹配
   - itomdev：入口有独立的地板（floor_paper.webp，米白色纸纹）覆盖在走廊几何上方
   - 修复：BrickScene 加地板 mesh，rotation=[-π/2,0,0]，position=[0,FLOOR_Y+0.01,0]，size=20×20

2. **入口页使用 drzwiabout.webp（走廊门），itomdev 入口用专用彩色门贴图**
   - itomdev 入口：door_left_painted.webp + door_right_painted.webp（有彩色贴纸的门）
   - 我们：复用了走廊内 drzwiabout.webp（黑白素描单扇门样式）
   - 修复：改用 /textures/doors/door_left_painted.webp + door_right_painted.webp

3. **入口页门开启方向错误**
   - 当前：左门 rotation.y → +π*0.55，右门 → -π*0.55（向外推，不对）
   - itomdev：左门绕左铰链向左后方旋转，右门向右后方，效果是"向内拉开"
   - 修复：左门 y → -π*0.55（向内），右门 y → +π*0.55（向内）

4. **入口 EntryCamera 不使用 flying 状态（setFlying 调用了但 EntryCamera 收到后无效）**
   - 当前 BrickScene 调用 `() => { setFlying(true); onEnter() }` 但 EntryCamera 的 flying prop 检查正确
   - 实际问题：GSAP tween camera.position.z 直接操作了 useThree() camera，但 EntryCamera useFrame 同时也在操作 camera.position，两者竞争
   - 修复：flying=true 时 EntryCamera useFrame 直接 return，已经正确——但 gsap tween 里 camera 是 Three.js 对象，需要确认 useThree() 返回的是同一个对象✓（同一 Canvas 内是同一个）

5. **useCorridorCamera 的 DOOR_POSITIONS 只有 Loop1 的 5 扇门，没有 Loop2**
   - auto-glance 只会在前 5 扇门附近触发偏转，到了 Loop2 (-118 ~ -175) 没有 auto-glance
   - 修复：DOOR_POSITIONS 追加 Loop2 的对应位置（偏移 -100）

6. **CorridorDecorations 只有 Loop1 的装饰，Loop2 是空走廊**
   - 修复：CorridorDecorations 加 Loop2 段的壁画/植物/灯（z 各偏移 -100）

7. **入口页缺少 "YIBIN FENG" 标牌（sign.webp 已有但未用）**
   - itomdev 入口有 "PORTFOLIO" 木质标牌挂在门上方
   - 我们：sign.webp 已复制但没有渲染
   - 修复：BrickScene 加 sign.webp mesh，position=[0, 0.8, 0.2]

**P1 — 交互细节缺失**

8. **入口 CorridorWindow（EntranceDoors 里的窗户探头）没有对应到入口场景**
   - 入口 BrickScene 有 winTex 窗户，但没有 hover→人物探头的交互
   - itomdev：hover 窗户时 avatar_window.webp 从右侧滑入
   - 修复：BrickScene 的窗户 mesh 加 onPointerEnter/Leave，控制 avatarRef（avatar_window.webp）从右侧划入

9. **入口页缺 mouse_hanging.webp（树上悬挂的鼠标）**
   - itomdev 树上有鼠标图标随 sin 波摆动
   - 素材已有（public/textures/entrance/mouse_hanging.webp）
   - 修复：BrickScene 树 group 内加悬挂鼠标，sin 波摆动动画

10. **走廊 LOOP2 的 SegmentDoor 位置只有 -185，但 LOOP2 末尾应该在 -185（5 扇门最后在 -175）**
    - 已经基本正确，但 LOOP1 SegmentDoor z=-85 是合理的（LOOP1 门最后在 -75）✓

11. **CorridorWindow 放在 z=-30，进走廊早期就能看到，但 itomdev 的窗户在走廊中段**
    - 合理，不需要改

**P2 — 轻微**

12. **入口页没有 "The Lab" 标牌文字与砖墙场景融合**
    - 当前 "The Lab" 是 HTML overlay 在 R3F Canvas 上方
    - 可保留现状，不影响主要体验

13. **BugEaster 位置固定在 z=-70，只在 LOOP1**
    - Loop2 没有 bug 彩蛋（itomdev 每段都有）
    - 轻微，可保留

## 修复优先级和执行计划

### Batch 1（立即，P0 视觉 bug）
- Fix A: 入口 BrickScene 加地板（floor_paper.webp）
- Fix B: 入口门换彩色贴图（door_left_painted / door_right_painted）
- Fix C: 入口门开启方向修正（向内推开）
- Fix D: useCorridorCamera 的 DOOR_POSITIONS 加 Loop2
- Fix E: CorridorDecorations 加 Loop2 装饰

### Batch 2（P1 交互细节）
- Fix F: BrickScene 加 sign.webp 标牌
- Fix G: BrickScene 窗户 hover 探头交互（avatar_window）
- Fix H: BrickScene 树上加悬挂鼠标动画

