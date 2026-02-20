"use client"

import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface WelcomeSectionProps {
  userName: string
  activeAssessments: number
  needsAttention: number
}

export function WelcomeSection({ userName, activeAssessments, needsAttention }: WelcomeSectionProps) {
  const currentHour = new Date().getHours()
  const greeting = currentHour < 12 ? "Good Morning" : currentHour < 18 ? "Good Afternoon" : "Good Evening"

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full"
    >
      <div className="bg-gradient-to-r from-mint-50 to-mint-100 border border-mint-100/50 rounded-3xl p-8">
        <div>
          <h2 className="text-[32px] font-bold text-text-primary mb-4">
            {greeting}, {userName}{" "}
            <motion.span
              animate={{ rotate: [0, 20, -8, 20, -8, 0] }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="inline-block"
            >
              👋
            </motion.span>
          </h2>
          
          {/* Interactive Pills */}
          <div className="flex items-center flex-wrap gap-3 mt-4">
            <Link
              href="/dashboard/assessments?status=active"
              className="group inline-flex items-center px-4 py-2 rounded-full bg-white/80 border border-mint-100 text-sm font-medium text-text-primary hover:scale-105 hover:shadow-[0_4px_12px_rgba(201,244,212,0.3)] transition-all cursor-pointer"
            >
              <span>{activeAssessments} Active</span>
            </Link>
            
            <Link
              href="/dashboard/assessments?status=attention"
              className="group inline-flex items-center px-4 py-2 rounded-full bg-white/80 border border-red-200 text-sm font-medium text-text-primary hover:scale-105 hover:shadow-[0_4px_12px_rgba(254,226,226,0.4)] transition-all cursor-pointer"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-red-500 mr-2"
              />
              <span>{needsAttention} Need Attention</span>
            </Link>
            
            <Link
              href="/dashboard/assessments?status=draft"
              className="group inline-flex items-center px-4 py-2 rounded-full bg-white/80 border border-mint-100 text-sm font-medium text-text-primary hover:scale-105 hover:shadow-[0_4px_12px_rgba(201,244,212,0.3)] transition-all cursor-pointer"
            >
              <span>5 Drafts</span>
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

