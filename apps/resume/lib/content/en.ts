import type { SiteContent } from './types'
import { credentialsEn } from './credentials'
import { mcallisterDetailEn } from './mcallisterDetail'
import { mergePublication } from './publicationItems'

export const en: SiteContent = {
  nav: {
    brand: 'Yibin Feng',
    links: [
      { label: 'About', href: '/classic/#about' },
      { label: 'Education', href: '/classic/#education' },
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
      'I currently work at **TAL Education** on **Epic!** (kids reading, overseas) as an **AI Research Engineer**, based across Beijing and Silicon Valley. I own full-stack R&D for US and global products — **AI Agent** workflows, **Harness** engineering, and search/recommendation pipelines. Earlier within the same TAL family, I was a **Front-end Engineer** at **Xueersi Online School**, shipping private-domain growth, public-domain content, and in-app ops platforms.',
      'During my MSc at the **National University of Singapore**, I was a **Research Student** at **AI4SG Lab** (AI for Social Good), supervised by **Prof. Yi-Chieh (EJ) Lee** and **Dr. Tianqi Song**, working on HCI, social computing, and multi-agent systems — work that led directly to my later **CSCW first-author** research.',
      'Before that, I worked in London at **McAllister Group** as a structural engineer on **HS2** — Europe\'s largest active infrastructure programme and a flagship underground high-speed rail project — delivering lining design, temporary works, and on-site packages.',
      'Academically, I earned an MSc in Computer Science from NUS (GPA **4.46/5.0**) and an MSc in General Structural Engineering from **Imperial College London**.',
    ],
    highlights: [
      {
        title: 'Multi-national',
        description: 'Studied in 4 countries · Worked in 3 (China / UK / US)',
      },
      {
        title: 'Communication',
        description: 'Cross-cultural collaboration, research storytelling & engineering alignment',
      },
      {
        title: 'AI Depth',
        description: 'From multi-agent research to production agents and full-stack delivery',
      },
    ],
  },

  education: {
    title: 'Education',
    subtitle: 'A path across Asia and Europe — QS-leading universities with a strong engineering foundation.',
    keyModulesLabel: 'Key Modules',
    viewEducationLabel: 'View modules',
    items: [
      {
        id: 'nus',
        school: 'National University of Singapore (NUS)',
        degree: 'MSc',
        field: 'Computer Science',
        period: '2023 – 2025',
        note: 'GPA 4.46 / 5.0',
        qsRank: '#8',
        qsLabel: 'QS World Rank',
        location: 'Singapore',
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
        school: 'Imperial College London',
        degree: 'MSc',
        field: 'General Structural Engineering',
        period: '2021 – 2022',
        note: 'Merit; Distinction in Final Design & Research Project',
        qsRank: '#2',
        qsLabel: 'QS World Rank',
        location: 'London, UK',
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
        location: 'Sichuan, China',
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
        school: 'University of Malaya (UM)',
        degree: 'Exchange Program',
        field: 'Civil Engineering',
        period: '2019 – 2020',
        note: 'Exchange semester',
        qsRank: '#56',
        qsLabel: 'QS World Rank',
        location: 'Kuala Lumpur, Malaysia',
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
        coverImage: '/experience/01-epic.png',
        coverAlt: 'Epic! kids reading platform',
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
        coverImage: '/experience/02-xueersi.png',
        coverAlt: 'Xueersi Online School / learning device',
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
          'Research student at NUS AI4SG Lab (AI for Social Good) focusing on HCI, social computing, and multi-agent systems',
          'Supervised by Prof. Yi-Chieh (EJ) Lee and Dr. Tianqi Song; contributed to CSCW / CHI research and publications',
          'Worked on conversational AI, prosocial behavior change, and human–AI collaboration system design',
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
          '/gallery/mcallister/life/colleagues-new.jpg',
          '/gallery/mcallister/life/bros.jpg',
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
    scholarUrl: 'https://scholar.google.com/citations?user=3-nYIGQAAAAJ&hl=en',
    scholarLabel: 'Google Scholar',
    readHighlightsLabel: 'Read highlights',
    citationsLabel: 'Citations',
    firstAuthorLabel: 'First author',
    stats: { citations: 54, hIndex: 3, i10: 2 },
    items: [
      mergePublication('03-social-norms', {
        title: 'Multi-Agent Systems Shape Social Norms for Prosocial Behavior Change',
        venue: "CSCW Companion '25",
        authors: 'Yibin Feng, Tianqi Song, Yugin Tan, Zicheng Zhu, Yi-Chieh Lee',
        keywords: ['Multi-Agent Systems', 'Social Norm', 'Social Identity', 'Donation', 'LLM Agent'],
        takeaway:
          'Multi-agent groups can establish virtual social norms; in-group agents boost donations more than out-group agents.',
        abstract:
          'Multi-agent systems can establish virtual social norms to encourage prosocial behavior. In-group agents produced stronger gains in donation willingness and amounts than out-group agents, showing that social-identity dynamics can shape human behavior.',
        highlights: [
          'Use multi-agent group chat to instantiate “virtual social norms” for donation interventions',
          'In-group agents (similar backgrounds) raise perceived norms, conformity, and peer pressure more than out-group agents',
          'In-group condition: donation amounts rose significantly after the interaction',
          'Reported contrast: ~62% donation increase (in-group) vs ~25% (out-group); χ²=3.95, p<0.05',
          'Implication: design social identity into multi-agent interventions to promote prosocial behavior',
        ],
      }),
      mergePublication('01-social-groups', {
        title:
          'Multi-Agents are Social Groups: Investigating Social Influence of Multiple Agents in Human-Agent Interactions',
        venue: 'PACM HCI · CSCW 2025',
        authors: 'Tianqi Song, Yugin Tan, Zicheng Zhu, Yibin Feng, Yi-Chieh Lee',
        keywords: ['Multi-Agent', 'Social Influence', 'Opinion Change', 'Social Pressure', 'LLM Agent'],
        takeaway:
          'Unified multi-agent stances are perceived as a social group and shift opinions and pressure more than a single agent.',
        abstract:
          'Inspired by human group social influence, we study whether a group of AI agents can pressure users to agree. Conversing with multiple agents increased felt social pressure and shifted opinions further toward the agents’ stances.',
        highlights: [
          'Frame multi-agents as a social group sharing one stance, then measure social influence on users',
          'Vs single agent: larger opinion shifts and stronger perceived social pressure',
          'Both agreement and disagreement from agents are amplified in the multi-agent setting',
          'Dual use: potential for social good and for malicious opinion manipulation',
          'Bridges social influence theory with LLM agents / CASA research',
        ],
      }),
      mergePublication('02-greater-sum', {
        title: 'Greater than the Sum of its Parts: Exploring Social Influence of Multi-Agents',
        venue: 'CHI Extended Abstracts 2025',
        authors: 'Tianqi Song, Yugin Tan, Zicheng Zhu, Yibin Feng, Yi-Chieh Lee',
        keywords: ['Multi-Agent', 'Social Influence', 'CHI', 'Opinion Change'],
        takeaway:
          'In painting discussions, the same arguments distributed across multi-agents shift attitudes more than one agent.',
        abstract:
          'Participants discussed two paintings with either one or multiple agents that liked or disliked each painting. Multi-agent conversations caused greater opinion shifts toward the agents’ stances.',
        highlights: [
          'Painting-preference task; keep argument content fixed, vary 1 vs many speakers',
          'Multi-agent condition produces larger attitude movement toward agent stances',
          'Supports “greater than the sum of its parts”: group presentation amplifies influence',
          'Early evidence informing fuller studies and ethics discussions',
        ],
      }),
      mergePublication('04-more-stronger', {
        title: 'The More, The Stronger? Investigating How Multi-Agent AI Shapes Human Opinions',
        venue: 'ICLR 2025 Workshop · Human-AI Coevolution',
        authors: 'Tianqi Song, Yugin Tan, Zicheng Zhu, Maojia Song, Yibin Feng, Yi-Chieh Lee',
        keywords: ['Multi-Agent', 'Opinion Shaping', '1 vs 5 Agents', 'Ethical AI'],
        takeaway:
          '1 vs 5 agents: multi-agent AI amplifies opinion shaping—balance influence with user autonomy.',
        abstract:
          'Drawing on social influence theory, we compare one vs five AI agents discussing paintings. Multi-agent interaction yielded stronger opinion shifts; we also discuss moderators such as prior beliefs and perceived inauthenticity of AI comments.',
        highlights: [
          'Core question: do multi-agent systems shape opinions more than a single agent (like human groups)?',
          'Experiment: 1-agent vs 5-agents with the same argument set on two paintings',
          'Finding: multi-agent condition produces significantly stronger opinion shifts',
          'Moderators: prior beliefs, perceived AI inauthenticity, human–AI preference alignment',
          'Design implication: balance persuasive power with autonomy and trust',
        ],
      }),
      mergePublication('05-opinionated-bots', {
        title: 'Understanding and Supporting Online Discussion with Opinionated Chatbots',
        venue: 'arXiv 2606.11693 · 2026',
        authors: 'Tianqi Song, Chi-Lan Yang, Zihan Liu, Zhengtao Xu, Yibin Feng, Yi-Chieh Lee',
        keywords: ['Opinionated Chatbots', 'Online Discussion', 'Opinion Shift', 'Communication Style'],
        takeaway:
          'Opposing / reinforcing / balanced chatbots change later openness and interpersonal communication style.',
        abstract:
          'We study how preparatory chats with opinionated bots affect later online discussions. Opposing bots increase openness to revising stances; reinforcing bots make subsequent human–human talk more agreeable. Bot type also shifts trust and perceptions of bots vs humans.',
        highlights: [
          'Pipeline: opinionated chatbot first, then human–human online discussion',
          'Opposing bots: greater later opinion revision / openness',
          'Reinforcing bots: more agreeable expressions with human interlocutors afterward',
          'Trust and perceptions of bots vs humans vary by chatbot type',
          'Design trade-off: cognitive flexibility vs positive UX and trust',
        ],
      }),
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
