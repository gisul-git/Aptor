'use client'

import { motion } from 'framer-motion'
import { CheckCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import Navbar from '@/components/landing/Navbar'
import Footer from '@/components/landing/Footer'

export default function ThankYouPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-mint-50/30 via-white to-mint-50/20">
      <Navbar />

      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 md:px-8 pt-24 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2, type: 'spring' }}
            className="w-16 h-16 md:w-20 md:h-20 bg-mint-100 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-10 h-10 md:w-12 md:h-12 text-text-primary" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-3xl md:text-4xl font-bold text-text-primary mb-4"
          >
            Thank You for Your Interest!
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-lg md:text-xl text-text-secondary mb-8"
          >
            We've received your demo request. Our team will reach out to you within 24 hours to
            schedule your personalized demo.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="bg-mint-50 rounded-xl p-6 md:p-8 border-2 border-mint-200 mb-8"
          >
            <p className="text-base md:text-lg text-text-secondary">
              In the meantime, check your email for a confirmation and some helpful resources to
              get started.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-mint-200 to-mint-100 hover:from-mint-300 hover:to-mint-200 text-text-primary font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Return to Homepage
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </motion.div>
      </div>

      <Footer />
    </div>
  )
}

