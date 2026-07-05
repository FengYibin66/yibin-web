import type { SiteContent } from './types'

export const en: SiteContent = {
  nav: {
    brand: 'Yibin Feng',
    links: [
      { label: 'About', href: '#about' },
      { label: 'Skills', href: '#skills' },
      { label: 'Experience', href: '#experience' },
      { label: 'Projects', href: '#projects' },
      { label: 'Publications', href: '#publications' },
      { label: 'Contact', href: '#contact' },
    ],
  },

  hero: {
    greeting: "Hello, I'm",
    name: 'Yibin Feng',
    nameZh: '冯一镔',
    roles: ['AI Engineer', 'Researcher', 'Builder'],
    tagline: 'Building intelligent systems that understand and shape human behavior.',
    cta: 'View My Work',
    scrollHint: 'Scroll to explore',
  },

  about: {
    title: 'About Me',
    bio: [
      'I am an AI Engineer at TAL Education (XueerSi), where I design and build production-grade LLM agent pipelines — from automated video generation to unified full-stack developer tooling. My work sits at the intersection of applied AI and software engineering, turning research ideas into systems that thousands of users rely on.',
      'Before pivoting to AI, I earned an MSc in Computer Science from the National University of Singapore (GPA 4.46/5.0) and an MSc in General Structural Engineering from Imperial College London. My academic research led to a first-author paper at CSCW 2025 on how multi-agent systems leverage social identity to drive prosocial behavior change — a finding that continues to inform how I design human-AI interactions.',
    ],
    stats: [
      { value: '4.46 / 5.0', label: 'NUS GPA' },
      { value: 'CSCW 2025', label: 'First Author' },
      { value: '3+', label: 'Production AI Systems' },
    ],
    education: [
      {
        school: 'National University of Singapore (NUS) · Global Rank #8',
        degree: 'MSc',
        field: 'Computer Science',
        period: '2023 – 2025',
        note: 'GPA 4.46 / 5.0',
      },
      {
        school: 'Imperial College London · Global Rank #2',
        degree: 'MSc',
        field: 'General Structural Engineering',
        period: '2021 – 2022',
        note: 'Merit',
      },
      {
        school: 'Sichuan University Jinjiang College',
        degree: 'BEng',
        field: 'Civil Engineering',
        period: '2017 – 2021',
        note: 'Rank 1 / 148',
      },
      {
        school: 'University of Malaya (UM) · QS Rank #59',
        degree: 'Exchange Program',
        field: 'Civil Engineering',
        period: '2019 – 2020',
        note: 'Kuala Lumpur, Malaysia',
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
          'Workflow Automation',
          'RAG Pipelines',
        ],
      },
      {
        title: 'Frontend & Full-Stack',
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
        title: 'Tools & Infra',
        skills: [
          'Docker',
          'Python / FastAPI',
          'Git / GitHub Actions',
          'Nginx',
          'Linux',
          'MySQL',
          'WeChat Mini Program',
        ],
      },
    ],
  },

  experience: {
    title: 'Experience',
    items: [
      {
        company: 'TAL Education (XueerSi)',
        role: 'AI Agent Engineer P3',
        period: 'Jul 2025 – Present',
        location: 'Beijing, China',
        bullets: [
          'Built AI Tutor video generation platform: one-sentence-to-teaching-video pipeline with LLM storyboard generation and automated rendering',
          'Developed One-CLI unified full-stack dev platform, reducing project initialization from weeks to 30 seconds',
          'Implemented AI original video production system integrating LLM script parsing, image generation, and voice cloning',
          'Built private-domain platforms (Baichuan, Resource Management, 4C Community) using qiankun micro-frontend architecture',
        ],
      },
      {
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
        company: 'McAllistern Group',
        role: 'Structural Engineer',
        period: 'Oct 2022 – Jun 2023',
        location: 'London, UK',
        bullets: [
          'Delivered lining design and construction packages for HS2 — Europe\'s largest infrastructure project',
          'Performed FEA and geotechnical assessment using advanced FEA techniques and Python per Eurocode standards',
          'Supervised UV and thermal curing procedures; analyzed construction data to maintain compliance',
        ],
      },
    ],
  },

  projects: {
    title: 'Projects',
    items: [
      {
        name: 'Resume Site',
        description: 'Interactive 3D personal portfolio with WebGL node graph and scroll animations',
        tech: ['Three.js', 'GSAP', 'Next.js', 'TypeScript'],
        status: 'live',
        url: 'https://resume.yibinfeng.com',
      },
      {
        name: 'WeChat AI Platform',
        description: 'AI-driven content automation platform for WeChat public accounts',
        tech: ['Go', 'Vue 3', 'Python', 'FastAPI'],
        status: 'live',
        url: 'https://mpauto.yibinfeng.com',
      },
      {
        name: 'AI Tutor Video Generator',
        description: 'One-sentence-to-teaching-video pipeline with LLM agents and automated rendering',
        tech: ['React', 'Python', 'LLM Agent', 'FastAPI'],
        status: 'live',
      },
      {
        name: 'One-CLI',
        description: 'Unified full-stack development platform: 30-second project creation with built-in auth, CI/CD',
        tech: ['Go', 'Docker', 'React', 'Node.js'],
        status: 'dev',
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
      },
      {
        title: 'Multi-Agents as Social Groups: Investigating Social Influence of Multiple Agents in Human-Agent Interactions',
        venue: 'ACM',
        year: 2023,
        authors: 'Tianqi Song, Yugin Tan, Zicheng Zhu, Yibin Feng, Yi-Chieh Lee',
        doi: 'https://dl.acm.org/doi/abs/10.1145/3757633',
        keywords: ['Multi-Agent', 'Social Influence', 'Human-AI Interaction'],
      },
      {
        title: 'Greater than the Sum of its Parts: Exploring Social Influence of Multi-Agents',
        venue: 'CHI Extended Abstracts 2025',
        year: 2025,
        authors: 'Tianqi Song, Yugin Tan, Zicheng Zhu, Yibin Feng, Yi-Chieh Lee',
        doi: 'https://dl.acm.org/doi/full/10.1145/3706599.3719973',
        keywords: ['Multi-Agent', 'Social Influence', 'CHI'],
      },
    ],
  },

  contact: {
    title: 'Get In Touch',
    subtitle: 'Open to opportunities in AI engineering and research',
    email: 'fengyibinapply@163.com',
    github: 'https://github.com/FengYibin66',
    linkedin: 'https://linkedin.com/in/yibinfeng-imperial',
    copyLabel: 'Copy Email',
    copiedLabel: 'Copied!',
  },

  footer: {
    copyright: '© 2025 Yibin Feng',
    builtWith: 'Built with Next.js, Three.js & GSAP',
  },
}
