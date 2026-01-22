'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'
import { Quote, Star } from 'lucide-react'

const testimonials = [
  {
    quote: 'Mint Cream AI has completely transformed how I approach my health. It feels so natural and intuitive.',
    author: 'Sarah Jenkins',
    role: 'Yoga Instructor',
    rating: 5,
  },
  {
    quote: 'The insights are incredibly accurate. It\'s like having a personal wellness coach in my pocket.',
    author: 'Michael Chen',
    role: 'Software Engineer',
    rating: 5,
  },
  {
    quote: 'I love the design! It\'s so calming to use, unlike other stressful health apps.',
    author: 'Emma Wilson',
    role: 'Designer',
    rating: 5,
  },
]

export default function Testimonials() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })
  const [currentIndex, setCurrentIndex] = useState(0)

  // Auto-rotate testimonials
  useEffect(() => {
    if (!isInView) return
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [isInView])

  return (
    <section id="testimonials" ref={ref} className="py-20 md:py-32 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-text-primary mb-4">
            What Our Customers Say
          </h2>
        </motion.div>

        {/* Desktop: Grid Layout */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              className="bg-white rounded-2xl p-8 shadow-mint-sm border-l-4 border-mint-100 hover:shadow-mint-md transition-shadow relative overflow-hidden group"
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ delay: index * 0.15, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              whileHover={{ y: -12, scale: 1.02, rotateY: 5 }}
              style={{ perspective: '1000px' }}
            >
              {/* Floating quote mark */}
              <motion.div
                className="absolute top-4 right-4"
                animate={{ 
                  y: [0, -5, 0],
                  opacity: [0.3, 0.6, 0.3]
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Quote className="w-16 h-16 text-mint-200/30" />
              </motion.div>

              <div className="relative z-10">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={isInView ? { opacity: 1, scale: 1 } : {}}
                      transition={{ delay: index * 0.15 + i * 0.1 }}
                    >
                      <Star className="w-5 h-5 fill-mint-300 text-mint-300" />
                    </motion.div>
                  ))}
                </div>
                <p className="text-text-secondary italic mb-6 leading-relaxed relative z-10">
                  "{testimonial.quote}"
                </p>
                <div>
                  <h4 className="font-semibold text-text-primary">
                    {testimonial.author}
                  </h4>
                  <p className="text-sm text-text-subtle">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile: Carousel */}
        <div className="md:hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              className="bg-white rounded-2xl p-8 shadow-mint-md border-l-4 border-mint-200"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className="absolute top-4 right-4"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Quote className="w-12 h-12 text-mint-200/30" />
              </motion.div>
              <div className="flex gap-1 mb-4">
                {[...Array(testimonials[currentIndex].rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-mint-300 text-mint-300" />
                ))}
              </div>
              <p className="text-text-secondary italic mb-6 leading-relaxed">
                "{testimonials[currentIndex].quote}"
              </p>
              <div>
                <h4 className="font-semibold text-text-primary">
                  {testimonials[currentIndex].author}
                </h4>
                <p className="text-sm text-text-subtle">{testimonials[currentIndex].role}</p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Carousel Dots */}
          <div className="flex justify-center gap-2 mt-6">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentIndex ? 'bg-mint-300 w-8' : 'bg-mint-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

