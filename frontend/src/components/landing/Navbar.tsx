'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Search, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/router'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeNav, setActiveNav] = useState('Platform')
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const navRefs = useRef<(HTMLButtonElement | null)[]>([])
  const router = useRouter()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close search on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSearchOpen(false)
      }
    }
    if (isSearchOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearchOpen])

  const navLinks = [
    { label: 'Features' },
    { label: 'How It Works?' },
    { label: 'Use Cases' },
  ]

  useEffect(() => {
    const activeIndex = navLinks.findIndex(link => link.label === activeNav)
    const activeButton = navRefs.current[activeIndex]
    if (activeButton) {
      const container = activeButton.parentElement
      if (container) {
        const containerRect = container.getBoundingClientRect()
        const buttonRect = activeButton.getBoundingClientRect()
        setIndicatorStyle({
          left: buttonRect.left - containerRect.left,
          width: buttonRect.width,
        })
      }
    }
  }, [activeNav])

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="max-w-[1250px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-3 md:py-5 transition-all duration-300 ease-in-out">
        <div
          className={`flex items-center justify-between transition-all duration-300 ease-in-out ${
            scrolled
              ? 'bg-white/70 backdrop-blur-md rounded-[24px] border border-white/20 shadow-[0_8px_32px_rgba(201,244,212,0.3)] p-2 md:p-3'
              : 'bg-transparent border-transparent'
          }`}
        >
          {/* LEFT: Logo */}
          <a href="/" className="flex items-center">
            <div className="relative h-9 w-auto flex items-center">
              <Image
                src="/Aaptor%20Logo.png"
                alt="Aaptor logo"
                width={120}
                height={40}
                priority
                className="h-9 w-auto object-contain"
              />
            </div>
          </a>

          {/* CENTER: Simple text navigation */}
          <nav className="hidden lg:flex items-center justify-center flex-1">
            <div className="flex items-center gap-8">
              {navLinks.map((link, index) => (
                <button
                  key={link.label}
                  ref={(el) => {
                    navRefs.current[index] = el
                  }}
                  onClick={() => setActiveNav(link.label)}
                  className={`text-sm transition-colors duration-200 ${
                    activeNav === link.label
                      ? 'font-semibold text-black'
                      : 'font-normal text-black/60 hover:text-black'
                  }`}
                >
                  {link.label}
                </button>
              ))}
            </div>
          </nav>

          {/* RIGHT: Search, CTA */}
          <div className="flex items-center gap-3 md:gap-4">
            {/* Search Icon Button */}
            <button
              className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors"
              aria-label="Search"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search className="w-4 h-4 text-black" />
            </button>

            {/* Schedule a Demo CTA */}
            <button
              onClick={() => router.push('/schedule-demo')}
              className="hidden md:inline-flex items-center rounded-full bg-[#C9F4D4] text-[#1E5A3B] text-sm font-semibold pl-5 pr-1 py-1.5 shadow-[0_10px_30px_rgba(157,232,176,0.35)] border border-[#9DE8B0] hover:bg-[#B0EFC0] transition-colors duration-200"
            >
              <span className="mr-3">Schedule a Demo</span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#1E5A3B] shadow-[0_4px_14px_rgba(30,90,59,0.25)]">
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>

            {/* Mobile Hamburger Menu */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden w-11 h-11 rounded-xl active:bg-black/5 flex items-center justify-center transition-colors"
              aria-label="Menu"
            >
              {isOpen ? <X className="w-5 h-5 text-black" /> : <Menu className="w-5 h-5 text-black" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden mt-2 bg-white/70 backdrop-blur-md rounded-[24px] border border-white/20 shadow-[0_8px_32px_rgba(201,244,212,0.3)] overflow-hidden"
            >
              <div className="px-6 py-4 space-y-3">
                {navLinks.map((link) => (
                  <button
                    key={link.label}
                    onClick={() => {
                      setActiveNav(link.label)
                      setIsOpen(false)
                    }}
                    className={`block w-full text-left py-2 px-3 rounded-lg text-sm transition-colors ${
                      activeNav === link.label
                        ? 'bg-[#C9F4D4] text-[#1E5A3B] font-medium'
                        : 'text-black/60 font-light hover:bg-black/5'
                    }`}
                  >
                    {link.label}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setIsOpen(false)
                    router.push('/schedule-demo')
                  }}
                  className=" w-full px-4 py-2 rounded-full bg-[#C9F4D4] text-[#1E5A3B] text-sm font-semibold shadow-[0_10px_30px_rgba(157,232,176,0.35)] border border-[#9DE8B0] flex items-center justify-center gap-2 hover:bg-[#B0EFC0] transition-colors"
                >
                  <span>Schedule a Demo</span>
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#1E5A3B] shadow-[0_4px_14px_rgba(30,90,59,0.25)]">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search Overlay */}
        <AnimatePresence>
          {isSearchOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSearchOpen(false)}
              />

              {/* Panel */}
              <motion.div
                className="fixed inset-0 z-50 flex items-start justify-center pt-28 px-4"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 10 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                onClick={() => setIsSearchOpen(false)}
              >
                <div
                  className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-[#E5E7EB] overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header / search input */}
                  <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search capabilities, roles, or skills"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-transparent bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2D7A52] focus:border-[#2D7A52]"
                      />
                    </div>
                    <button
                      onClick={() => setIsSearchOpen(false)}
                      className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
                      aria-label="Close search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Content list (static, illustrative) */}
                  <div className="px-6 py-4 max-h-[380px] overflow-y-auto">
                    <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
                      Suggested capability journeys
                    </p>
                    <div className="space-y-2.5">
                      {[
                        {
                          title: 'Full-Stack Developer',
                          subtitle: 'Front-End, Back-End, and Database competencies',
                        },
                        {
                          title: 'Data Engineer',
                          subtitle: 'ETL, pipelines, and warehouse capabilities',
                        },
                        {
                          title: 'Cloud & DevOps',
                          subtitle: 'AWS, Kubernetes, CI/CD, and reliability skills',
                        },
                      ].map((item) => (
                        <button
                          key={item.title}
                          className="w-full text-left rounded-2xl border border-[#E5E7EB] px-4 py-3.5 hover:border-[#C9F4D4] hover:bg-[#F9FFFB] transition-colors"
                        >
                          <div className="text-sm font-semibold text-gray-900">
                            {item.title}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">{item.subtitle}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}
