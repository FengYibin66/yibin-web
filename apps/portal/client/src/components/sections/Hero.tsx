import { motion } from 'framer-motion'
import { Github, Linkedin, Mail } from 'lucide-react'
import { useProfile } from '@/lib/api'
import { useLocaleStore } from '@/store/locale'
import { translations } from '@/lib/i18n'

export default function Hero() {
  const { data: profile } = useProfile()
  const { locale } = useLocaleStore()
  const t = translations[locale]

  const name = locale === 'zh' ? profile?.nameZh : profile?.nameEn
  const bio = locale === 'zh' ? profile?.bioZh : profile?.bioEn

  return (
    <section className="min-h-screen flex items-center justify-center px-6">
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
              className="w-32 h-32 rounded-full object-cover ring-2 ring-[#00d4ff] ring-offset-4 ring-offset-[#070b12]"
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
          style={{ color: '#8b9bbc' }}
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
              className="p-3 rounded-full border border-[#1e2740] hover:border-[#00d4ff] hover:text-[#00d4ff] transition-colors"
              aria-label="GitHub">
              <Github size={20} />
            </a>
          )}
          {profile?.linkedin && (
            <a href={profile.linkedin} target="_blank" rel="noopener noreferrer"
              className="p-3 rounded-full border border-[#1e2740] hover:border-[#00d4ff] hover:text-[#00d4ff] transition-colors"
              aria-label="LinkedIn">
              <Linkedin size={20} />
            </a>
          )}
          {profile?.email && (
            <a href={`mailto:${profile.email}`}
              className="p-3 rounded-full border border-[#1e2740] hover:border-[#00d4ff] hover:text-[#00d4ff] transition-colors"
              aria-label="Email">
              <Mail size={20} />
            </a>
          )}
        </motion.div>
      </div>
    </section>
  )
}
