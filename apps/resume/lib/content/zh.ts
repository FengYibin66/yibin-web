import type { SiteContent } from './types'
import { credentialsZh } from './credentials'
import { mcallisterDetailZh } from './mcallisterDetail'
import { mergePublication } from './publicationItems'

export const zh: SiteContent = {
  nav: {
    brand: 'Yibin Feng',
    links: [
      { label: '关于我', href: '/classic/#about' },
      { label: '教育经历', href: '/classic/#education' },
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
      '我目前在**好未来**旗下 **Epic!**（海外儿童阅读）担任 **AI Research Engineer**，办公地覆盖北京与硅谷，负责美国及全球相关产品的全栈研发、**AI Agent** 工作流、**Harness** 工程，以及搜索推荐算法与 pipeline。此前同样在好未来体系内的 **学而思网校** 担任 **前端开发工程师**，交付私域增长、公域内容与端内运营等多条产品线。',
      '在**新加坡国立大学**就读期间，我于 **AI4SG Lab**（AI for Social Good）担任 **Research Student**，由 **Prof. Yi-Chieh (EJ) Lee** 与 **Dr. Tianqi Song** 指导，围绕人机交互、社会计算与多智能体系统开展研究——这也直接促成了后续的 **CSCW 第一作者**工作。',
      '更早之前，我在伦敦 **McAllister Group** 担任结构工程师，参与欧洲现行最大的基建项目、地下高铁 **HS2** 的衬砌设计、临时工程与现场交付——这段欧洲旗舰工程经历，塑造了我对复杂系统落地与跨方协作的理解。',
      '学术路径上，我在新加坡国立大学取得计算机科学硕士学位（GPA **4.46/5.0**），并在**帝国理工大学**取得结构工程硕士学位。',
    ],
    highlights: [
      {
        title: '多国经历',
        description: '4 个国家求学 · 3 个国家工作（中 / 英 / 美）',
      },
      {
        title: '善于沟通',
        description: '跨文化协作、研究表达与工程对齐',
      },
      {
        title: '深耕 AI',
        description: '从多智能体研究到生产级 Agent 与全栈落地',
      },
    ],
  },

  education: {
    title: '教育经历',
    subtitle: '跨越亚洲与欧洲的求学路径，QS 顶尖院校与扎实工程基础并重。',
    keyModulesLabel: '核心课程',
    viewEducationLabel: '查看课程详情',
    items: [
      {
        id: 'nus',
        school: '新加坡国立大学（NUS）',
        degree: '理学硕士',
        field: '计算机科学',
        period: '2023 – 2025',
        note: 'GPA 4.46 / 5.0',
        qsRank: '#8',
        qsLabel: 'QS 全球排名',
        location: '新加坡',
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
        school: '帝国理工大学',
        degree: '理学硕士',
        field: '普通结构工程',
        period: '2021 – 2022',
        note: 'Merit（优良）；毕业设计 Distinction',
        qsRank: '#2',
        qsLabel: 'QS 全球排名',
        location: '英国·伦敦',
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
        location: '中国·四川',
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
        school: '马来亚大学（UM）',
        degree: '交换生项目',
        field: '土木工程',
        period: '2019 – 2020',
        note: '交换学期',
        qsRank: '#56',
        qsLabel: 'QS 全球排名',
        location: '马来西亚·吉隆坡',
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
        coverImage: '/experience/01-epic.png',
        coverAlt: 'Epic! kids reading platform',
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
        coverImage: '/experience/02-xueersi.png',
        coverAlt: '学而思网校 / 学习机产品',
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
        id: 'ai4sg',
        company: 'NUS · AI4SG Lab',
        role: 'Research Student',
        period: '2023 – 2025',
        location: 'Singapore',
        coverImage: '/experience/03-ai4sg.jpg',
        coverAlt: 'AI4SG Lab at CSCW',
        logo: '/brands/ai4sg-logo.png',
        companyUrl: 'https://www.ai4sg.org/',
        bullets: [
          '在新加坡国立大学 AI4SG Lab（AI for Social Good）从事人机交互 / 社会计算 / 多智能体研究',
          '由 Prof. Yi-Chieh (EJ) Lee 与 Dr. Tianqi Song 指导，参与 CSCW / CHI 等顶会相关研究与发表',
          '研究方向涵盖 conversational AI、亲社会行为改变与人机协作系统设计',
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
          '/gallery/mcallister/life/colleagues-new.jpg',
          '/gallery/mcallister/life/bros.jpg',
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
    scholarUrl: 'https://scholar.google.com/citations?user=3-nYIGQAAAAJ&hl=zh-CN',
    scholarLabel: 'Google Scholar',
    readHighlightsLabel: '阅读要点',
    citationsLabel: '引用',
    firstAuthorLabel: '第一作者',
    stats: { citations: 54, hIndex: 3, i10: 2 },
    items: [
      mergePublication('03-social-norms', {
        title: '多智能体系统通过塑造社会规范推动亲社会行为改变',
        venue: "CSCW Companion '25",
        authors: 'Yibin Feng, Tianqi Song, Yugin Tan, Zicheng Zhu, Yi-Chieh Lee',
        keywords: ['多智能体系统', '社会规范', '社会认同', '捐款行为', 'LLM 智能体'],
        takeaway: '多智能体可建立虚拟社会规范；内群体智能体对捐款的推动显著强于外群体。',
        abstract:
          '多智能体系统可通过建立虚拟社会规范来鼓励亲社会行为。内群体智能体使捐款意愿与金额提升更显著，外群体效应较弱，表明社会认同动态可有效影响人类行为。',
        highlights: [
          '用多智能体群聊建立「虚拟社会规范」，干预亲社会捐款行为',
          '内群体 agent（与用户背景相似）比外群体更能提升规范感知、从众与同伴压力',
          '内群体条件下捐款金额显著上升；外群体效应较弱',
          '关键结果：内群体捐款增幅约 62%，外群体约 25%（χ²=3.95，p<0.05）',
          '启示：可把社会认同设计进多智能体干预，以促进亲社会行为',
        ],
      }),
      mergePublication('01-social-groups', {
        title: '多智能体作为社会群体：探究多智能体在人机交互中的社会影响力',
        venue: 'PACM HCI · CSCW 2025',
        authors: 'Tianqi Song, Yugin Tan, Zicheng Zhu, Yibin Feng, Yi-Chieh Lee',
        keywords: ['多智能体', '社会影响', '意见改变', '社会压力', 'LLM Agent'],
        takeaway: '多智能体统一立场可被感知为社会群体，比单智能体更能改变意见并制造社会压力。',
        abstract:
          '受人类群体社会影响启发，研究多智能体是否会给用户带来社会压力并改变立场。发现与多智能体对话会提高社会压力感，并使意见更向智能体立场偏移。',
        highlights: [
          '把多智能体设计为「持有一致立场的社会群体」，检验对用户的社会影响',
          '相对单智能体：意见改变更大，感知到的社会压力更强',
          '当智能体同意/反对用户时，多智能体都会放大相应方向的立场偏移',
          '双刃剑：既可用于促进社会善，也可能被滥用于舆论操纵',
          '连接社会影响理论与 LLM Agent / CASA 研究线',
        ],
      }),
      mergePublication('02-greater-sum', {
        title: '整体大于部分之和：探索多智能体的社会影响力',
        venue: 'CHI Extended Abstracts 2025',
        authors: 'Tianqi Song, Yugin Tan, Zicheng Zhu, Yibin Feng, Yi-Chieh Lee',
        keywords: ['多智能体', '社会影响', 'CHI', '意见改变'],
        takeaway: '绘画态度讨论中，相同论点由多智能体分摊表达，比单智能体更能推动态度偏移。',
        abstract:
          '在绘画喜好讨论中对比单智能体与多智能体：智能体表达喜欢或不喜欢时，多智能体条件带来更大的意见改变。',
        highlights: [
          '以绘画评价为任务，控制论点内容一致，只改变「1 vs 多」表达者数量',
          '多智能体条件下，用户态度更显著地向智能体立场移动',
          '支持「整体大于部分之和」：群体化呈现放大影响力',
          '为后续完整研究与伦理风险讨论奠定早期证据',
        ],
      }),
      mergePublication('04-more-stronger', {
        title: '越多越强？探究多智能体 AI 如何塑造人类观点',
        venue: 'ICLR 2025 Workshop · Human-AI Coevolution',
        authors: 'Tianqi Song, Yugin Tan, Zicheng Zhu, Maojia Song, Yibin Feng, Yi-Chieh Lee',
        keywords: ['多智能体', '意见塑造', '1 vs 5 Agents', '伦理 AI'],
        takeaway: '1 vs 5 agents：多智能体显著放大意见塑造，并需权衡影响力与用户自主权。',
        abstract:
          '基于社会影响理论，比较单智能体与五智能体对绘画意见的影响。多智能体互动导致更强意见偏移；并讨论先验信念、AI 评论真实感等人机对齐因素的调节作用。',
        highlights: [
          '核心问题：多智能体是否比单智能体更能塑造人类意见（类似人类群体效应）',
          '实验：1-agent vs 5-agents，相同论点集合，讨论两幅画的艺术评价',
          '结果：多智能体条件意见偏移显著更强（「越多越强」）',
          '调节因素：用户先验、AI 评论「不真实感」、人机偏好是否对齐',
          '设计启示：在说服效力与用户自主、信任之间做平衡',
        ],
      }),
      mergePublication('05-opinionated-bots', {
        title: '用有立场的聊天机器人理解并支持在线讨论',
        venue: 'arXiv 2606.11693 · 2026',
        authors: 'Tianqi Song, Chi-Lan Yang, Zihan Liu, Zhengtao Xu, Yibin Feng, Yi-Chieh Lee',
        keywords: ['Opinionated Chatbots', '在线讨论', '意见改变', '沟通风格'],
        takeaway: '对立/强化/平衡三类立场型 chatbot，会改变后续人际讨论的开放度与表达风格。',
        abstract:
          '研究与有立场 chatbot 预互动如何影响后续在线讨论。对立型更容易促使立场修正；强化型则让用户在后续人际对话中更「agreeable」。不同类型也会影响信任与对 bot/人的感知。',
        highlights: [
          '流程：先与 opinionated chatbot 互动，再进入人与人在线讨论',
          '对立型：更易在后续讨论中修正初始立场，提升开放性',
          '强化型：后续对人沟通时更倾向和气、认同式表达',
          '不同类型 chatbot 带来不同的信任与对 bot / 人际对象的感知',
          '设计权衡：促进认知灵活 vs 保持积极体验与信任',
        ],
      }),
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
