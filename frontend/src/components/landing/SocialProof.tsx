'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, useEffect, useState } from 'react'
import { Star } from 'lucide-react'

// Counter animation component
const Counter = ({ end, duration = 2, isInView }: { end: number; duration?: number; isInView: boolean }) => {
  const [count, setCount] = useState(0)
  const countRef = useRef<HTMLSpanElement>(null)
  
  useEffect(() => {
    if (!isInView) return
    
    let start = 0
    const increment = end / (duration * 60) // 60fps
    const timer = setInterval(() => {
      start += increment
      if (start >= end) {
        start = end
        clearInterval(timer)
      }
      setCount(Math.floor(start))
    }, 1000 / 60)
    
    return () => clearInterval(timer)
  }, [isInView, end, duration])
  
  return <span ref={countRef}>{count.toLocaleString()}+</span>
}

export default function SocialProof() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  const logos = ['WellnessCo', 'NaturePath', 'GreenLife', 'PureMind', 'Vitality']

  return (
    <section
      ref={ref}
      className="py-20 bg-white border-y border-mint-100"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Main Stats */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1, duration: 0.6 }}
          >
            <div className="text-5xl font-bold text-text-primary mb-2">
              <Counter end={50000} isInView={isInView} />
            </div>
            <div className="text-text-secondary">Active Users</div>
          </motion.div>
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <div className="text-5xl font-bold text-text-primary mb-2">
              <Counter end={94} isInView={isInView} />%
            </div>
            <div className="text-text-secondary">Satisfaction Rate</div>
          </motion.div>
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <div className="flex items-center justify-center gap-1 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-6 h-6 fill-mint-300 text-mint-300" />
              ))}
            </div>
            <div className="text-text-secondary">4.9/5 Average Rating</div>
          </motion.div>
        </div>

        {/* Logo Bar */}
        <div className="text-center">
          <motion.p
            className="text-text-secondary font-semibold mb-8 text-sm uppercase tracking-wider"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            Trusted by leading wellness companies
          </motion.p>

          {/* Infinite Marquee */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-white via-transparent to-white z-10 pointer-events-none" />
            <motion.div
              className="flex gap-12"
              animate={{ x: [0, -1000] }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "linear",
              }}
              style={{ width: 'fit-content' }}
            >
              {/* Duplicate logos for seamless loop */}
              {[...logos, ...logos, ...logos].map((logo, index) => (
                <motion.div
                  key={`${logo}-${index}`}
                  className="px-6 py-3 bg-mint-50 rounded-lg border border-mint-100 flex-shrink-0"
                  whileHover={{ scale: 1.1, y: -4 }}
                >
                  <span className="text-text-subtle font-bold text-lg whitespace-nowrap">{logo}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}

