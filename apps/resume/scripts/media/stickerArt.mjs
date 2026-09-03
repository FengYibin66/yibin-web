/**
 * 摄影主题贴纸的 SVG 画法（审计 F1）。
 *
 * 与 `lib/lab/domain/galleryDoorPlan.mjs` 分开：那边是"贴哪、多大"，
 * 这边是"长什么样"。加一张贴纸只动这个文件，换位置只动那个文件。
 *
 * 风格要对齐门板：手绘彩铅 + 墨线描边 + 贴纸的白边。`feTurbulence` 让边缘
 * 不齐、内部有颗粒——纯平涂放在手绘门板上会像贴了片塑料。
 */

/** Lab 的墨色，与手写层、走廊线稿一致 */
const INK = '#2a1f0e'
/** 贴纸的白衬边 */
const PAPER = '#fdfbf4'

function pencil(seed) {
  return `
    <filter id="pencil" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3"
                    seed="${seed}" result="grain"/>
      <feDisplacementMap in="SourceGraphic" in2="grain" scale="2"
                         xChannelSelector="R" yChannelSelector="G"/>
    </filter>`
}

/** 白衬边 + 墨线外框 */
function backing(d) {
  return `<path d="${d}" fill="${PAPER}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`
}

/**
 * 满幅不透明衬底。
 *
 * **用作覆盖的贴纸必须有这一层。** 这些形状的造型里有透明区域——`photoStrip`
 * 三张相纸之间有缝、`camera` 顶部 22 单位是空的、`tape` 的撕口是镂空的——
 * 底下的旧贴纸就从这些缝里透出来。实机上先后出现过：胶带下露出
 * 「TypeScript」、相纸缝里露出 Instagram 的粉色、相机上方露出 YouTube 的红。
 *
 * 同一个错犯了三次，所以做成一个具名函数，并让 `__tests__/galleryDoor.test.ts`
 * 断言每个进入计划的形状都调了它。
 */
function fullBleed(width, height) {
  return `<rect x="0" y="0" width="${width}" height="${height}" fill="${PAPER}"/>`
}

export const STICKER_ART = {
  /** 35mm 单反，横向 */
  camera: {
    viewBox: { width: 200, height: 104 },
    body: (seed) => `${pencil(seed)}
      <g filter="url(#pencil)">
        ${fullBleed(200, 104)}
        ${backing('M6 22 h188 v76 H6 Z')}
        <rect x="16" y="32" width="168" height="56" rx="7" fill="#8d8375" stroke="${INK}" stroke-width="4"/>
        <rect x="52" y="16" width="48" height="18" rx="4" fill="#6f6659" stroke="${INK}" stroke-width="4"/>
        <circle cx="100" cy="60" r="24" fill="#3f3a33" stroke="${INK}" stroke-width="4"/>
        <circle cx="100" cy="60" r="14" fill="#6a92ad" stroke="${INK}" stroke-width="3"/>
        <circle cx="95" cy="55" r="4" fill="#eaf4fa" opacity="0.9"/>
        <circle cx="160" cy="44" r="6" fill="#c94f3d" stroke="${INK}" stroke-width="3"/>
        <rect x="26" y="40" width="16" height="9" rx="2" fill="#bfb6a5" stroke="${INK}" stroke-width="2"/>
      </g>`,
  },

  /** 135 胶卷筒 + 拉出的片基，很宽 */
  film: {
    viewBox: { width: 220, height: 100 },
    body: (seed) => `${pencil(seed)}
      <g filter="url(#pencil)">
        ${backing('M6 18 h208 v72 H6 Z')}
        <rect x="16" y="30" width="58" height="52" rx="7" fill="#4a453c" stroke="${INK}" stroke-width="4"/>
        <rect x="28" y="20" width="16" height="12" rx="3" fill="#6f6659" stroke="${INK}" stroke-width="3"/>
        <rect x="22" y="44" width="46" height="18" rx="3" fill="#cdb26a" stroke="${INK}" stroke-width="2"/>
        <rect x="76" y="32" width="130" height="48" fill="#5d564a" stroke="${INK}" stroke-width="4"/>
        ${[0, 1, 2, 3, 4].map(i => `
          <rect x="${84 + i * 25}" y="37" width="11" height="7" fill="#efe9db"/>
          <rect x="${84 + i * 25}" y="68" width="11" height="7" fill="#efe9db"/>`).join('')}
        <rect x="84" y="48" width="114" height="16" fill="#8a6b3f" stroke="${INK}" stroke-width="2"/>
      </g>`,
  },

  /** 拍立得，竖向 */
  polaroid: {
    viewBox: { width: 160, height: 176 },
    body: (seed) => `${pencil(seed)}
      <g filter="url(#pencil)">
        ${fullBleed(160, 176)}
        ${backing('M8 8 h144 v160 H8 Z')}
        <rect x="20" y="20" width="120" height="122" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>
        <rect x="28" y="28" width="104" height="88" fill="#7ba7c4" stroke="${INK}" stroke-width="3"/>
        <path d="M28 98 L58 68 L82 92 L102 74 L132 104 v12 H28 Z" fill="#4f6f57" stroke="${INK}" stroke-width="3"/>
        <circle cx="112" cy="46" r="9" fill="#f0d98a" stroke="${INK}" stroke-width="3"/>
        <rect x="34" y="150" width="58" height="7" rx="3" fill="#cfc6b2"/>
      </g>`,
  },

  /** 光圈叶片，方形 */
  aperture: {
    viewBox: { width: 176, height: 176 },
    body: (seed) => `${pencil(seed)}
      <g filter="url(#pencil)">
        <circle cx="88" cy="88" r="82" fill="${PAPER}" stroke="${INK}" stroke-width="6"/>
        <circle cx="88" cy="88" r="66" fill="#4a453c" stroke="${INK}" stroke-width="4"/>
        ${Array.from({ length: 6 }, (_, i) => {
          const a = (i * Math.PI) / 3
          const b = a + Math.PI / 3
          const r = 64
          const x1 = (88 + Math.cos(a) * r).toFixed(1)
          const y1 = (88 + Math.sin(a) * r).toFixed(1)
          const x2 = (88 + Math.cos(b) * r).toFixed(1)
          const y2 = (88 + Math.sin(b) * r).toFixed(1)
          return `<path d="M88 88 L${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2} Z"
                    fill="${i % 2 ? '#6f6659' : '#57503f'}" stroke="${INK}" stroke-width="2.5"/>`
        }).join('')}
        <circle cx="88" cy="88" r="22" fill="#1d1a15" stroke="${INK}" stroke-width="3"/>
        <circle cx="80" cy="80" r="6" fill="#8fb7cf" opacity="0.85"/>
      </g>`,
  },

  /** 定焦镜头侧视，横向 */
  lens: {
    viewBox: { width: 200, height: 104 },
    body: (seed) => `${pencil(seed)}
      <g filter="url(#pencil)">
        ${backing('M8 20 h184 v64 H8 Z')}
        <rect x="18" y="28" width="152" height="48" rx="8" fill="#3f3a33" stroke="${INK}" stroke-width="4"/>
        <rect x="34" y="34" width="14" height="36" fill="#5a5348" stroke="${INK}" stroke-width="2.5"/>
        <rect x="58" y="34" width="10" height="36" fill="#5a5348" stroke="${INK}" stroke-width="2.5"/>
        <circle cx="146" cy="52" r="22" fill="#2a4a5c" stroke="${INK}" stroke-width="3"/>
        <circle cx="146" cy="52" r="12" fill="#6a92ad"/>
        <circle cx="140" cy="46" r="4" fill="#eaf4fa" opacity="0.9"/>
      </g>`,
  },

  /** 手写胶带标签，很宽 */
  tape: {
    viewBox: { width: 240, height: 64 },
    body: (seed) => `${pencil(seed)}
      <g filter="url(#pencil)">
        <!--
          不透明衬底。

          撕口造型（那些锯齿凹角）是镂空的，底下的旧贴纸会从缝里透出来
          ——实机上「TypeScript」几个字就是这么从胶带下边缘露出来的。
          贴纸要盖住东西，silhouette 就必须是实的。
        -->
        ${fullBleed(240, 64)}
        <path d="M4 16 l14 -8 l0 8 l14 -8 l0 8 l176 0 l0 -8 l14 8 l0 -8 l14 8
                 l0 32 l-14 8 l0 -8 l-14 8 l0 -8 l-176 0 l0 8 l-14 -8 l0 8 l-14 -8 Z"
              fill="#e8ddbe" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
        <text x="120" y="42" font-family="'Patrick Hand', 'Comic Sans MS', cursive"
              font-size="30" fill="${INK}" text-anchor="middle">f/1.8</text>
      </g>`,
  },

  /**
   * 竖向胶片条：一整条 135 底片，六格。
   *
   * 长宽比 0.45，用来盖那些**又高又窄**的整簇旧贴纸。加它的原因是原有形状
   * 里最"竖"的 polaroid 只有 0.91——用它去盖 0.46 的区域，`coverSize` 会把
   * 宽度放大到两倍多，直接越出门板。
   */
  filmStripVertical: {
    viewBox: { width: 96, height: 212 },
    body: (seed) => {
      const shades = ['#7ba7c4', '#4f6f57', '#b8916a', '#5d6b7d', '#8a6b3f', '#6f8f7a']
      const frames = shades.map((shade, i) => `
        <rect x="20" y="${14 + i * 31}" width="56" height="25" fill="${shade}" stroke="${INK}" stroke-width="2"/>`)
      const perforations = Array.from({ length: 12 }, (_, i) => `
        <rect x="7" y="${11 + i * 16}" width="7" height="8" fill="${PAPER}"/>
        <rect x="82" y="${11 + i * 16}" width="7" height="8" fill="${PAPER}"/>`)
      return `${pencil(seed)}
      <g filter="url(#pencil)">
        ${fullBleed(96, 212)}
        ${backing('M2 2 h92 v208 H2 Z')}
        <rect x="5" y="5" width="86" height="202" fill="#3a352d" stroke="${INK}" stroke-width="3"/>
        ${perforations.join('')}
        ${frames.join('')}
      </g>`
    },
  },

  /**
   * 竖向照片堆：三张 4×6 相纸叠着。
   *
   * 长宽比 0.64，介于 filmStripVertical（0.45）与 polaroid（0.91）之间——
   * 覆盖竖长区域时溢出最小的那一档。
   */
  photoStrip: {
    viewBox: { width: 160, height: 250 },
    body: (seed) => {
      const cards = [
        { y: 8, tilt: -2, sky: '#7ba7c4', land: '#4f6f57' },
        { y: 88, tilt: 1.5, sky: '#a8bcc9', land: '#6f8f7a' },
        { y: 168, tilt: -1, sky: '#c9b28a', land: '#7a6a52' },
      ]
      return `${pencil(seed)}
      <g filter="url(#pencil)">
        ${fullBleed(160, 250)}
        ${cards.map((c, i) => `
          <g transform="rotate(${c.tilt} 80 ${c.y + 36})">
            <rect x="10" y="${c.y}" width="140" height="74" fill="${PAPER}" stroke="${INK}" stroke-width="5"/>
            <rect x="18" y="${c.y + 7}" width="124" height="52" fill="${c.sky}" stroke="${INK}" stroke-width="2"/>
            <path d="M18 ${c.y + 44} L52 ${c.y + 20} L76 ${c.y + 38} L100 ${c.y + 24} L142 ${c.y + 50}
                     v9 H18 Z" fill="${c.land}" stroke="${INK}" stroke-width="2"/>
            <circle cx="${122}" cy="${c.y + 19}" r="7" fill="#f0d98a" stroke="${INK}" stroke-width="2"/>
          </g>`).join('')}
      </g>`
    },
  },

  /**
   * 接触印相小样：3×3 格的缩略图。
   *
   * 摄影里最有辨识度的物件之一，而且是方形，正好盖那些方形的旧贴纸。
   */
  contactSheet: {
    viewBox: { width: 176, height: 176 },
    body: (seed) => {
      const frames = []
      const shades = ['#7ba7c4', '#4f6f57', '#b8916a', '#5d6b7d', '#8a6b3f', '#6f8f7a', '#a3b4c4', '#7a6a52', '#93a37e']
      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 3; c += 1) {
          const x = 22 + c * 46
          const y = 22 + r * 46
          frames.push(`<rect x="${x}" y="${y}" width="38" height="38"
                         fill="${shades[r * 3 + c]}" stroke="${INK}" stroke-width="2.5"/>`)
        }
      }
      return `${pencil(seed)}
      <g filter="url(#pencil)">
        ${fullBleed(176, 176)}
        ${backing('M6 6 h164 v164 H6 Z')}
        <rect x="14" y="14" width="148" height="148" fill="#3a352d" stroke="${INK}" stroke-width="3"/>
        ${frames.join('')}
      </g>`
    },
  },
}
