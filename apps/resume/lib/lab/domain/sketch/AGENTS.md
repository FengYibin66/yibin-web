# lib/lab/domain/sketch/

手写层的**声明**与**纯函数**。运行时用 Rough.js 生成手绘 `CanvasTexture`
（ADR 20260903140619）。

## 分层

```
SketchSpec（types.ts）    声明：一张便签、一块白板、一个机柜、一张架构图
     │  planSketch()      纯函数，无 canvas / DOM / roughjs
     ▼
SketchOp[]                图元序列：矩形、线、多边形、曲线、文字
     │  infra/sketch      roughjs 执行 → CanvasTexture（按 specKey 缓存）
     ▼
THREE.CanvasTexture
```

**这个目录里不能出现 canvas、DOM、three、roughjs。** 中间那层图元序列因此
可以完整单测：不需要 canvas 就能断言「一张便签画了折角 + N 行文字」。
`__tests__/sketchPlan.test.ts` 覆盖每种 spec 的图元构成、坐标边界、种子确定性。

## 加一种 spec

1. 在 `types.ts` 加接口，并入 `SketchSpec` 联合
2. 在 `plan.ts` 写 `planXxx(spec): SketchOp[]`，并在 `planSketch` 的 switch 里派发
   （switch 是穷尽的，漏一个 case TypeScript 会报错）
3. 在 `__tests__/sketchPlan.test.ts` 加断言，并把它加进「全类型不变量」那组的
   `all` 数组

## 三条必须遵守的

**种子必须从 spec 身份派生。** roughjs 不给 `seed` 就每次调用抖动都不同，
同一个 spec 重新栅格化会得到肉眼可见的不同结果——而纹理是按 `specKey` 缓存的，
那就等于缓存键和实际图像不是一回事。用 `seedFrom(specKey(spec))`。

**同一个 spec 内不同图元的种子偏移要错开。** 白板网格曾经竖线用 `seed + x`、
横线用 `seed + y`，方形画布上 x 与 y 取值相同 → 成对的横竖线共用种子、抖动
一模一样，看起来是印刷的网格纸而不是手画的。

**文字要按可用宽度反解字号。** `ctx.fillText` 不折行、不报错，超出就画到纸面
外去。`planSticky` 用平均字宽 0.52em 估算并取上限——实机上 "WeChat AI
Automation" 就是这么被截断的。

## 坐标

- 便签 / 白板 / 机柜 / 刻度盘 / 胶带：**像素**（`spec.size` 内）
- 电缆的 `from`/`to`、架构图的节点：**归一化 0..1**，这样同一份声明能贴到
  任何尺寸的面板上

面板的世界宽高比必须等于 `spec.size` 的宽高比，否则手绘线条被拉扁
（`__tests__/projectsScene.test.ts` 守这条）。
