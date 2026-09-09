/**
 * 引路小狗的纸偶部件声明（ADR 20260908160918，规格 lab-companions.md §6）。
 *
 * 写成 .mjs 而不是 .ts：切层脚本（`scripts/media/companion-parts.mjs`，Node 直跑）
 * 与渲染组件要**读同一份声明**——改一处两边同步。先例是 `galleryDoorPlan.mjs`。
 *
 * 坐标全部是画布归一化 0..1（SVG 画布 1024 见方，产物 512 见方，比例不变）。
 * `pivot` 是部件的转轴：腿在髋 / 肩，尾在尾根，头在颈。渲染时部件平面绕这个点转。
 * 切层脚本会校验每个部件的实际笔迹包围盒确实包住了声明的枢轴（容差 8%）——
 * 声明与画稿对不上时在构建期报错，不等到实机上腿绕着空气转。
 */

/** 侧面站姿的五个部件；键就是 SVG 里 `<g id>` 的值 */
export const DOG_SIDE_PARTS = /** @type {const} */ ({
  body: { pivot: [0.53, 0.55] },
  head: { pivot: [0.4, 0.49] },
  'leg-front': { pivot: [0.395, 0.62] },
  'leg-back': { pivot: [0.67, 0.62] },
  tail: { pivot: [0.73, 0.49] },
})

/** 坐姿正面是一张整图 */
export const DOG_SIT_PART = /** @type {const} */ ({ pivot: [0.5, 0.5] })

/** 站姿画稿里脚底所在的纵向位置（从上往下），用来把脚放到地板上 */
export const DOG_SIDE_FOOT_V = 0.795
/** 坐姿画稿里臀 / 脚底所在的纵向位置 */
export const DOG_SIT_FOOT_V = 0.83

/** 产物文件名（不含目录、扩展名） */
export const DOG_PART_FILES = /** @type {const} */ ({
  body: 'dog_body',
  head: 'dog_head',
  'leg-front': 'dog_leg_front',
  'leg-back': 'dog_leg_back',
  tail: 'dog_tail',
  sit: 'dog_sit',
})
