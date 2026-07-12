import type { SiteContent } from './types'
import { credentialsEn } from './credentials'
import { mcallisterDetailEn } from './mcallisterDetail'

export const en: SiteContent = {
  nav: {
    brand: 'Yibin Feng',
    links: [
      { label: 'About', href: '/classic/#about' },
      { label: 'Skills', href: '/classic/#skills' },
      { label: 'Experience', href: '/classic/#experience' },
      { label: 'Projects', href: '/classic/#projects' },
      { label: 'Publications', href: '/classic/#publications' },
      { label: 'Credentials', href: '/classic/#credentials' },
      { label: 'Contact', href: '/classic/#contact' },
    ],
  },

  hero: {
    greeting: "Hello, I'm",
    name: 'Yibin Feng',
    nameZh: '冯一镔',
    roles: [
      'AI Research Engineer',
      'Front-end Engineer',
      'Researcher',
      'Civil Engineering (Structural Engineer)',
    ],
    tagline:
      'Building intelligent systems that understand and shape human behavior. London · Beijing · Silicon Valley',
    cta: 'View My Work',
    scrollHint: 'Scroll to explore',
  },

  about: {
    title: 'About Me',
    bio: [
      'I am an AI Research Engineer on Epic! (kids reading, overseas) at TAL Education, working across Beijing and Silicon Valley. I build full-stack product features, AI agent workflows and harnesses, and search/recommendation pipelines for the US and global markets. Previously I was a Front-end Engineer at Xueersi Online School, shipping private-domain growth, public-domain content, and in-app ops platforms.',
      'Before pivoting to AI, I earned an MSc in Computer Science from the National University of Singapore (GPA 4.46/5.0) and an MSc in General Structural Engineering from Imperial College London. My academic research led to a first-author paper at CSCW 2025 on how multi-agent systems leverage social identity to drive prosocial behavior change — a finding that continues to inform how I design human-AI interactions.',
    ],
    stats: [
      { value: '4.46 / 5.0', label: 'NUS GPA' },
      { value: 'CSCW 2025', label: 'First Author' },
      { value: '3 Cities', label: 'London · Beijing · SV' },
    ],
    keyModulesLabel: 'Key Modules',
    viewEducationLabel: 'View modules',
    education: [
      {
        id: 'nus',
        school: 'National University of Singapore (NUS) · Global Rank #8',
        degree: 'MSc',
        field: 'Computer Science',
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
        school: 'Imperial College London · Global Rank #2',
        degree: 'MSc',
        field: 'General Structural Engineering',
        period: '2021 – 2022',
        note: 'Merit; Distinction in Final Design & Research Project',
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
        school: 'Sichuan University Jinjiang College',
        degree: 'BEng',
        field: 'Civil Engineering',
        period: '2017 – 2021',
        note: 'Rank 1 / 148',
        logo: '/education/SCUJJU.jpg',
        keyModules: [
          'Building Materials',
          'Material Mechanics',
          'Building Architecture',
          'Calculus',
          'Linear Algebra',
          'Architectural Drawing',
          'Theory of Mechanics',
          'Structural Mechanics',
          'Civil Engineering Surveying',
        ],
      },
      {
        id: 'um',
        school: 'University of Malaya (UM) · QS Rank #59',
        degree: 'Exchange Program',
        field: 'Civil Engineering',
        period: '2019 – 2020',
        note: 'Kuala Lumpur, Malaysia',
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
    title: 'Skills',
    groups: [
      {
        title: 'AI & Research',
        skills: [
          'GPT/LLM Integration',
          'Prompt Engineering',
          'Multi-Agent Systems',
          'Agent Workflows / Harness',
          'Search, Recsys & RAG',
        ],
      },
      {
        title: 'Frontend & Full-Stack',
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
        title: 'Tools & Infra',
        skills: [
          'Docker / K8s',
          'Python / FastAPI',
          'Git / GitHub Actions',
          'MySQL / Redis',
          'WeChat Mini Program',
          'Terraform',
        ],
      },
    ],
  },

  experience: {
    title: 'Experience',
    learnMoreLabel: 'View details',
    items: [
      {
        id: 'epic',
        company: 'TAL · Epic! (Kids Reading, Overseas)',
        role: 'AI Research Engineer',
        period: 'Apr 2026 – Present',
        location: 'Beijing (China) · Silicon Valley (US)',
        bullets: [
          'R&D for Epic US and global products spanning web clients and backend services',
          'Full-stack delivery, AI agent workflows, and harness engineering',
          'Search/recommendation algorithms and pipelines for kids reading scenarios',
          'Contributing to Epic Global: interactive, gamified reading across native apps and an AI-native monorepo',
        ],
      },
      {
        id: 'xueersi',
        company: 'TAL · Xueersi Online School',
        role: 'Front-end Engineer',
        period: 'Jul 2025 – Apr 2026',
        location: 'Beijing, China',
        bullets: [
          'Private-domain growth stack: WeCom outreach, referral campaigns, ops config, lead-course conversion',
          'Shipped public-domain short-video/content growth and in-app ops resource platforms',
          'Contributed to AI Tutor (sentence-to-STEM animation video) and One Stack engineering foundations',
        ],
      },
      {
        id: 'lumi',
        company: 'Lumi Education',
        role: 'University Lecturer & Graduate Thesis Supervisor',
        period: 'Sep 2024 – Present',
        location: 'Remote',
        bullets: [
          'Teaching deep neural networks (CNN, RNN, Transformer) and data analysis; multiple students achieved Distinction',
          'Guided graduate students through thesis design, experimental methodology, model development, and academic writing',
        ],
      },
      {
        id: 'mcallister',
        company: 'McAllister Group',
        role: 'Graduate Engineer (Structural)',
        period: 'Oct 2022 – Jun 2023',
        location: 'London, UK',
        bullets: [
          "Delivered lining design and construction packages for HS2 — Europe's largest infrastructure project",
          'Performed FEA and geotechnical assessment with Python per Eurocode standards',
          'Supervised UV and thermal curing; analyzed construction data to maintain compliance',
        ],
        images: [
          '/gallery/hs2/under Euston Station.jpg',
          '/gallery/hs2/lining work as Oldfield Lane.jpg',
          '/gallery/hs2/geospatial data collection.jpg',
        ],
        detail: mcallisterDetailEn,
      },
    ],
  },

  projects: {
    title: 'Projects',
    categories: [
      {
        id: 'personal',
        title: 'Personal',
        items: [
          {
            name: 'Resume Site',
            description: 'Interactive 3D personal portfolio with WebGL scenes and scroll animations',
            tech: ['Three.js', 'GSAP', 'Next.js', 'TypeScript'],
            status: 'live',
            url: 'https://resume.yibinfeng.com',
          },
          {
            name: 'WeChat AI Automation',
            description: 'AI-driven content automation for WeChat public accounts',
            tech: ['Go', 'Vue 3', 'Python', 'FastAPI'],
            status: 'live',
            url: 'https://mpauto.yibinfeng.com',
          },
          {
            name: 'Tripper',
            description: 'Match travelers with local guides; AI itineraries and social forum (school project)',
            tech: ['React', 'FastAPI', 'PostgreSQL', 'Docker'],
            status: 'archive',
          },
        ],
      },
      {
        id: 'xueersi',
        title: 'TAL (Xueersi Online School)',
        summary:
          'Private-domain acquisition & ops — WeCom outreach, referral loops, growth config, lead-course conversion — plus public-domain content growth, in-app ops, AI, and engineering foundations.',
        groups: [
          {
            title: 'Private-domain Growth',
            summary: 'WeCom outreach, referral campaigns, growth ops config, lead-course conversion loop.',
            items: [
              {
                name: '4C · WeCom Outreach Mid-platform',
                description:
                  'Private-domain ops mid-platform: community assets, outreach plans/SOP, WeCom tools; micro-frontend host/child apps',
                tech: ['Vue3', 'qiankun', 'ant-design-vue'],
                status: 'internal',
              },
              {
                name: 'Referral + Invite',
                description:
                  'C-end viral campaigns (mini program/H5) and B-end campaign/poster/reward/task admin',
                tech: ['Vue3', 'uni-app', 'Vant', 'Element Plus'],
                status: 'internal',
              },
              {
                name: 'Yuanyi Growth Platform',
                description:
                  'Growth ops mid-platform: campaigns, CPA/CPS, audience packs, permissions & analytics',
                tech: ['React19', 'Vite', 'antd', 'Zustand'],
                status: 'internal',
              },
              {
                name: 'Baichuan (ToB + ToC)',
                description:
                  'Lead-course / bootcamp full funnel: landing pages, mini-program checkout, SKU admin, payment success',
                tech: ['Nuxt/Vue', 'mpx mini program', 'Element UI', 'Vant'],
                status: 'internal',
              },
            ],
          },
          {
            title: 'Public-domain Growth',
            summary: 'Short-video / content acquisition and content production ops.',
            items: [
              {
                name: 'Short-video Growth Platform',
                description:
                  'Content production & growth ops: director workbench, assets/creators, seeding review, AI short-video, etc.',
                tech: ['React19', 'Vite', 'antd', 'Zustand'],
                status: 'internal',
              },
              {
                name: 'Xiaohongshu Content Ops Automation',
                description: 'Notes/content and data ops management for production & ops automation',
                tech: ['React19', 'Vite', 'antd', 'Zustand'],
                status: 'internal',
              },
            ],
          },
          {
            title: 'In-app Ops',
            items: [
              {
                name: 'App Placement Asset Management',
                description: 'In-app placement asset config, management, and multi-env publish',
                tech: ['Nuxt2', 'ant-design-vue'],
                status: 'internal',
              },
            ],
          },
          {
            title: 'AI',
            items: [
              {
                name: 'AI Tutor (Animated Tutoring)',
                description:
                  'One-sentence STEM concept/problem animation videos (B/C clients + generation engine)',
                tech: ['NestJS', 'Vue3', 'Python/Manim'],
                status: 'internal',
              },
            ],
          },
          {
            title: 'Foundations',
            items: [
              {
                name: 'One Stack',
                description:
                  'Full-stack engineering foundations: scaffolding/CLI, micro-frontend templates, one-click deploy & standards',
                tech: ['Vue3', 'Vite', 'Go', 'Node CLI', 'monorepo'],
                status: 'internal',
              },
            ],
          },
        ],
      },
      {
        id: 'epic',
        title: 'TAL (Epic! Kids Reading, Overseas)',
        summary:
          'Online reading/learning for kids (digital library + learning scenarios), covering web and backend, plus a global next version. Epic US: getepic.com',
        items: [
          {
            name: 'Epic! Web',
            description:
              'C-end reading app (library/reader/dashboard) + marketing site; SSR, multi-region (US/IN), feature flags & A/B',
            tech: ['Angular 13', 'TypeScript', 'NgRx', 'Angular Universal', 'Express'],
            status: 'live',
            url: 'https://www.getepic.com/',
          },
          {
            name: 'Epic! Backend',
            description:
              'Core business APIs and content/ops support (membership, content, payments, ops tools)',
            tech: ['PHP', 'Symfony', 'Doctrine', 'MySQL', 'Redis', 'Docker/K8s'],
            status: 'internal',
          },
          {
            name: 'Epic Global',
            description:
              'Global interactive, gamified reading app (native 3 clients + admin + backend + AI-native monorepo)',
            tech: ['iOS(Swift)', 'Android(Kotlin)', 'Go/Gin', 'TS(Turborepo)', 'Python(AI)', 'Terraform'],
            status: 'dev',
          },
        ],
      },
      {
        id: 'mcallister',
        title: 'McAllister',
        summary: 'HS2 design and on-site delivery; see Experience for detail.',
        items: [
          {
            name: 'HS2 Lining & Temporary Works',
            description:
              "Europe's largest infrastructure project HS2: lining design, temporary works, site data & compliance",
            tech: ['FEA', 'Python', 'Eurocode', 'BIM'],
            status: 'archive',
          },
        ],
      },
    ],
  },

  publications: {
    title: 'Publications',
    items: [
      {
        title: 'Multi-Agent Systems Shape Social Norms for Prosocial Behavior Change',
        venue: 'CSCW Companion \'25',
        year: 2025,
        authors: 'Yibin Feng, Tianqi Song, Yugin Tan, Zicheng Zhu, Yi-Chieh Lee',
        doi: 'https://doi.org/10.1145/3715070.3749246',
        keywords: ['Multi-Agent Systems', 'Social Norm', 'Social Identity', 'Behavior Change', 'LLM Agent'],
        abstract:
          'Multi-agent systems can establish virtual social norms to encourage prosocial behavior. In-group agents led to 62% donation increase vs 25% for out-group (χ²=3.95, p<0.05), demonstrating that AI groups can effectively influence human behavior through social identity dynamics.',
        featured: true,
        image: '/publications-cscw-cover.png',
      },
      {
        title: 'Multi-Agents as Social Groups: Investigating Social Influence of Multiple Agents in Human-Agent Interactions',
        venue: 'ACM',
        year: 2023,
        authors: 'Tianqi Song, Yugin Tan, Zicheng Zhu, Yibin Feng, Yi-Chieh Lee',
        doi: 'https://dl.acm.org/doi/abs/10.1145/3757633',
        keywords: ['Multi-Agent', 'Social Influence', 'Human-AI Interaction'],
        image: '/publications-cscw-cover.png',
      },
      {
        title: 'Greater than the Sum of its Parts: Exploring Social Influence of Multi-Agents',
        venue: 'CHI Extended Abstracts 2025',
        year: 2025,
        authors: 'Tianqi Song, Yugin Tan, Zicheng Zhu, Yibin Feng, Yi-Chieh Lee',
        doi: 'https://dl.acm.org/doi/full/10.1145/3706599.3719973',
        keywords: ['Multi-Agent', 'Social Influence', 'CHI'],
        image: '/publications-cscw-cover.png',
      },
    ],
  },

  credentials: credentialsEn,

  contact: {
    title: 'Get In Touch',
    subtitle: 'Open to opportunities in AI engineering, frontend, and research',
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
    copyLabel: 'Copy Email',
    copiedLabel: 'Copied!',
  },

  footer: {
    copyright: '© 2026 Yibin Feng',
    builtWith: 'Built with Next.js, Three.js & GSAP',
  },

  classicUi: {
    learnMore: 'Learn more',
    backToClassic: '← Back to resume',
  },
}
