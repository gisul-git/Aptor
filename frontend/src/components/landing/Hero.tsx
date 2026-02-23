'use client'

import React, { MouseEvent, useEffect, useRef, useState } from 'react'
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
import { ArrowRight, Play, Check } from 'lucide-react'
import { useRouter } from 'next/router'

const heroVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.5,
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}

export default function Hero() {
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()
  const [enableCursorEffects, setEnableCursorEffects] = useState(false)

  // Motion values for cursor and gradient centre
  const cursorX = useMotionValue(0)
  const cursorY = useMotionValue(0)
  const gradientX = useMotionValue(0)
  const gradientY = useMotionValue(0)

  // Spring smoothing for the visible cursor glow
  const cursorXSpring = useSpring(cursorX, { damping: 25, stiffness: 150 })
  const cursorYSpring = useSpring(cursorY, { damping: 25, stiffness: 150 })

  const lastMoveRef = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const isTouch = window.matchMedia('(pointer: coarse)').matches
    const prefersReduced =
      prefersReducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches

    setEnableCursorEffects(!isTouch && !prefersReduced)
  }, [prefersReducedMotion])

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    if (!enableCursorEffects) return

    const now = performance.now()
    // Throttle to ~60fps
    if (now - lastMoveRef.current < 16) return
    lastMoveRef.current = now

    const rect = e.currentTarget.getBoundingClientRect()
    const localX = e.clientX - rect.left
    const localY = e.clientY - rect.top

    cursorX.set(e.clientX)
    cursorY.set(e.clientY)
    gradientX.set(localX)
    gradientY.set(localY)
  }

  const cursorGradient = useMotionTemplate`radial-gradient(circle 800px at ${gradientX}px ${gradientY}px,
    rgba(157, 232, 176, 0.25),
    rgba(168, 232, 188, 0.18),
    rgba(201, 244, 212, 0.10),
    transparent 70%)`

  const handleScheduleDemo = () => {
    router.push('/schedule-demo')
  }

  const handleLogin = () => {
    router.push('/auth/signin')
  }

  return (
    <motion.section
      className="relative min-h-[calc(100vh-80px)] mt-20 flex flex-col items-center justify-center px-6 md:px-12 lg:px-16 pt-20 pb-0 md:pt-32 md:pb-10 overflow-hidden"
      variants={heroVariants}
      initial="hidden"
      animate="visible"
      onMouseMove={handleMouseMove}
    >
      {/* Static mesh gradient base (z-0) */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(201,244,212,0.18), transparent),' +
            'radial-gradient(ellipse 60% 40% at 80% 50%, rgba(157,232,176,0.14), transparent),' +
            'radial-gradient(ellipse 50% 50% at 20% 80%, rgba(232,250,240,0.18), transparent),' +
            'linear-gradient(to bottom, #ffffff, #F8FDF9)',
        }}
      />

      {/* Cursor-following radial gradient (z-10) */}
      {enableCursorEffects && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background: cursorGradient,
            willChange: 'transform',
          }}
        />
      )}

      {/* Cursor glow (z-20, disabled on touch / reduced motion) */}
      {enableCursorEffects && (
        <motion.div
          className="pointer-events-none fixed z-20 w-32 h-32 md:w-40 md:h-40 rounded-full blur-2xl opacity-30 bg-[radial-gradient(circle_at_center,#C9F4D4,transparent)]"
          style={{
            left: cursorXSpring,
            top: cursorYSpring,
            translateX: '-50%',
            translateY: '-50%',
            willChange: 'transform',
          }}
        />
      )}

      {/* Floating orbs (z--10) */}
      {!prefersReducedMotion && (
        <>
          <motion.div
            className="pointer-events-none absolute -left-32 top-0 w-64 h-64 rounded-full blur-3xl -z-10 bg-[#C9F4D4]/20"
            animate={{ y: [0, 24, 0], x: [0, 16, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
            style={{ willChange: 'transform' }}
          />
          <motion.div
            className="pointer-events-none absolute right-[-6rem] bottom-[-4rem] w-96 h-96 rounded-full blur-3xl -z-10 bg-[#9DE8B0]/18"
            animate={{ y: [0, -28, 0], x: [0, -18, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
            style={{ willChange: 'transform' }}
          />
        </>
      )}

      {/* Content (z-30) */}
      <motion.div
        className="relative z-30 max-w-7xl mx-auto w-full flex flex-col items-center text-center"
        style={{ willChange: 'transform' }}
      >
        {/* Headline */}
        <motion.h1
          variants={itemVariants}
          className="max-w-6xl mx-auto text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold leading-[1.1] md:leading-[1.05] tracking-tight text-[#2D5F4A]"
        >
          Transform Your{' '}
          <span className="bg-gradient-to-r from-[#2D5F4A] via-[#2D7A52] to-[#2D5F4A] bg-clip-text text-transparent">
            Capabilities Platform
          </span>
        </motion.h1>

        {/* Subheading */}
        <motion.p
          variants={itemVariants}
          className="mt-6 md:mt-8 max-w-4xl mx-auto text-base sm:text-lg md:text-xl lg:text-2xl font-normal leading-relaxed text-[#5A8B70]"
        >
          Empower your team with AI-driven assessments and seamless collaboration. Experience the
          future of capability management with insights that actually move the needle.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          variants={itemVariants}
          className="mt-10 md:mt-14 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          {/* Primary CTA: Schedule Demo */}
          <motion.button
            type="button"
            onClick={handleScheduleDemo}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.05, y: -2 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            transition={prefersReducedMotion ? undefined : { type: 'spring', stiffness: 400, damping: 17 }}
            className="inline-flex items-center justify-center min-w-[200px] md:min-w-[220px] px-8 py-4 md:px-10 md:py-5 rounded-full bg-[#9DE8B0] hover:bg-[#8FE0A9] active:bg-[#80D99F] text-[#1E5A3B] text-base md:text-lg font-semibold shadow-[0_8px_24px_rgba(157,232,176,0.35)] hover:shadow-[0_12px_40px_rgba(157,232,176,0.45)] transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9DE8B0] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            aria-label="Schedule a demo"
          >
            Schedule Demo
            <ArrowRight className="w-5 h-5 ml-2" aria-hidden="true" />
          </motion.button>

          {/* Secondary CTA: Login */}
          {/* Temporarily disabled - login button commented out */}
          {/* <motion.button
            type="button"
            onClick={handleLogin}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.05, y: -2 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            transition={prefersReducedMotion ? undefined : { type: 'spring', stiffness: 400, damping: 17 }}
            className="inline-flex items-center justify-center min-w-[200px] md:min-w-[220px] px-8 py-4 md:px-10 md:py-5 rounded-full border-2 border-[#9DE8B0] bg-transparent text-[#2D7A52] text-base md:text-lg font-medium hover:bg-[#9DE8B0]/10 hover:border-[#8FE0A9] hover:-translate-y-0.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9DE8B0] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            aria-label="Login to Aaptor"
          >
            Login
            <ArrowRight className="w-5 h-5 ml-2" aria-hidden="true" />
          </motion.button> */}
        </motion.div>

        {/* Trust indicators */}
        <motion.div
          variants={itemVariants}
          className="mt-8 md:mt-10 flex flex-wrap items-center justify-center gap-4 md:gap-6 text-sm md:text-base font-light text-[#5A8B70]"
        >
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#2D7A52]" aria-hidden="true" />
            <span>No credit card required</span>
          </div>
          <span className="hidden md:inline">•</span>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#2D7A52]" aria-hidden="true" />
            <span>Free trial</span>
          </div>
          <span className="hidden md:inline">•</span>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#2D7A52]" aria-hidden="true" />
            <span>500+ companies</span>
          </div>
        </motion.div>
      </motion.div>
    </motion.section>
  )
}


