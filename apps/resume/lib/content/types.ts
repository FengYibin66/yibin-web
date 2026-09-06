export type Locale = 'en' | 'zh'

export interface NavContent {
  brand: string
  links: { label: string; href: string }[]
}

export interface HeroContent {
  greeting: string
  name: string
  nameZh: string
  roles: string[]
  tagline: string
  cta: string
  scrollHint: string
}

export interface EducationEntry {
  id: string
  school: string
  degree: string
  field: string
  period: string
  note?: string
  logo?: string
  /** e.g. "QS #8" — shown as a prominent badge */
  qsRank?: string
  /** e.g. "Global Rank" / "全球排名" */
  qsLabel?: string
  location?: string
  keyModules?: string[]
}

export interface AboutHighlight {
  title: string
  description: string
}

export interface AboutContent {
  title: string
  bio: string[]
  highlights: AboutHighlight[]
}

export interface EducationContent {
  title: string
  subtitle?: string
  keyModulesLabel: string
  viewEducationLabel: string
  items: EducationEntry[]
}

export interface SkillGroup {
  title: string
  skills: string[]
}

export interface MediaImage {
  src: string
  caption: string
  explanation?: string
}

export interface ExperienceDetail {
  intro?: string
  /**
   * 详情页顶部的**横幅照片**，按 `object-cover` 铺满整行裁切显示。
   *
   * 只放**宽幅实景照**，且短边应 ≥ 1200px：容器最宽 896px，再窄的图会被放大到糊。
   * **不要放 logo** —— logo 是有边界的图形，`object-cover` 裁一刀就毁了；
   * 品牌标识走 `ExperienceItem.logo`（定死尺寸 + `object-contain`）。
   * McAllister 曾把一张 225×225 的方形 logo 放在这里，被放大约 4 倍再横向裁成
   * 一条，圆环上下全没了（2026-09-06 修）。
   */
  heroImage?: string
  video?: { title: string; youtubeId: string }
  sections: { title: string; bullets: string[] }[]
  caseStudy?: {
    title: string
    overview: string
    challengesTitle: string
    challenges: string[]
    solutionsTitle: string
    solutionsIntro?: string
    solutions: string[]
    achievementsTitle: string
    achievements: string[]
    images: MediaImage[]
  }
  gallery?: {
    title: string
    images: MediaImage[]
  }
}

export interface ExperienceItem {
  id: string
  company: string
  role: string
  period: string
  location: string
  bullets: string[]
  /** Hero/cover image shown on the timeline card */
  coverImage?: string
  coverAlt?: string
  /** Optional org logo (e.g. lab brand mark) */
  logo?: string
  /** Official site */
  companyUrl?: string
  images?: string[]
  detail?: ExperienceDetail
}

export type ProjectStatus = 'live' | 'dev' | 'internal' | 'archive'

export interface ProjectItem {
  name: string
  description: string
  tech: string[]
  status?: ProjectStatus
  url?: string
}

export interface ProjectGroup {
  title: string
  summary?: string
  items: ProjectItem[]
}

export interface ProjectCategory {
  id: string
  title: string
  summary?: string
  items?: ProjectItem[]
  groups?: ProjectGroup[]
}

export interface PublicationLink {
  label: string
  url: string
}

export interface PublicationItem {
  id: string
  title: string
  venue: string
  year: number
  authors: string
  /** ACM / DOI landing page when available */
  doi?: string
  keywords: string[]
  abstract?: string
  /** One-line takeaway on Classic L1 cards */
  takeaway?: string
  /** Bullet highlights for Classic detail (L2) */
  highlights?: string[]
  citations?: number
  role?: 'first' | 'coauthor'
  featured?: boolean
  image?: string
  links?: PublicationLink[]
}

export interface PublicationsContent {
  title: string
  scholarUrl: string
  scholarLabel: string
  readHighlightsLabel: string
  citationsLabel: string
  firstAuthorLabel: string
  stats?: { citations: number; hIndex: number; i10: number }
  items: PublicationItem[]
}

export interface CredentialItem {
  id: string
  title: string
  level?: string
  note?: string
  /** `scripts/media/optimize-credentials.mjs` 出的 webp 产物，原图在 `media-src/credentials/` */
  image?: string
  /**
   * 竖版文件标 `'contain'`：4:3 卡片默认 `object-cover`，竖版证书会被裁掉近一半，
   * 底部的印章 / 签名正好在被切的那段。证书是文件不是照片，裁一刀就毁了。
   * 不标就是 cover。哪些该标由 `__tests__/credentialsAssets.test.ts` 按原图尺寸对账。
   */
  fit?: 'contain'
}

export interface CredentialsContent {
  title: string
  awardsTitle: string
  certificatesTitle: string
  viewAllLabel: string
  backLabel: string
  awards: CredentialItem[]
  certificates: CredentialItem[]
}

export interface ContactContent {
  title: string
  subtitle: string
  contactMeLabel: string
  followMeLabel: string
  email: string
  emailSecondary?: string
  phone?: string
  github: string
  linkedin: string
  wechatQr?: string
  facebook?: string
  instagram?: string
  copyLabel: string
  copiedLabel: string
}

export interface FooterContent {
  copyright: string
  builtWith: string
}

export interface ClassicUiLabels {
  learnMore: string
  backToClassic: string
}

/**
 * Lab 的界面文案（审计 E7）。
 *
 * 之前只有房间**内容**接了 `useLocale`，界面壳子全是硬编码英文：中文用户进
 * Lab 看到的是「英文门牌 + 英文地图 + 英文加载提示 + 英文成就」包着中文内容。
 *
 * 门牌用 `RoomDefinition.labelKey` 索引到这里，所以加一个房间不需要改这个
 * 接口。`__tests__/labI18n.test.ts` 断言 en/zh 的键完全一致，且 Lab 组件里
 * 没有漏在外面的英文字面量。
 */
export interface LabUiLabels {
  /** 门牌。键是 RoomDefinition.labelKey */
  doors: Record<'about' | 'projects' | 'publications' | 'contact' | 'gallery', string>
  /** 教程气泡：{标题, 说明} */
  tutorials: Record<
    'corridor_enter' | 'corridor_explore' | 'about_scroll' | 'projects_inspect'
    | 'gallery_inspect' | 'contact_found' | 'publications_read',
    { title: string; label: string }
  >
  /** 加载与失败态 */
  loading: {
    preparing: string
    failed: string
    failedHint: string
    retry: string
    backToCorridor: string
  }
  /** 覆盖层面板 */
  panels: {
    achievements: string
    closeAchievements: string
    audio: string
    closeAudio: string
    music: string
    sfx: string
    ambience: string
    mute: string
    unmute: string
    map: string
    openMap: string
    closeMap: string
    help: string
    exitLab: string
    /**
     * 语言切换按钮的可访问名。
     *
     * **用目标语言写**，与它的可见文字（en 下显示「中文」、zh 下显示「EN」）
     * 一致——中文用户读不懂英文标签，反过来也一样。所以 `en` 这一份是中文、
     * `zh` 那一份是英文，`labI18n` 的"语言纯度"检查对这一项豁免。
     */
    toggleLanguage: string
    /** 「已探索 N / M」。`{done}` 与 `{total}` 是占位符 */
    exploredCount: string
  }
  /** 操作提示 */
  hints: {
    clickDoor: string
    tapDoor: string
    scroll: string
    swipeUpDown: string
    swipeLeftRight: string
    moveMouse: string
    escape: string
    touchControls: string
    mouseKeyboard: string
    howToExplore: string
    dismissTutorial: string
    /** 房间加载超时的错误文案 */
    loadTimedOut: string
    /** 图片预览 */
    imagePreview: string
    previewImage: string
    /** 「预览 {name}」——`{name}` 是图片的 alt */
    previewNamed: string
    /**
     * Projects 房间停靠后，屏幕底部的「访问 →」。只在项目有 `url` 时出现。
     *
     * ADR 20260903140616 把「点一下」统一成停靠（原实现是 `window.open`），
     * 但 `ProjectRoomItem.url` 一路带到房间却没人消费——有链接的项目停靠后
     * 也无路可去（2026-09-06 实机反馈）。这一条是那个缺口的出口。
     */
    visitProject: string
    /** 教程卡片底部的两个按钮 */
    skipTutorial: string
    startExploring: string
    /** 返回上一层（走廊 / 首页）的可见文字 */
    back: string
  }
  /**
   * 入口页。
   *
   * 放在 labUi 里而不是另开一组：入口页就是 Lab 的门，两处文案要一起改
   * （比如 Lab 改了名字）。审计 E7 也把它算在同一条里（"入口页也无语言切换"）。
   */
  entry: {
    labEyebrow: string
    labTitle: string
    labTagline: string
    labCta: string
    labCtaTouch: string
    classicTitle: string
    classicTagline: string
    classicCta: string
    /** Classic 面板上的三个方向标签 */
    classicTags: readonly string[]
    /** 底部说明条 */
    explorerBar: string
    /** 「点一扇门进入。音频当前」——后面接一个可点的开关 */
    explorerHint: string
    explorerHintTouch: string
  }
  /**
   * 兜底页与降级路径的文案。
   *
   * 这一组以前整个是硬编码英文，因为**只有不支持 3D 的设备会看到**——开发机上
   * 永远走不到，所以没人注意到它没翻译。慢网提示同理（本地永远不慢）。
   */
  fallback: {
    /** WebGL 不可用 */
    webglTitle: string
    webglBody: string
    webglCta: string
    /** 加载很慢时给的旁路出口 */
    slowConnection: string
    /** 3D 场景里的彩蛋 */
    bugFixed: string
    drawing: string
  }
  /** 「这个操作能做什么」的结果说明 */
  results: {
    walkCorridor: string
    lookAround: string
    enterRoom: string
  }
}

export interface SiteContent {
  nav: NavContent
  labUi: LabUiLabels
  hero: HeroContent
  about: AboutContent
  education: EducationContent
  skills: { title: string; groups: SkillGroup[] }
  experience: { title: string; learnMoreLabel: string; items: ExperienceItem[] }
  projects: { title: string; categories: ProjectCategory[] }
  publications: PublicationsContent
  credentials: CredentialsContent
  contact: ContactContent
  footer: FooterContent
  classicUi: ClassicUiLabels
}
