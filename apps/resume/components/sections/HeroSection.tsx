'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { GlowButton } from '@/components/ui'

function ScrollHint({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{text}</span>
      <div className="flex flex-col items-center -space-y-2 animate-pulse" style={{ color: 'var(--text-muted)' }}>
        <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
          <path d="M1 1L8 8L15 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
          <path d="M1 1L8 8L15 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}

export function HeroSection() {
  const { locale } = useLocale()
  const c = content[locale].hero

  const [roleIndex, setRoleIndex] = useState(0)
  const [showScroll, setShowScroll] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => {
      setRoleIndex((i) => (i + 1) % c.roles.length)
    }, 2500)
    return () => clearInterval(timer)
  }, [c.roles.length])

  useEffect(() => {
    const handleScroll = () => setShowScroll(window.scrollY <= 80)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <section className="min-h-screen flex flex-col items-center justify-center relative z-10 px-6 text-center">
      {/* Greeting */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="font-mono text-sm mb-3"
        style={{ color: 'var(--text-secondary)' }}
      >
        {c.greeting}
      </motion.p>

      {/* Name */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="font-display text-5xl md:text-7xl font-bold mb-2 bg-gradient-to-r from-[#00d4ff] to-[#6366f1] bg-clip-text text-transparent"
      >
        {c.name}
      </motion.h1>

      {/* Chinese name */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="font-display text-xl mb-6"
        style={{ color: 'var(--text-secondary)' }}
      >
        {c.nameZh}
      </motion.p>

      {/* Roles typewriter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="h-8 flex items-center justify-center mb-6"
      >
        <span
          className="font-display text-xl font-semibold"
          style={{ color: 'var(--accent-primary)' }}
        >
          {c.roles[roleIndex]}
        </span>
        <span
          className="ml-0.5 w-0.5 h-5 inline-block animate-pulse"
          style={{ background: 'var(--accent-primary)' }}
        />
      </motion.div>

      {/* Tagline */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="max-w-2xl text-lg mb-10"
        style={{ color: 'var(--text-secondary)' }}
      >
        {c.tagline}
      </motion.p>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
      >
        <GlowButton href="#about" variant="primary">{c.cta}</GlowButton>
      </motion.div>

      {/* Scroll hint */}
      <AnimatePresence>
        {showScroll && (
          <motion.div
            key="scroll-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
          >
            <ScrollHint text={c.scrollHint} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
