export type Locale = 'en' | 'zh'

export const translations = {
  en: {
    nav: { projects: 'Projects', contact: 'Contact' },
    hero: { role: 'AI Engineer · Researcher · Builder', cta: 'View Projects' },
    projects: { title: 'Projects', visit: 'Visit →', live: 'Live', dev: 'In Development' },
    footer: { rights: 'All rights reserved.' },
    admin: {
      login: 'Admin Login',
      password: 'Password',
      submit: 'Sign In',
      logout: 'Logout',
      editProfile: 'Edit Profile',
      manageProjects: 'Manage Projects',
      save: 'Save',
      cancel: 'Cancel',
      add: 'Add Project',
      delete: 'Delete',
      edit: 'Edit',
      wrongPassword: 'Incorrect password',
    },
  },
  zh: {
    nav: { projects: '项目', contact: '联系' },
    hero: { role: 'AI 工程师 · 研究员 · 构建者', cta: '查看项目' },
    projects: { title: '我的项目', visit: '访问 →', live: '上线中', dev: '开发中' },
    footer: { rights: '版权所有。' },
    admin: {
      login: '管理员登录',
      password: '密码',
      submit: '登录',
      logout: '退出',
      editProfile: '编辑个人资料',
      manageProjects: '管理项目',
      save: '保存',
      cancel: '取消',
      add: '添加项目',
      delete: '删除',
      edit: '编辑',
      wrongPassword: '密码错误',
    },
  },
} as const

export type TranslationKey = typeof translations.en
