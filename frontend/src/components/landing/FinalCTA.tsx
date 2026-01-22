'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { ArrowRight } from 'lucide-react'
import { useRouter } from 'next/router'

export default function FinalCTA() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })
  const router = useRouter()

  return (
    <section ref={ref} className="py-20 md:py-32 relative overflow-hidden">
      {/* Animated gradient background */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            'linear-gradient(135deg, #C9F4D4 0%, #9DE8B0 100%)',
            'linear-gradient(135deg, #9DE8B0 0%, #B0EFC0 100%)',
            'linear-gradient(135deg, #B0EFC0 0%, #C9F4D4 100%)',
            'linear-gradient(135deg, #C9F4D4 0%, #9DE8B0 100%)',
          ]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />

      {/* Floating sparkles */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl"
          style={{
            left: `${10 + (i * 12)}%`,
            top: `${20 + (i % 3) * 30}%`,
          }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 2 + (i % 2),
            repeat: Infinity,
            delay: i * 0.3,
            ease: "easeInOut"
          }}
        >
          ✨
        </motion.div>
      ))}

      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div 
          className="absolute -top-24 -right-24 w-96 h-96 bg-mint-200 rounded-full blur-3xl opacity-40"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 20, 0],
            y: [0, -20, 0],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute -bottom-24 -left-24 w-96 h-96 bg-powder rounded-full blur-3xl opacity-40"
          animate={{
            scale: [1, 1.3, 1],
            x: [0, -20, 0],
            y: [0, 20, 0],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-text-primary mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-text-primary mb-6 max-w-2xl mx-auto">
            Join 50,000+ happy customers and transform your wellness journey today.
          </p>

          {/* Urgency Banner */}
          <motion.div
            className="urgency-banner inline-flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full mb-8 shadow-mint-sm"
            initial={{ scale: 0.9, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <motion.span
              className="pulse-dot w-2 h-2 bg-mint-300 rounded-full"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [1, 0.5, 1]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-sm font-semibold text-text-primary">
              ⚡ 47 people joined in the last hour
            </span>
          </motion.div>

          <motion.a
            href="/auth/signin"
            onClick={(e) => {
              e.preventDefault()
              router.push('/auth/signin')
            }}
            className="group relative inline-flex items-center gap-2 px-10 py-5 bg-white text-text-primary font-bold rounded-lg shadow-mint-lg hover:shadow-mint-md transition-all text-lg border-2 border-mint-400 cursor-pointer overflow-hidden"
            whileHover={{ scale: 1.08, y: -4 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="relative z-10">Start Your Free Trial</span>
            <motion.span
              className="relative z-10"
              animate={{ x: [0, 5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ArrowRight className="w-5 h-5" />
            </motion.span>
            {/* Magnetic hover effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-mint-100/0 via-mint-200/30 to-mint-100/0"
              initial={{ x: '-100%' }}
              whileHover={{ x: '100%' }}
              transition={{ duration: 0.6 }}
            />
          </motion.a>

          <p className="mt-6 text-sm text-text-secondary flex items-center justify-center gap-4 flex-wrap">
            <span className="flex items-center gap-1">
              ✓ No credit card required
            </span>
            <span className="flex items-center gap-1">
              ✓ Cancel anytime
            </span>
            <span className="flex items-center gap-1">
              ✓ 14-day free trial
            </span>
          </p>
        </motion.div>
      </div>
    </section>
  )
}

