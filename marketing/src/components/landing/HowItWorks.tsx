'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { UserPlus, ClipboardCheck, Rocket } from 'lucide-react'

const steps = [
  {
    number: 1,
    icon: UserPlus,
    title: 'Create Profile',
    description: 'Sign up in seconds and tell us about your wellness goals.',
  },
  {
    number: 2,
    icon: ClipboardCheck,
    title: 'Take Assessment',
    description: 'Complete our AI-powered assessment to establish your baseline.',
  },
  {
    number: 3,
    icon: Rocket,
    title: 'Get Plan',
    description: 'Receive your personalized growth plan and start your journey.',
  },
]

export default function HowItWorks() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section id="how-it-works" ref={ref} className="py-20 md:py-32 bg-mint-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-text-primary mb-4">
            Getting Started is Easy
          </h2>
        </motion.div>

        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Animated SVG connecting line for desktop */}
            <div className="hidden md:block absolute top-16 left-0 right-0 h-2 -z-10 overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 1000 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="mintGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#C9F4D4" />
                    <stop offset="100%" stopColor="#9DE8B0" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M 50 50 Q 500 50 950 50"
                  stroke="url(#mintGradient)"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray="0 1"
                  initial={{ pathLength: 0 }}
                  animate={isInView ? { pathLength: 1 } : {}}
                  transition={{ duration: 2, delay: 0.5, ease: "easeInOut" }}
                />
              </svg>
            </div>

            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                className="text-center relative"
                initial={{ opacity: 0, y: 50, scale: 0.8 }}
                animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{ 
                  delay: index * 0.2, 
                  duration: 0.7,
                  ease: [0.4, 0, 0.2, 1],
                  type: 'spring',
                  stiffness: 100
                }}
              >
                {/* Step number badge - Larger and more prominent */}
                <motion.div
                  className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-gradient-to-br from-mint-300 to-mint-200 rounded-full flex items-center justify-center text-xl font-bold text-white z-20 shadow-lg"
                  style={{
                    boxShadow: '0 4px 20px rgba(157, 232, 176, 0.4)'
                  }}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={isInView ? { scale: 1, rotate: 0 } : {}}
                  transition={{ delay: index * 0.2 + 0.3, type: 'spring', stiffness: 200 }}
                >
                  {step.number}
                </motion.div>
                
                <motion.div
                  className="w-32 h-32 mx-auto mb-6 bg-mint-100 rounded-full flex items-center justify-center border-4 border-white shadow-mint-md relative z-10 group"
                  whileHover={{ scale: 1.15, rotate: 10 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  <motion.div
                    animate={isInView ? { 
                      rotate: [0, 5, -5, 0],
                      scale: [1, 1.1, 1]
                    } : {}}
                    transition={{ 
                      delay: index * 0.2 + 0.5,
                      duration: 0.6,
                      ease: "easeInOut"
                    }}
                  >
                    <step.icon className="w-12 h-12 text-text-primary group-hover:text-mint-300 transition-colors" />
                  </motion.div>
                </motion.div>
                <h3 className="text-2xl font-semibold text-text-primary mb-3">
                  {step.title}
                </h3>
                <p className="text-text-secondary leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

