'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, Check, Users, TrendingUp, Shield } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useRef, useState, useEffect, Component, ErrorInfo, ReactNode } from 'react'

// Error Boundary Component
class SplineErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Spline Error Boundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

// Spline import - uncomment when ready to use
// const Spline = dynamic(() => import('@splinetool/react-spline'), { 
//   ssr: false,
//   loading: () => (
//     <div className="w-full h-full flex items-center justify-center bg-mint-50/50 rounded-lg">
//       <div className="text-text-secondary">Loading 3D model...</div>
//     </div>
//   )
// })

const Hero3D = dynamic(() => import('./Hero3D'), { ssr: false })

export default function Hero() {
  const router = useRouter()
  const sectionRef = useRef<HTMLElement>(null)
  const [splineError, setSplineError] = useState(false)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start']
  })
  
  // Parallax effect for 3D visual
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%'])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])
  
  // Stagger animation for headline words
  const headlineWords = "AI-Powered Wellness Planning That Adapts to You".split(' ')

  const handleSplineError = (error: any) => {
    console.error('Spline model failed to load:', error)
    setSplineError(true)
  }

  // Catch any unhandled errors
  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      if (event.message?.includes('Spline') || event.message?.includes('spline')) {
        console.error('Spline error caught:', event.error)
        setSplineError(true)
      }
    }

    window.addEventListener('error', errorHandler)
    return () => window.removeEventListener('error', errorHandler)
  }, [])
  
  return (
    <section 
      ref={sectionRef}
      className="relative min-h-screen pt-32 pb-20 overflow-hidden bg-gradient-to-b from-mint-50 to-white"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            className="z-10"
          >
            {/* Trust Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-mint-100/50 backdrop-blur-sm border border-mint-300/50 rounded-full text-sm font-semibold text-text-primary mb-6"
            >
              <Shield className="w-4 h-4 text-mint-300" />
              <span>Trusted by 50,000+ users</span>
            </motion.div>

            {/* Headline with word stagger - Enhanced with larger size and gradient */}
            <h1 className="hero-headline font-bold mb-6 leading-[1.05] tracking-[-0.03em]">
              {headlineWords.map((word, i) => (
                <motion.span
                  key={i}
                  className="inline-block mr-2"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ 
                    delay: 0.2 + i * 0.1, 
                    duration: 0.6,
                    ease: [0.4, 0, 0.2, 1]
                  }}
                  whileHover={{ scale: 1.1, y: -5 }}
                >
                  {word === 'Adapts' || word === 'You' ? (
                    <span className="gradient-text relative inline-block">
                      {word}
                    </span>
                  ) : (
                    <span className="text-text-primary">{word}</span>
                  )}
                </motion.span>
              ))}
            </h1>

            {/* Value Proposition */}
            <motion.p
              className="text-lg md:text-xl text-text-secondary mb-6 max-w-xl leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            >
              Get personalized wellness insights in minutes. Our AI analyzes your unique profile to create actionable plans that evolve with you.
            </motion.p>

            {/* Social Proof Metrics */}
            <motion.div
              className="flex flex-wrap gap-6 mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.8 }}
            >
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-mint-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-mint-300" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-text-primary">50K+</div>
                  <div className="text-sm text-text-secondary">Active Users</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-mint-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-mint-300" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-text-primary">94%</div>
                  <div className="text-sm text-text-secondary">Satisfaction</div>
                </div>
              </div>
            </motion.div>

            {/* Primary CTA */}
            <motion.div
              className="flex flex-wrap items-center gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.8 }}
            >
              <motion.a
                href="/auth/signin"
                onClick={(e) => {
                  e.preventDefault()
                  router.push('/auth/signin')
                }}
                className="group relative px-8 py-4 bg-mint-100 text-text-primary font-semibold rounded-lg border-2 border-mint-400 hover:bg-mint-200 transition-all shadow-mint-sm hover:shadow-mint-md cursor-pointer inline-flex items-center gap-2 overflow-hidden"
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
              >
                <span className="relative z-10">Start Free Assessment</span>
                <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                {/* Ripple effect */}
                <motion.span
                  className="absolute inset-0 bg-white/20 rounded-lg"
                  initial={{ scale: 0, opacity: 0 }}
                  whileHover={{ scale: 1.5, opacity: [0, 0.3, 0] }}
                  transition={{ duration: 0.6 }}
                />
              </motion.a>
              <motion.a
                href="#how-it-works"
                className="text-text-secondary hover:text-text-primary font-medium underline-offset-4 hover:underline transition-colors"
                whileHover={{ x: 4 }}
              >
                See how it works →
              </motion.a>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              className="flex flex-wrap items-center gap-4 mt-8 pt-8 border-t border-mint-100"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.8 }}
            >
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Check className="w-4 h-4 text-mint-300" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Check className="w-4 h-4 text-mint-300" />
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Check className="w-4 h-4 text-mint-300" />
                <span>HIPAA compliant</span>
              </div>
            </motion.div>
          </motion.div>

          {/* 3D Visual with Parallax and Enhanced Floating */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, rotateY: -15 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ delay: 0.4, duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
            className="relative"
            style={{ y, opacity }}
          >
            {/* Floating animation with rotation */}
            <motion.div
              animate={{ 
                y: [0, -20, 0],
                rotateY: [0, 5, -5, 0],
                rotateX: [0, 3, -3, 0],
              }}
              transition={{ 
                duration: 6, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="hero-3d-container"
            >
              <SplineErrorBoundary
                fallback={
                  <div className="w-full h-full">
                    <Hero3D />
                  </div>
                }
              >
                {/* Temporarily using Hero3D until Spline scene is fixed */}
                {/* Uncomment below and remove Hero3D when Spline scene URL is verified */}
                {/* {splineError ? (
                  <div className="w-full h-full">
                    <Hero3D />
                  </div>
                ) : (
                  <Spline 
                    scene="https://prod.spline.design/a38eafa0-2fa5-4630-983f-6940475adf5e/scene.splinecode"
                    onError={handleSplineError}
                    onLoad={() => {
                      console.log('Spline model loaded successfully')
                    }}
                  />
                )} */}
                <Hero3D />
              </SplineErrorBoundary>
            </motion.div>
            
            {/* Floating mint-colored organic shapes */}
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute hero-organic-shape"
                style={{
                  left: `${15 + i * 18}%`,
                  top: `${25 + (i % 3) * 25}%`,
                  width: `${40 + (i % 3) * 20}px`,
                  height: `${60 + (i % 2) * 30}px`,
                }}
                animate={{
                  y: [0, -40, 0],
                  x: [0, 20, 0],
                  rotate: [0, 180, 360],
                  scale: [1, 1.3, 1],
                  borderRadius: ['30% 70% 70% 30% / 30% 30% 70% 70%', '70% 30% 30% 70% / 70% 70% 30% 30%', '30% 70% 70% 30% / 30% 30% 70% 70%'],
                }}
                transition={{
                  duration: 5 + i * 0.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.4,
                }}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}

