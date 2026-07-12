import type { SiteContent } from './types'
import { credentialsZh } from './credentials'
import { mcallisterDetailZh } from './mcallisterDetail'

export const zh: SiteContent = {
  nav: {
    brand: 'Yibin Feng',
    links: [
      { label: '关于我', href: '/classic/#about' },
      { label: '技能', href: '/classic/#skills' },
      { label: '工作经历', href: '/classic/#experience' },
      { label: '项目', href: '/classic/#projects' },
      { label: '论文发表', href: '/classic/#publications' },
      { label: '荣誉证书', href: '/classic/#credentials' },
      { label: '联系我', href: '/classic/#contact' },
    ],
  },

  hero: {
    greeting: '你好，我是',
    name: 'Yibin Feng',
    nameZh: '冯一镔',
    roles: [
      'AI Research Engineer',
      'Front-end Engineer',
      'Researcher',
      'Civil Engineering (Structural Engineer)',
    ],
    tagline: '构建能够理解并影响人类行为的智能系统。London · Beijing · Silicon Valley',
    cta: '查看我的工作',
    scrollHint: '向下滚动探索',
  },

  about: {
    title: '关于我',
    bio: [
      '我目前在好未来 Epic!（海外儿童阅读）担任 AI Research Engineer，办公地覆盖北京与硅谷，负责美国及全球相关产品的全栈研发、AI Agent 工作流、Harness 工程，以及搜索推荐算法与 pipeline。此前在学而思网校担任前端开发工程师，交付私域增长、公域内容与端内运营等多条产品线。',
      '在转型 AI 之前，我在新加坡国立大学取得计算机科学硕士学位（GPA 4.46/5.0），并在伦敦帝国理工学院取得结构工程硕士学位。学术研究促成 CSCW 2025 第一作者论文，探究多智能体系统如何利用社会认同推动亲社会行为改变——这一发现持续影响着我对人机交互的设计理念。',
    ],
    stats: [
      { value: '4.46 / 5.0', label: 'NUS 绩点' },
      { value: 'CSCW 2025', label: '第一作者论文' },
      { value: '3 城', label: 'London · Beijing · SV' },
    ],
    keyModulesLabel: '核心课程',
    viewEducationLabel: '查看课程详情',
    education: [
      {
        id: 'nus',
        school: '新加坡国立大学（NUS）· 全球排名第 8',
        degree: '理学硕士',
        field: '计算机科学',
        period: '2023 – 2025',
        note: 'GPA 4.46 / 5.0',
        logo: '/education/NUS SOC.png',
        keyModules: [
          'Software Development Fundamentals',
          'Computer Systems and Applications',
          'Data Structures and Algorithms',
          'Enterprise Systems Architecture Fundamentals',
          'Artificial Intelligence',
          'Hands-on with Applied Analytics',
          'Software Engineering on Application Architecture',
          'Computing Capstone Project - Research Track',
          'Data Mining',
          'Neural Networks and Deep Learning',
          'Strategising for Global IT-enabled Business Successes',
        ],
      },
      {
        id: 'imperial',
        school: '伦敦帝国理工学院 · 全球排名第 2',
        degree: '理学硕士',
        field: '普通结构工程',
        period: '2021 – 2022',
        note: 'Merit（优良）；毕业设计 Distinction',
        logo: '/education/imperial horizontal.png',
        keyModules: [
          'Structural Analysis',
          'Cementitious Materials',
          'Steel Components',
          'Design of Masonry and Timber Structure',
          'Reinforced Concrete 1',
          'Stability',
          'Plated Structure',
          'Theory of Shell',
          'Structural Fire Engineering',
          'Concrete Materials',
          'Reinforced Concrete 2',
          'Design of Steel Building',
        ],
      },
      {
        id: 'scujju',
        school: '四川大学锦江学院',
        degree: '工学学士',
        field: '土木工程',
        period: '2017 – 2021',
        note: '专业排名第 1 / 148',
        logo: '/education/SCUJJU.jpg',
        keyModules: [
          '建筑材料',
          '材料力学',
          '房屋建筑学',
          '高等数学',
          '线性代数',
          '建筑制图',
          '理论力学',
          '结构力学',
          '土木工程测量',
        ],
      },
      {
        id: 'um',
        school: '马来亚大学（UM）· QS 排名第 59',
        degree: '交换生项目',
        field: '土木工程',
        period: '2019 – 2020',
        note: '马来西亚·吉隆坡',
        logo: '/education/UM.png',
        keyModules: [
          'Design of Steel Buildings',
          'Fluid Mechanics',
          'Construction Management and Technology',
        ],
      },
    ],
  },

  skills: {
    title: '技能',
    groups: [
      {
        title: 'AI 与研究',
        skills: [
          'GPT/LLM 集成',
          '提示工程',
          '多智能体系统',
          'Agent 工作流 / Harness',
          '搜索推荐与 RAG',
        ],
      },
      {
        title: '前端与全栈',
        skills: [
          'React',
          'Vue 3',
          'Angular',
          'Next.js / Nuxt',
          'TypeScript',
          'Three.js',
          'Node.js',
          'Go/Gin',
        ],
      },
      {
        title: '工具与基础设施',
        skills: [
          'Docker / K8s',
          'Python / FastAPI',
          'Git / GitHub Actions',
          'MySQL / Redis',
          '微信小程序',
          'Terraform',
        ],
      },
    ],
  },

  experience: {
    title: '工作经历',
    learnMoreLabel: '查看详情',
    items: [
      {
        id: 'epic',
        company: '好未来 · Epic!（海外儿童阅读）',
        role: 'AI Research Engineer',
        period: '2026 年 4 月 – 至今',
        location: 'Beijing (China) · Silicon Valley (US)',
        bullets: [
          '负责 Epic 美国及全球相关产品与业务研发，覆盖 Web 端与后端服务',
          '推进全栈业务开发、AI Agent 工作流实现与 Harness 工程',
          '参与搜索推荐算法实现及 pipeline 搭建，支撑海外儿童阅读场景',
          '参与 Epic Global：全球化交互式、游戏化阅读站的多端与 AI Native 架构推进',
        ],
      },
      {
        id: 'xueersi',
        company: '好未来 · 学而思网校',
        role: '前端开发工程师',
        period: '2025 年 7 月 – 2026 年 4 月',
        location: 'Beijing, China',
        bullets: [
          '参与学而思网校私域获客与运营体系：企微触达、裂变转介绍、增长配置、导流课成交闭环',
          '交付公域短视频/内容增长平台与端内运营资源位等前端产品',
          '参与 AI Tutor 动画辅导（一句话生成 STEM 动画视频）及 One Stack 全栈研发基建',
        ],
      },
      {
        id: 'lumi',
        company: 'Lumi Education',
        role: '大学讲师及研究生论文导师',
        period: '2024 年 9 月 – 至今',
        location: '远程',
        bullets: [
          '讲授深度神经网络（CNN、RNN、Transformer）及数据分析课程，多名学生获得优异成绩',
          '指导研究生完成论文选题、实验设计、模型开发与学术写作全过程',
        ],
      },
      {
        id: 'mcallister',
        company: 'McAllister Group',
        role: 'Graduate Engineer（结构）',
        period: '2022 年 10 月 – 2023 年 6 月',
        location: 'London, UK',
        bullets: [
          '参与欧洲最大基础设施项目 HS2 的衬砌设计与施工方案交付',
          '依据欧洲规范，运用有限元分析与 Python 开展岩土与结构评估',
          '监督紫外线与热固化工序，分析施工数据以确保合规性',
        ],
        images: [
          '/gallery/hs2/under Euston Station.jpg',
          '/gallery/hs2/lining work as Oldfield Lane.jpg',
          '/gallery/hs2/geospatial data collection.jpg',
        ],
        detail: mcallisterDetailZh,
      },
    ],
  },

  projects: {
    title: '项目',
    categories: [
      {
        id: 'personal',
        title: '个人',
        items: [
          {
            name: '个人简历网站',
            description: '交互式 3D 个人作品集，包含 WebGL 场景与滚动动画',
            tech: ['Three.js', 'GSAP', 'Next.js', 'TypeScript'],
            status: 'live',
            url: 'https://resume.yibinfeng.com',
          },
          {
            name: '微信公众号自动化平台',
            description: '面向微信公众号的 AI 内容自动化平台',
            tech: ['Go', 'Vue 3', 'Python', 'FastAPI'],
            status: 'live',
            url: 'https://mpauto.yibinfeng.com',
          },
          {
            name: 'Tripper',
            description: '连接全球旅行者与本地向导；AI 行程与社交论坛（学校项目）',
            tech: ['React', 'FastAPI', 'PostgreSQL', 'Docker'],
            status: 'archive',
          },
        ],
      },
      {
        id: 'xueersi',
        title: '好未来（学而思网校）',
        summary:
          '学而思网校私域获客与运营体系——企微触达、裂变转介绍、增长运营配置、导流课成交闭环；并覆盖公域内容增长、端内运营、AI 与研发基建。',
        groups: [
          {
            title: '私域增长',
            summary: '企微触达、裂变转介绍、增长运营配置、导流课成交闭环。',
            items: [
              {
                name: '4C · 企微触达中台',
                description: '企微私域运营中台：社群资产、触达计划/SOP、企微工具；微前端主子应用架构',
                tech: ['Vue3', 'qiankun', 'ant-design-vue'],
                status: 'internal',
              },
              {
                name: '老带新 + 转介绍',
                description: 'C 端裂变活动（小程序/H5）与 B 端活动/海报/奖品/任务配置后台',
                tech: ['Vue3', 'uni-app', 'Vant', 'Element Plus'],
                status: 'internal',
              },
              {
                name: '元一增长平台',
                description: '增长运营中台：活动管理与推广、CPA/CPS、人群包、权限与数据',
                tech: ['React19', 'Vite', 'antd', 'Zustand'],
                status: 'internal',
              },
              {
                name: '百川平台（ToB + ToC）',
                description: '导流课/特训班全链路：落地页、小程序成交、SKU 运营后台、支付完成页',
                tech: ['Nuxt/Vue', '小程序(mpx)', 'Element UI', 'Vant'],
                status: 'internal',
              },
            ],
          },
          {
            title: '公域增长',
            summary: '短视频/内容公域获客与内容生产运营。',
            items: [
              {
                name: '短视频增长平台',
                description: '内容生产与增长运营：编导工作台、素材/达人、种草审核、AI 短视频平台等',
                tech: ['React19', 'Vite', 'antd', 'Zustand'],
                status: 'internal',
              },
              {
                name: '小红书内容生产运营自动化',
                description: '小红书笔记/内容与数据运营管理，支撑生产与运营自动化',
                tech: ['React19', 'Vite', 'antd', 'Zustand'],
                status: 'internal',
              },
            ],
          },
          {
            title: '端内运营',
            items: [
              {
                name: 'App 资源位素材管理',
                description: '端内运营位素材配置、管理与多环境发布',
                tech: ['Nuxt2', 'ant-design-vue'],
                status: 'internal',
              },
            ],
          },
          {
            title: 'AI',
            items: [
              {
                name: 'AI Tutor（动画辅导）',
                description: '一句话生成 STEM 知识点/题目动画视频（B/C 端 + 生成引擎）',
                tech: ['NestJS', 'Vue3', 'Python/Manim'],
                status: 'internal',
              },
            ],
          },
          {
            title: '基建',
            items: [
              {
                name: 'One Stack',
                description: '全栈研发基建：脚手架/CLI、微前端模板、一键部署与工程规范',
                tech: ['Vue3', 'Vite', 'Go', 'Node CLI', 'monorepo'],
                status: 'internal',
              },
            ],
          },
        ],
      },
      {
        id: 'epic',
        title: '好未来（Epic! 海外儿童阅读）',
        summary:
          '面向儿童的在线阅读/学习平台（少儿电子图书馆 + 学习场景），覆盖 Web 端与后端服务，并推进全球市场新版本。Epic 美国：getepic.com',
        items: [
          {
            name: 'Epic! Web 平台',
            description:
              'C 端阅读应用（书库/阅读器/仪表盘等）+ 公开营销站；SSR、多地区（美/印）、特性开关与 A/B',
            tech: ['Angular 13', 'TypeScript', 'NgRx', 'Angular Universal', 'Express'],
            status: 'live',
            url: 'https://www.getepic.com/',
          },
          {
            name: 'Epic! Backend',
            description: '主站业务 API 与内容/运营支撑（会员、内容、支付集成、运营工具等）',
            tech: ['PHP', 'Symfony', 'Doctrine', 'MySQL', 'Redis', 'Docker/K8s'],
            status: 'internal',
          },
          {
            name: 'Epic Global',
            description:
              '全球化的交互式、游戏化阅读站 App（原生三端 + 后台 + 后端 + AI Native monorepo 架构）',
            tech: ['iOS(Swift)', 'Android(Kotlin)', 'Go/Gin', 'TS(Turborepo)', 'Python(AI)', 'Terraform'],
            status: 'dev',
          },
        ],
      },
      {
        id: 'mcallister',
        title: 'McAllister',
        summary: 'HS2 相关设计与现场交付；详情见工作经历。',
        items: [
          {
            name: 'HS2 衬砌与临建工程',
            description: '欧洲最大基础设施项目 HS2：衬砌设计、临时工程、现场数据与合规交付',
            tech: ['FEA', 'Python', 'Eurocode', 'BIM'],
            status: 'archive',
          },
        ],
      },
    ],
  },

  publications: {
    title: '论文发表',
    items: [
      {
        title: '多智能体系统通过塑造社会规范推动亲社会行为改变',
        venue: 'CSCW Companion \'25',
        year: 2025,
        authors: 'Yibin Feng, Tianqi Song, Yugin Tan, Zicheng Zhu, Yi-Chieh Lee',
        doi: 'https://doi.org/10.1145/3715070.3749246',
        keywords: ['多智能体系统', '社会规范', '社会认同', '行为改变', 'LLM 智能体'],
        abstract:
          '多智能体系统可通过建立虚拟社会规范来鼓励亲社会行为。内群体智能体使捐款率提升 62%，而外群体仅为 25%（χ²=3.95，p<0.05），表明 AI 群体可通过社会认同动态有效影响人类行为。',
        featured: true,
        image: '/publications-cscw-cover.png',
      },
      {
        title: '多智能体作为社会群体：探究多智能体在人机交互中的社会影响力',
        venue: 'ACM',
        year: 2023,
        authors: 'Tianqi Song, Yugin Tan, Zicheng Zhu, Yibin Feng, Yi-Chieh Lee',
        doi: 'https://dl.acm.org/doi/abs/10.1145/3757633',
        keywords: ['多智能体', '社会影响', '人机交互'],
        image: '/publications-cscw-cover.png',
      },
      {
        title: '整体大于部分之和：探索多智能体的社会影响力',
        venue: 'CHI Extended Abstracts 2025',
        year: 2025,
        authors: 'Tianqi Song, Yugin Tan, Zicheng Zhu, Yibin Feng, Yi-Chieh Lee',
        doi: 'https://dl.acm.org/doi/full/10.1145/3706599.3719973',
        keywords: ['多智能体', '社会影响', 'CHI'],
        image: '/publications-cscw-cover.png',
      },
    ],
  },

  credentials: credentialsZh,

  contact: {
    title: '联系我',
    subtitle: '欢迎洽谈 AI 工程、前端与研究相关机会',
    contactMeLabel: 'Contact me',
    followMeLabel: 'Follow me',
    email: 'fengyibinapply@163.com',
    emailSecondary: 'e0816292@u.nus.edu',
    phone: '+86 13340755292 (China)',
    github: 'https://github.com/FengYibin66',
    linkedin: 'https://linkedin.com/in/yibinfeng-imperial',
    wechatQr: '/images/wechatQR.jpg',
    facebook: 'https://www.facebook.com/profile.php?id=100009239169506',
    instagram: 'https://www.instagram.com/fengyibin6?igsh=MTg2cTB0OG0zcW5jMg==',
    copyLabel: '复制邮箱',
    copiedLabel: '已复制！',
  },

  footer: {
    copyright: '© 2026 Yibin Feng',
    builtWith: '基于 Next.js、Three.js 与 GSAP 构建',
  },

  classicUi: {
    learnMore: '了解更多',
    backToClassic: '← 返回简历',
  },
}
