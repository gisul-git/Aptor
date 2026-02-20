"use client"

import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import CountUp from "react-countup"
import { Users, ArrowRight } from "lucide-react"
import Link from "next/link"

interface ActiveCandidatesCardProps {
  value: number
  liveCount: number
}

export function ActiveCandidatesCard({ value, liveCount }: ActiveCandidatesCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
    >
      <Card className="h-full bg-gradient-to-br from-mint-100 to-mint-200 border-0 rounded-2xl shadow-[0_4px_20px_rgba(128,239,192,0.3)] hover:shadow-[0_6px_24px_rgba(128,239,192,0.4)] transition-all overflow-hidden" style={{ boxShadow: "inset 0 2px 4px rgba(255, 255, 255, 0.3), 0 4px 20px rgba(128, 239, 192, 0.3)" }}>
        <CardContent className="p-6 h-full flex flex-col justify-between">
          {/* Icon Area */}
          <div className="w-fit p-3 rounded-2xl bg-white/30 backdrop-blur-sm mb-4">
            <Users className="h-10 w-10 text-text-primary" />
          </div>

          {/* Number */}
          <div className="mb-2">
            <CountUp
              end={value}
              duration={2}
              className="text-[56px] font-black text-text-primary leading-none"
              style={{ textShadow: "0 2px 4px rgba(30, 90, 59, 0.1)" }}
            />
          </div>

          {/* Label */}
          <p className="text-sm font-medium text-text-primary mb-4">Active Candidates</p>

          {/* Live Indicator */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/40 backdrop-blur-sm mb-4 w-fit">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-3 h-3 rounded-full bg-green-500"
            />
            <span className="text-[13px] font-medium text-text-primary">{liveCount} live now</span>
          </div>

          {/* CTA Link */}
          <Link
            href="/dashboard/candidates?status=live"
            className="inline-flex items-center space-x-2 text-[13px] font-medium text-text-primary hover:text-mint-200 transition-colors group mt-auto"
          >
            <span>View Live</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  )
}

