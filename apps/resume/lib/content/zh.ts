import type { SiteContent } from './types'

export const zh: SiteContent = {
  nav: {
    brand: 'Yibin Feng',
    links: [
      { label: '关于我', href: '#about' },
      { label: '技能', href: '#skills' },
      { label: '工作经历', href: '#experience' },
      { label: '项目', href: '#projects' },
      { label: '论文发表', href: '#publications' },
      { label: '联系我', href: '#contact' },
    ],
  },

  hero: {
    greeting: '你好，我是',
    name: 'Yibin Feng',
    nameZh: '冯一镔',
    roles: ['AI 工程师', '研究员', '构建者'],
    tagline: '构建能够理解并影响人类行为的智能系统。',
    cta: '查看我的工作',
    scrollHint: '向下滚动探索',
  },

  about: {
    title: '关于我',
    bio: [
      '我是好未来（学而思）的 AI 工程师，专注于设计和构建生产级 LLM 智能体流水线——从自动化视频生成到统一全栈开发工具。我的工作位于应用 AI 与软件工程的交叉点，将研究成果转化为数千名用户依赖的系统。',
      '在转型 AI 之前，我在新加坡国立大学取得计算机科学硕士学位（GPA 4.46/5.0），并在帝国理工学院取得结构工程硕士学位。我的学术研究促成了一篇 CSCW 2025 第一作者论文，研究多智能体系统如何利用社会认同机制推动亲社会行为改变，这一发现持续影响着我对人机交互的设计理念。',
    ],
    stats: [
      { value: '4.46 / 5.0', label: 'NUS 绩点' },
      { value: 'CSCW 2025', label: '第一作者论文' },
      { value: '3+', label: '生产级 AI 系统' },
    ],
    education: [
      {
        school: 'National University of Singapore (NUS) · 全球排名第 8',
        degree: '理学硕士',
        field: '计算机科学',
        period: '2023 – 2025',
        note: 'GPA 4.46 / 5.0',
        logo: '/education/NUS SOC.png',
      },
      {
        school: 'Imperial College London · 全球排名第 2',
        degree: '理学硕士',
        field: '普通结构工程',
        period: '2021 – 2022',
        note: 'Merit（优良）',
        logo: '/education/imperial horizontal.png',
      },
      {
        school: '四川大学锦江学院',
        degree: '工学学士',
        field: '土木工程',
        period: '2017 – 2021',
        note: '专业排名第 1 / 148',
        logo: '/education/SCUJJU.jpg',
      },
      {
        school: 'University of Malaya (UM) · QS 排名第 59',
        degree: '交换生项目',
        field: '土木工程',
        period: '2019 – 2020',
        note: '马来西亚·吉隆坡',
        logo: '/education/UM.png',
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
          '工作流自动化',
          'RAG 流水线',
        ],
      },
      {
        title: '前端与全栈',
        skills: [
          'React',
          'Next.js',
          'TypeScript',
          'Vue 3',
          'Three.js',
          'Tailwind CSS',
          'Node.js',
          'Go/Gin',
        ],
      },
      {
        title: '工具与基础设施',
        skills: [
          'Docker',
          'Python / FastAPI',
          'Git / GitHub Actions',
          'Nginx',
          'Linux',
          'MySQL',
          '微信小程序',
        ],
      },
    ],
  },

  experience: {
    title: '工作经历',
    items: [
      {
        company: '好未来（学而思）',
        role: 'AI 智能体工程师 P3',
        period: '2025 年 7 月 – 至今',
        location: '中国·北京',
        bullets: [
          '构建 AI 辅导视频生成平台：一句话到教学视频的全流程，涵盖 LLM 分镜生成与自动化渲染',
          '开发 One-CLI 统一全栈开发平台，将项目初始化时间从数周缩短至 30 秒',
          '实现 AI 原创视频生产系统，集成 LLM 脚本解析、图像生成与语音克隆',
          '基于 qiankun 微前端架构构建私域平台（百川、资源管理、4C 社区等）',
        ],
      },
      {
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
        company: 'McAllistern Group',
        role: '结构工程师',
        period: '2022 年 10 月 – 2023 年 6 月',
        location: '英国·伦敦',
        bullets: [
          '参与欧洲最大基础设施项目 HS2 的衬砌设计与施工方案交付',
          '依据欧洲规范，运用先进有限元分析技术与 Python 开展岩土评估',
          '监督紫外线与热固化工序，分析施工数据以确保合规性',
        ],
        images: [
          '/gallery/hs2/under Euston Station.jpg',
          '/gallery/hs2/lining work as Oldfield Lane.jpg',
          '/gallery/hs2/geospatial data collection.jpg',
        ],
      },
    ],
  },

  projects: {
    title: '项目',
    items: [
      {
        name: '个人简历网站',
        description: '交互式 3D 个人作品集，包含 WebGL 节点图与滚动动画',
        tech: ['Three.js', 'GSAP', 'Next.js', 'TypeScript'],
        status: 'live',
        url: 'https://resume.yibinfeng.com',
      },
      {
        name: '微信 AI 自动化平台',
        description: '面向微信公众号的 AI 内容自动化平台',
        tech: ['Go', 'Vue 3', 'Python', 'FastAPI'],
        status: 'live',
        url: 'https://mpauto.yibinfeng.com',
      },
      {
        name: 'AI 辅导视频生成器',
        description: '一句话到教学视频的全流程，基于 LLM 智能体与自动化渲染',
        tech: ['React', 'Python', 'LLM Agent', 'FastAPI'],
        status: 'live',
      },
      {
        name: 'One-CLI',
        description: '统一全栈开发平台：30 秒完成项目创建，内置认证与 CI/CD',
        tech: ['Go', 'Docker', 'React', 'Node.js'],
        status: 'dev',
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
        image: '/cscw-poster.png',
      },
      {
        title: '多智能体作为社会群体：探究多智能体在人机交互中的社会影响力',
        venue: 'ACM',
        year: 2023,
        authors: 'Tianqi Song, Yugin Tan, Zicheng Zhu, Yibin Feng, Yi-Chieh Lee',
        doi: 'https://dl.acm.org/doi/abs/10.1145/3757633',
        keywords: ['多智能体', '社会影响', '人机交互'],
        image: '/cscw-poster.png',
      },
      {
        title: '整体大于部分之和：探索多智能体的社会影响力',
        venue: 'CHI Extended Abstracts 2025',
        year: 2025,
        authors: 'Tianqi Song, Yugin Tan, Zicheng Zhu, Yibin Feng, Yi-Chieh Lee',
        doi: 'https://dl.acm.org/doi/full/10.1145/3706599.3719973',
        keywords: ['多智能体', '社会影响', 'CHI'],
        image: '/cscw-poster.png',
      },
    ],
  },

  contact: {
    title: '联系我',
    subtitle: '欢迎洽谈 AI 工程与研究相关机会',
    email: 'fengyibinapply@163.com',
    github: 'https://github.com/FengYibin66',
    linkedin: 'https://linkedin.com/in/yibinfeng-imperial',
    copyLabel: '复制邮箱',
    copiedLabel: '已复制！',
  },

  footer: {
    copyright: '© 2025 Yibin Feng',
    builtWith: '基于 Next.js、Three.js 与 GSAP 构建',
  },
}
