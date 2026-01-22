'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef, useState } from 'react'
import { Check, Star, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/router'

const plans = [
  {
    name: 'Starter',
    price: 0,
    priceAnnual: 0,
    period: '/mo',
    features: [
      'Basic Assessment',
      'Weekly Insights',
      'Community Access',
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Growth',
    price: 29,
    priceAnnual: 24,
    period: '/mo',
    features: [
      'Advanced AI Assessment',
      'Daily Insights',
      'Priority Support',
      'Custom Roadmap',
    ],
    cta: 'Start Free Trial',
    popular: true,
    savings: 'Save 17%',
  },
  {
    name: 'Pro',
    price: 79,
    priceAnnual: 65,
    period: '/mo',
    features: [
      'Everything in Growth',
      '1-on-1 Coaching',
      'API Access',
      'Team Features',
    ],
    cta: 'Contact Sales',
    popular: false,
    savings: 'Save 18%',
  },
]

export default function Pricing() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })
  const router = useRouter()
  const [isAnnual, setIsAnnual] = useState(false)

  return (
    <section id="pricing" ref={ref} className="py-20 md:py-32 bg-mint-50/30">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-text-primary mb-6">
            Simple, Transparent Pricing
          </h2>
          
          {/* Annual/Monthly Toggle */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className={`text-sm font-medium ${!isAnnual ? 'text-text-primary' : 'text-text-secondary'}`}>
              Monthly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                isAnnual ? 'bg-mint-200' : 'bg-mint-100'
              }`}
            >
              <motion.div
                className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md"
                animate={{ x: isAnnual ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
            <span className={`text-sm font-medium ${isAnnual ? 'text-text-primary' : 'text-text-secondary'}`}>
              Annual
            </span>
            {isAnnual && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-3 py-1 bg-mint-200 text-text-primary text-xs font-semibold rounded-full"
              >
                Save up to 18%
              </motion.span>
            )}
          </div>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              className={`bg-white rounded-2xl p-8 border-2 ${
                plan.popular
                  ? 'border-mint-300 shadow-mint-lg scale-105 relative bg-gradient-to-br from-mint-50 to-white'
                  : 'border-mint-50'
              } hover:shadow-mint-md transition-all`}
              style={plan.popular ? {
                boxShadow: '0 30px 60px rgba(157, 232, 176, 0.3)',
                borderWidth: '3px'
              } : {}}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: index * 0.2, duration: 0.6 }}
              whileHover={{ y: -8 }}
            >
              {plan.popular && (
                <motion.div
                  className="absolute -top-6 left-1/2 -translate-x-1/2"
                  animate={{ 
                    scale: [1, 1.05, 1],
                    boxShadow: [
                      '0 4px 20px rgba(157, 232, 176, 0.3)',
                      '0 6px 30px rgba(157, 232, 176, 0.5)',
                      '0 4px 20px rgba(157, 232, 176, 0.3)'
                    ]
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <span className="bg-gradient-to-r from-mint-300 to-mint-200 text-white px-6 py-2 rounded-full text-sm font-bold flex items-center gap-1 shadow-lg">
                    <Star size={14} className="fill-current" />
                    ✨ BEST VALUE
                  </span>
                </motion.div>
              )}

              <h3 className="text-2xl font-semibold text-text-primary mb-4">
                {plan.name}
              </h3>

              <div className="mb-6">
                <motion.div 
                  className="flex items-baseline gap-2"
                  key={isAnnual ? 'annual' : 'monthly'}
                  initial={{ rotateX: 90, opacity: 0 }}
                  animate={{ rotateX: 0, opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <span className="text-7xl font-extrabold text-text-primary">
                    ${isAnnual ? plan.priceAnnual : plan.price}
                  </span>
                  <span className="text-xl text-text-secondary">{plan.period}</span>
                </motion.div>
                {isAnnual && plan.savings && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 text-sm text-mint-300 font-semibold"
                  >
                    {plan.savings}
                  </motion.div>
                )}
                {isAnnual && (
                  <div className="mt-1 text-xs text-text-subtle">
                    Billed annually (${(isAnnual ? plan.priceAnnual : plan.price) * 12}/year)
                  </div>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-mint-300 flex-shrink-0 mt-0.5" />
                    <span className="text-text-secondary">{feature}</span>
                  </li>
                ))}
              </ul>

              <motion.a
                href="/auth/signin"
                onClick={(e) => {
                  e.preventDefault()
                  router.push('/auth/signin')
                }}
                className={`group relative block w-full px-6 py-4 rounded-lg font-semibold text-center transition-all cursor-pointer overflow-hidden ${
                  plan.popular
                    ? 'bg-mint-100 text-text-primary border-2 border-mint-400 hover:bg-mint-200 shadow-mint-sm'
                    : 'bg-white text-text-secondary border-2 border-mint-100 hover:bg-mint-50'
                }`}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {plan.cta}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
                {/* Hover glow effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-mint-200/0 via-mint-200/20 to-mint-200/0"
                  initial={{ x: '-100%' }}
                  whileHover={{ x: '100%' }}
                  transition={{ duration: 0.6 }}
                />
              </motion.a>
              
              {plan.name === 'Starter' && (
                <p className="mt-4 text-center text-xs text-text-subtle">
                  ✓ No credit card required
                </p>
              )}
              {plan.name === 'Growth' && (
                <p className="mt-4 text-center text-xs text-text-subtle">
                  ✓ 14-day free trial • Cancel anytime
                </p>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

