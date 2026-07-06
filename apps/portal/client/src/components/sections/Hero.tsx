import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Github, Linkedin, Mail, ChevronDown } from 'lucide-react'
import { useProfile } from '@/lib/api'
import { useLocaleStore } from '@/store/locale'
import { translations } from '@/lib/i18n'

export default function Hero() {
  const { data: profile } = useProfile()
  const { locale } = useLocaleStore()
  const t = translations[locale]
  const [scrolled, setScrolled] = useState(false)

  const name = locale === 'zh' ? profile?.nameZh : profile?.nameEn
  const bio = locale === 'zh' ? profile?.bioZh : profile?.bioEn

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToProjects = () => {
    document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-6 relative">
      <div className="text-center max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8 flex justify-center"
        >
          {profile?.avatarPath && (
            <img
              src={profile.avatarPath}
              alt={name}
              className="w-32 h-32 rounded-full object-cover"
              style={{ outline: '2px solid var(--accent-primary)', outlineOffset: '4px' }}
            />
          )}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="text-4xl sm:text-5xl font-bold mb-4"
          style={{ fontFamily: 'Space Grotesk, system-ui' }}
        >
          <span className="bg-gradient-to-r from-[#00d4ff] via-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
            {name ?? 'Yibin Feng'}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="text-lg sm:text-xl mb-8"
          style={{ color: 'var(--text-secondary)' }}
        >
          {bio ?? t.hero.role}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="flex justify-center gap-5"
        >
          {profile?.github && (
            <a href={profile.github} target="_blank" rel="noopener noreferrer"
              className="p-3 rounded-full border transition-colors"
              style={{ borderColor: 'var(--bg-border)', color: 'var(--text-secondary)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bg-border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              aria-label="GitHub">
              <Github size={20} />
            </a>
          )}
          {profile?.linkedin && (
            <a href={profile.linkedin} target="_blank" rel="noopener noreferrer"
              className="p-3 rounded-full border transition-colors"
              style={{ borderColor: 'var(--bg-border)', color: 'var(--text-secondary)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bg-border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              aria-label="LinkedIn">
              <Linkedin size={20} />
            </a>
          )}
          {profile?.email && (
            <a href={`mailto:${profile.email}`}
              className="p-3 rounded-full border transition-colors"
              style={{ borderColor: 'var(--bg-border)', color: 'var(--text-secondary)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bg-border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              aria-label="Email">
              <Mail size={20} />
            </a>
          )}
        </motion.div>
      </div>

      {/* 下滑引导 */}
      <AnimatePresence>
        {!scrolled && (
          <motion.button
            key="scroll-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 1.0, duration: 0.5 } }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            onClick={scrollToProjects}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 cursor-pointer select-none"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Scroll to projects"
          >
            <span className="text-xs tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
              {locale === 'zh' ? '查看我的项目' : 'See My Projects'}
            </span>
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ChevronDown size={22} />
            </motion.div>
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
              style={{ marginTop: '-8px' }}
            >
              <ChevronDown size={22} />
            </motion.div>
          </motion.button>
        )}
      </AnimatePresence>
    </section>
  )
}
