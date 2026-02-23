'use client'

import React, { useMemo, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'

/**
 * VideoShowcase
 * - Scroll-triggered entrance animations (Intersection Observer via framer-motion `useInView`)
 * - Glassmorphic video frame with hover lift + glow
 * - Blur-to-clear loading effect for perceived performance
 * - Reduced-motion friendly (disables non-essential motion)
 */
export default function VideoShowcase() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const prefersReducedMotion = useReducedMotion()
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' })
  const [isLoaded, setIsLoaded] = useState(false)

  // Lightweight poster placeholder (SVG gradient) to avoid flashing blank content.
  const poster = useMemo(() => {
    const svg = encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#ffffff"/>
            <stop offset="0.55" stop-color="#F8FDF9"/>
            <stop offset="1" stop-color="#F0FDF4"/>
          </linearGradient>
          <radialGradient id="r" cx="50%" cy="35%" r="70%">
            <stop offset="0" stop-color="rgba(157,232,176,0.35)"/>
            <stop offset="1" stop-color="rgba(255,255,255,0)"/>
          </radialGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#g)"/>
        <circle cx="520" cy="320" r="420" fill="url(#r)"/>
        <text x="50%" y="52%" text-anchor="middle" fill="#2D5F4A" font-size="44" font-family="Arial, sans-serif" opacity="0.55">
          Loading Demo…
        </text>
      </svg>
    `)
    return `data:image/svg+xml;charset=utf-8,${svg}`
  }, [])

  const containerVariants = useMemo(
    () => ({
      hidden: { opacity: 0, y: 100 },
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          duration: prefersReducedMotion ? 0 : 0.8,
          ease: [0.22, 1, 0.36, 1],
          staggerChildren: prefersReducedMotion ? 0 : 0.2,
        },
      },
    }),
    [prefersReducedMotion],
  )

  const headlineVariants = useMemo(
    () => ({
      hidden: { opacity: 0, y: 30 },
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          duration: prefersReducedMotion ? 0 : 0.6,
          ease: 'easeOut',
        },
      },
    }),
    [prefersReducedMotion],
  )

  const videoVariants = useMemo(
    () => ({
      hidden: { opacity: 0, scale: 0.9, y: 50 },
      visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: {
          duration: prefersReducedMotion ? 0 : 1,
          ease: [0.22, 1, 0.36, 1],
        },
      },
    }),
    [prefersReducedMotion],
  )

  return (
    <motion.section
      ref={sectionRef}
      className="relative -mt-20 md:-mt-32 px-4 md:px-26 py-20 md:py-32 bg-gradient-to-b from-white via-[#F8FDF9] to-[#F0FDF4] overflow-hidden max-w-[100dvw] max-h-[100dvh]"
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
    >
      {/* Decorative background elements (disabled for reduced motion). */}
      {!prefersReducedMotion && (
        <>
          <motion.div
            className="pointer-events-none absolute top-20 left-10 w-[400px] h-[400px] bg-[#C9F4D4]/20 rounded-full blur-3xl -z-10"
            animate={{ x: [0, 30, 0], y: [0, -40, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            style={{ willChange: 'transform' }}
          />
          <motion.div
            className="pointer-events-none absolute bottom-20 right-10 w-[350px] h-[350px] bg-[#A8E8BC]/15 rounded-full blur-3xl -z-10"
            animate={{ x: [0, -30, 0], y: [0, 40, 0], scale: [1, 1.15, 1] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            style={{ willChange: 'transform' }}
          />
        </>
      )}

      {/* Headline */}
      <motion.div className="text-center mb-8 md:mb-16" variants={headlineVariants}>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-[#2D5F4A] via-[#2D7A52] to-[#2D5F4A] bg-clip-text text-transparent">
          Experience the Platform in Action
        </h2>
        <p className="mt-4 text-base md:text-lg lg:text-xl text-[#5A8B70] font-normal max-w-2xl mx-auto">
          See how teams transform their capabilities with AI-driven insights
        </p>
      </motion.div>

      {/* Video Container */}
      <motion.div
        className="mx-auto w-[90vw] md:w-[85vw] relative"
        style={{ height: '54.8897vh', maxWidth: '91.6176vw' }}
        variants={videoVariants}
      >
        {/* Glassmorphic Frame */}
        <motion.div
          className="group relative w-full h-full rounded-[16px] md:rounded-[32px] bg-white/80 backdrop-blur-sm border border-white/60 shadow-[0_20px_80px_rgba(157,232,176,0.3)] p-2 md:p-3 transform-gpu cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9DE8B0] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          whileHover={prefersReducedMotion ? undefined : { scale: 1.02, y: -5 }}
          transition={prefersReducedMotion ? undefined : { duration: 0.3, ease: 'easeOut' }}
          tabIndex={0}
          aria-label="Platform demo video container"
          style={{ willChange: 'transform' }}
        >
          {/* Glow effect behind video (fade in on hover/focus) */}
          <div className="pointer-events-none absolute -inset-4 bg-gradient-to-r from-[#9DE8B0]/30 via-[#C9F4D4]/30 to-[#9DE8B0]/30 rounded-[20px] md:rounded-[36px] blur-2xl -z-10 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-500" />

          {/* Video */}
          <video
            src="https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-futuristic-screens-45023-large.mp4"
            autoPlay
            loop
            playsInline
            muted
            preload="metadata"
            poster={poster}
            onLoadedData={() => setIsLoaded(true)}
            className={[
              'w-full h-full object-cover object-top rounded-[12px] md:rounded-[24px]',
              'transition-all duration-1000',
              isLoaded ? 'blur-0' : 'blur-md',
            ].join(' ')}
            aria-label="Platform Demo Video"
          />

          {/* Floating badges */}
          <motion.div
            className="absolute top-6 left-6 bg-[#9DE8B0]/90 backdrop-blur-md px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[#1E5A3B] text-xs md:text-sm font-semibold shadow-lg"
            initial={prefersReducedMotion ? false : { opacity: 0, x: -20 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            transition={prefersReducedMotion ? undefined : { delay: 1.2, duration: 0.6 }}
          >
            ✨ Live Demo
          </motion.div>

          <motion.div
            className="absolute top-6 right-6 bg-white/90 backdrop-blur-md px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[#2D7A52] text-xs md:text-sm font-semibold shadow-lg flex items-center gap-2"
            initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            transition={prefersReducedMotion ? undefined : { delay: 1.4, duration: 0.6 }}
          >
            <span className="text-yellow-500" aria-hidden="true">
              ★
            </span>
            <span>AI-Powered</span>
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.section>
  )
}


