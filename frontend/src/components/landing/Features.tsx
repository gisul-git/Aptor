'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { Leaf, Sparkles, TrendingUp, Heart, Shield, Users } from 'lucide-react'

const features = [
  {
    icon: Leaf,
    title: 'Organic Insights',
    description: 'Our AI analyzes your data to provide natural, actionable insights that grow with you.',
    color: 'text-mint-300',
    featured: true,
  },
  {
    icon: Sparkles,
    title: 'Smart Assessment',
    description: 'Advanced algorithms that understand the nuances of your wellness journey.',
    color: 'text-mint-200',
    featured: true,
  },
  {
    icon: TrendingUp,
    title: 'Growth Tracking',
    description: 'Visualize your progress with beautiful, calming charts and milestones.',
    color: 'text-mint-400',
  },
  {
    icon: Heart,
    title: 'Holistic Health',
    description: 'We look at the big picture, connecting mental and physical well-being.',
    color: 'text-mint-300',
  },
  {
    icon: Shield,
    title: 'Private & Secure',
    description: 'Your data is protected with enterprise-grade security. Your peace of mind matters.',
    color: 'text-mint-200',
  },
  {
    icon: Users,
    title: 'Community Support',
    description: 'Join a thriving community of like-minded individuals on the same path.',
    color: 'text-mint-400',
  },
]

export default function Features() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section id="features" ref={ref} className="py-20 md:py-32">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-text-primary mb-4">
            Natural Growth, Powered by AI
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className={`bg-white border-2 border-mint-50 rounded-2xl hover:border-mint-200 hover:shadow-mint-md transition-all group relative overflow-hidden ${
                feature.featured 
                  ? 'md:col-span-2 p-12 bg-gradient-to-br from-mint-50 to-white' 
                  : 'p-8'
              }`}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ 
                delay: index * 0.1, 
                duration: 0.6,
                ease: [0.4, 0, 0.2, 1]
              }}
              whileHover={{ y: -8, scale: feature.featured ? 1.03 : 1.02 }}
            >
              {/* Hover gradient overlay */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-mint-50/0 to-mint-100/0 group-hover:from-mint-50/50 group-hover:to-mint-100/30 transition-all duration-300"
                initial={false}
              />
              
              <div className="relative z-10">
                <div className="mb-6">
                  <motion.div 
                    className={`inline-flex rounded-2xl bg-mint-100/20 backdrop-blur-sm border border-mint-300/20 ${
                      feature.featured ? 'p-6' : 'p-4'
                    }`}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <motion.div
                      animate={isInView ? {
                        // Icon-specific animations based on feature
                        ...(feature.title === 'Organic Insights' ? {
                          rotate: [0, 5, -5, 0],
                        } : feature.title === 'Smart Assessment' ? {
                          scale: [1, 1.1, 1],
                        } : feature.title === 'Growth Tracking' ? {
                          y: [0, -5, 0],
                        } : feature.title === 'Holistic Health' ? {
                          scale: [1, 1.15, 1],
                        } : feature.title === 'Private & Secure' ? {
                          rotate: [0, 10, -10, 0],
                        } : {
                          y: [0, -3, 0],
                        })
                      } : {}}
                      transition={{ 
                        duration: 2, 
                        repeat: Infinity,
                        delay: index * 0.3,
                        ease: "easeInOut"
                      }}
                    >
                      <feature.icon
                        className={`${feature.featured ? 'w-14 h-14' : 'w-8 h-8'} ${feature.color} transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12`}
                      />
                    </motion.div>
                  </motion.div>
                </div>
                <h3 className={`font-semibold text-text-primary mb-3 ${
                  feature.featured ? 'text-2xl' : 'text-xl'
                }`}>
                  {feature.title}
                </h3>
                <p className="text-text-secondary leading-relaxed mb-4">
                  {feature.description}
                </p>
                {/* Pulse indicator on hover */}
                <motion.div
                  className="flex items-center gap-2 text-sm text-mint-300 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                  initial={false}
                >
                  Learn more →
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

