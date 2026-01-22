'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Sparkles } from 'lucide-react'
import { useRouter } from 'next/router'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { href: '#features', label: 'Features' },
    { href: '#how-it-works', label: 'How it Works' },
    { href: '#testimonials', label: 'Stories' },
    { href: '#pricing', label: 'Pricing' },
  ]

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      className="fixed top-0 left-0 w-full z-50"
    >
      <motion.div
        className={`w-full transition-all duration-500 ${
          scrolled 
            ? 'bg-white/95 backdrop-blur-xl shadow-lg border-b border-mint-100/50' 
            : 'bg-transparent'
        }`}
        animate={{
          paddingTop: scrolled ? '0.5rem' : '0',
          paddingBottom: scrolled ? '0.5rem' : '0',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <motion.a
              href="#"
              className="flex items-center space-x-2 text-text-primary font-bold text-xl md:text-2xl"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              animate={{ scale: scrolled ? 0.95 : 1 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                animate={{ 
                  rotate: [0, 10, -10, 0],
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Sparkles className="w-6 h-6 text-mint-300" />
              </motion.div>
              <span>Mint Cream AI</span>
            </motion.a>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {navLinks.map((link) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault()
                    const element = document.querySelector(link.href)
                    if (element) {
                      const headerOffset = 100
                      const elementPosition = element.getBoundingClientRect().top
                      const offsetPosition = elementPosition + window.pageYOffset - headerOffset
                      window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                      })
                    }
                  }}
                  className="text-text-secondary hover:text-text-primary font-medium transition-colors"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {link.label}
                </motion.a>
              ))}
              <motion.a
                href="/auth/signin"
                onClick={(e) => {
                  e.preventDefault()
                  router.push('/auth/signin')
                }}
                className="px-6 py-2 bg-mint-100 text-text-primary font-semibold rounded-lg border-2 border-mint-400 hover:bg-mint-200 transition-all shadow-mint-sm hover:shadow-mint-md cursor-pointer"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                Get Started
              </motion.a>
            </div>

            {/* Mobile Menu Button */}
            <motion.button
              className="md:hidden p-2 text-text-primary"
              onClick={() => setIsOpen(!isOpen)}
              whileTap={{ scale: 0.9 }}
            >
              {isOpen ? <X size={28} /> : <Menu size={28} />}
            </motion.button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t border-mint-50 shadow-lg"
            >
              <div className="px-6 py-4 space-y-4">
                {navLinks.map((link) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault()
                    setIsOpen(false)
                    const element = document.querySelector(link.href)
                    if (element) {
                      const headerOffset = 100
                      const elementPosition = element.getBoundingClientRect().top
                      const offsetPosition = elementPosition + window.pageYOffset - headerOffset
                      window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                      })
                    }
                  }}
                  className="block text-text-secondary hover:text-text-primary font-medium py-2"
                  whileTap={{ scale: 0.95 }}
                >
                  {link.label}
                </motion.a>
                ))}
                <motion.a
                  href="/auth/signin"
                  onClick={(e) => {
                    e.preventDefault()
                    setIsOpen(false)
                    router.push('/auth/signin')
                  }}
                  className="block w-full px-6 py-3 bg-mint-100 text-text-primary font-semibold rounded-lg border-2 border-mint-400 text-center hover:bg-mint-200 transition-all cursor-pointer"
                  whileTap={{ scale: 0.95 }}
                >
                  Get Started
                </motion.a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.nav>
  )
}
