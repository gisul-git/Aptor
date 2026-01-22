'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef, useState } from 'react'
import { Plus, Minus } from 'lucide-react'

const faqs = [
  {
    question: 'How does the AI assessment work?',
    answer: 'Our AI analyzes your responses and behavioral patterns to create a comprehensive wellness profile tailored just for you.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes, we use enterprise-grade encryption and strictly adhere to privacy regulations to ensure your data remains private and secure.',
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Absolutely. You can cancel your subscription at any time with no hidden fees or penalties.',
  },
  {
    question: 'Do you offer a free trial?',
    answer: 'Yes, all paid plans come with a 14-day free trial so you can experience the full benefits risk-free.',
  },
]

export default function FAQ() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  return (
    <section ref={ref} className="py-20 md:py-32">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-text-primary mb-4">
            Frequently Asked Questions
          </h2>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              className="border-2 border-mint-100 rounded-xl overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: index * 0.1, duration: 0.6 }}
            >
              <button
                className="w-full px-6 py-5 bg-white hover:bg-mint-50 transition-colors flex items-center justify-between text-left"
                onClick={() => setActiveIndex(activeIndex === index ? null : index)}
              >
                <span className="font-semibold text-text-primary text-lg">
                  {faq.question}
                </span>
                <motion.div
                  animate={{ rotate: activeIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {activeIndex === index ? (
                    <Minus className="w-5 h-5 text-mint-300" />
                  ) : (
                    <Plus className="w-5 h-5 text-mint-300" />
                  )}
                </motion.div>
              </button>

              <AnimatePresence>
                {activeIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ 
                      duration: 0.4,
                      ease: [0.4, 0, 0.2, 1]
                    }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 py-5 bg-white border-t border-mint-50">
                      <p className="text-text-secondary leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

