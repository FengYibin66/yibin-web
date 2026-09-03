/**
 * Gallery 门的贴纸计划（审计 F1）——**声明**，不含绘制。
 *
 * 通往 `/gallery`（摄影相册）的两扇门贴的是 HTML5 / JS / TypeScript / React /
 * node.js / CSS3，itomdev 原版「项目门」的贴图直接复用。这里记的是每张旧贴纸
 * 的包围盒（原图像素，逐张量出）与要盖上去的新贴纸。
 *
 * ## 为什么是「盖」而不是「修木纹」
 *
 * ADR 20260903140619 写的首选路线是复用现有木纹。试过：从门板自身的竖料取样
 * 平铺盖住凹槽面板，结果比原样更差——重复的样本让节子椭圆排成一行，相邻列
 * 镜像又造出强烈的对称"蝴蝶纹"，补丁与周围色调对不齐、矩形边界肉眼可见，
 * 而横跨两块面板之间的那张六边形贴纸不在任何一块面板里、怎么调矩形都留着。
 *
 * 门上贴纸叠贴纸本来就是常态，所以"新的盖旧的"契合媒介，而且完全没有拼接
 * 痕迹——画面质量只取决于贴纸本身的画法，那是可控的部分。
 *
 * ## 为什么是 .mjs
 *
 * 生成脚本（`scripts/media/gallery-door.mjs`）是 Node 直接跑的，不经过打包；
 * 而测试要断言同一份声明。两边都能 import 的最省事形态就是 `.mjs`。
 * 这个目录里其余文件是 TypeScript，这一个是例外，理由就是上面这条。
 */

/** 一张贴纸形状的自然长宽比对应的 viewBox */
export const STICKER_VIEWBOXES = {
  camera: { width: 200, height: 104 },
  film: { width: 220, height: 100 },
  polaroid: { width: 160, height: 176 },
  aperture: { width: 176, height: 176 },
  lens: { width: 200, height: 104 },
  tape: { width: 240, height: 64 },
  contactSheet: { width: 176, height: 176 },
  filmStripVertical: { width: 96, height: 212 },
  photoStrip: { width: 160, height: 250 },
}

/**
 * 等比放大到能盖住 region，**并把旋转算进去**。
 *
 * 不拉伸——拉伸会把圆的镜头变成椭圆。溢出是允许的：贴纸本来就该比它盖的
 * 东西大一点。`margin` 保证边缘有富余，旧贴纸的白边不会从缝里露出来。
 *
 * ## 为什么要算旋转
 *
 * 贴纸都带几度的倾斜（正着贴不像手贴的）。倾斜之后矩形的四角离开区域的四角，
 * **能盖住的正矩形反而变小**——第一版只按未旋转的尺寸算，测试立刻抓到：
 * 447 宽的区域配一张转 −3° 的胶片条，有效覆盖只有 426，四角会漏。
 * （视觉上当时没看出来，因为那几个角刚好是空木纹。这正是"看起来没问题"
 * 不能替代断言的例子。）
 *
 * 推导：宽 W 高 H 的矩形转 θ 后，能内含的轴对齐矩形最大为
 * `W·cosθ − H·sinθ` × `H·cosθ − W·sinθ`。令 W = a·H（a 是形状长宽比），
 * 反解出 H 的两个下界取大者。
 */
export function coverSize(viewBox, region, options = {}) {
  const { rotate = 0, margin = 1.08 } = typeof options === 'number'
    ? { margin: options }
    : options

  const aspect = viewBox.width / viewBox.height
  const rad = (Math.abs(rotate) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  const widthDen = aspect * cos - sin
  const heightDen = cos - aspect * sin

  /*
    分母 <= 0 表示这个角度下该形状怎么放大都盖不住那个方向——细长的形状转
    得多一点就会这样。回退到"按外接矩形算"，同时让测试去报出来，而不是在
    这里静默产出一个盖不住的尺寸。
  */
  const byWidth = widthDen > 0.05 ? (region.width * margin) / widthDen : Infinity
  const byHeight = heightDen > 0.05 ? (region.height * margin) / heightDen : Infinity
  const height = Math.min(
    Math.max(byWidth, byHeight),
    // 兜底：外接矩形口径
    Math.max(
      (region.width * margin) / aspect,
      region.height * margin,
    ) * 3,
  )

  return { width: aspect * height, height }
}

/**
 * 两扇门。
 *
 * `region` 是**旧贴纸的包围盒**（一到三张相邻的合成一个），`kind` 是盖上去的
 * 形状——按 region 的长宽比挑，溢出才小。`bounds` 是门板尺寸，测试用来断言
 * 贴纸不会飘到门外。
 */
/**
 * 两扇门。
 *
 * `region` 是**旧贴纸的包围盒**（整簇合成一个），`kind` 是盖上去的形状
 * ——按 region 的长宽比就近挑，溢出才小。`bounds` 是门板尺寸，
 * `__tests__/galleryDoor.test.ts` 用它断言贴纸不会越出门板。
 *
 * ## 为什么是"每块面板一张大的"而不是"一张盖一张"
 *
 * 逐张对位试过两轮：小区域配大长宽比的形状会严重溢出（两张一模一样的
 * 「f/1.8」越出了门板右缘），而形状挑对之后又反过来盖不严——好几张旧贴纸
 * 从缝里透出来（蓝圆、红块、`</>`），且右门出现三张一模一样的镜头。
 *
 * 整簇一张大贴纸同时解决三件事：没有缝、不重复、要调的数只有三分之一。
 * 视觉上也更像真门——贴纸本来就是一张压一张地叠。
 */
export const DOOR_PLANS = [
  {
    id: 'door_left_painted',
    // 产物目录（相对 public/textures/）——走廊门与 Classic 页的门不在一处
    dir: 'doors',
    bounds: { width: 810, height: 2108 },
    patches: [
      // 上面板整簇（HTML5 方贴 + 橙标签 + JS 黄圆 + 蓝六边形，后者跨到横档上）
      { kind: 'filmStripVertical', region: { left: 198, top: 238, width: 447, height: 972 }, rotate: -3 },
      // 下面板整簇（TypeScript 长条 + `</>` 六边形）
      { kind: 'contactSheet', region: { left: 195, top: 1355, width: 420, height: 400 }, rotate: 4 },
    ],
  },
  {
    id: 'door_right_painted',
    dir: 'doors',
    bounds: { width: 756, height: 1949 },
    patches: [
      // 上面板整簇（react + 原子 + s{x} + node.js + 放大镜 + `</>` 椭圆）
      { kind: 'photoStrip', region: { left: 150, top: 240, width: 510, height: 800 }, rotate: 3 },
      // 横档上的 `</>` 圆角方
      { kind: 'camera', region: { left: 466, top: 1074, width: 174, height: 112 }, rotate: -6 },
      // 下面板整簇（CSS3 盾 + `</>` 立方 + CSS 圆章）
      { kind: 'polaroid', region: { left: 175, top: 1200, width: 425, height: 450 }, rotate: -4 },
    ],
  },
  /*
    走廊侧的同一扇门。

    审计 F1 记的是两处：Classic 页的门贴技术贴纸，**走廊侧的门贴
    Instagram / TikTok / YouTube**。后者同样与"这后面是摄影作品"无关。

    sketch 与 painted 两层的贴纸位置完全一样（那两张图只有木纹的画法不同，
    贴纸本身在 sketch 层里也是彩色的），所以共用一份 patches。
  */
  ...['drzwisocial', 'drzwisocial_painted'].map(id => ({
    id,
    dir: 'corridor/doors',
    bounds: { width: 1024, height: 2048 },
    patches: [
      // Instagram + TikTok（上面板整簇）
      { kind: 'photoStrip', region: { left: 220, top: 169, width: 563, height: 804 }, rotate: -3 },
      // YouTube（下面板）
      { kind: 'camera', region: { left: 271, top: 1403, width: 446, height: 256 }, rotate: 4 },
    ],
  })),
]
