'use client'

import { motion, useScroll } from 'framer-motion'

export default function ScrollProgress() {
  const { scrollYProgress } = useScroll()

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-mint-200 via-mint-300 to-mint-200 z-[9999] origin-left"
      style={{ scaleX: scrollYProgress }}
    />
  )
}

