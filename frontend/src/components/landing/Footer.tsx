'use client'

import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

const footerLinks = {
  Product: ['Features', 'Pricing', 'Enterprise'],
  Company: ['About Us', 'Careers', 'Blog'],
  Legal: ['Privacy Policy', 'Terms of Service', 'Cookie Policy'],
}

export default function Footer() {
  return (
    <footer className="bg-text-primary text-white py-16">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Trust Indicators */}
        <div className="grid md:grid-cols-4 gap-6 mb-12 pb-12 border-b border-white/10">
          <div className="text-center md:text-left">
            <div className="text-2xl font-bold text-mint-200 mb-2">256-bit</div>
            <div className="text-sm text-mint-100/80">SSL Encryption</div>
          </div>
          <div className="text-center md:text-left">
            <div className="text-2xl font-bold text-mint-200 mb-2">HIPAA</div>
            <div className="text-sm text-mint-100/80">Compliant</div>
          </div>
          <div className="text-center md:text-left">
            <div className="text-2xl font-bold text-mint-200 mb-2">SOC 2</div>
            <div className="text-sm text-mint-100/80">Certified</div>
          </div>
          <div className="text-center md:text-left">
            <div className="text-2xl font-bold text-mint-200 mb-2">99.9%</div>
            <div className="text-sm text-mint-100/80">Uptime</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <motion.a
              href="#"
              className="flex items-center space-x-2 mb-4"
              whileHover={{ scale: 1.05 }}
            >
              <Sparkles className="w-6 h-6 text-mint-200" />
              <span className="text-2xl font-bold">Mint Cream AI</span>
            </motion.a>
            <p className="text-mint-200 max-w-xs leading-relaxed mb-4">
              Empowering your wellness journey with natural intelligence.
            </p>
            <div className="flex items-center gap-4">
              <span className="text-sm text-mint-100/80">Money-back guarantee</span>
              <span className="text-mint-100/50">•</span>
              <span className="text-sm text-mint-100/80">30-day free trial</span>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-semibold mb-4">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link}>
                    <motion.a
                      href="#"
                      className="text-mint-100 hover:text-mint-200 transition-colors opacity-80 hover:opacity-100"
                      whileHover={{ x: 4 }}
                    >
                      {link}
                    </motion.a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Copyright */}
        <div className="pt-8 border-t border-white/10 text-center">
          <p className="text-mint-200 text-sm">
            © 2024 Mint Cream AI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

