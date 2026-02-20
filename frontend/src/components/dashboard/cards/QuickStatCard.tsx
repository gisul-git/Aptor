"use client"

import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import CountUp from "react-countup"
import { LucideIcon, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface QuickStatCardProps {
  value: number | string
  label: string
  trend?: { value: number; isPositive: boolean }
  icon: LucideIcon
  suffix?: string
  progress?: number // 0-100 for progress ring
}

export function QuickStatCard({
  value,
  label,
  trend,
  icon: Icon,
  suffix = "",
  progress,
}: QuickStatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="h-full"
    >
      <Card className="h-full bg-gradient-to-b from-white to-mint-50/50 border-mint-100 rounded-2xl shadow-[0_2px_8px_rgba(201,244,212,0.12)] hover:shadow-[0_8px_24px_rgba(201,244,212,0.25)] hover:border-mint-200 transition-all">
        <CardContent className="p-6 h-full flex flex-col items-center text-center">
          {/* Icon */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-mint-100 to-mint-50 border border-mint-200 flex items-center justify-center mb-4">
            <Icon className="h-6 w-6 text-mint-200" />
          </div>

          {/* Number */}
          <div className="mb-3">
            {typeof value === "number" ? (
              <CountUp
                end={value}
                duration={2}
                decimals={value % 1 !== 0 ? 1 : 0}
                className="text-[48px] font-extrabold text-text-primary"
                style={{ textShadow: "0 2px 4px rgba(30, 90, 59, 0.08)" }}
              />
            ) : (
              <span className="text-[48px] font-extrabold text-text-primary" style={{ textShadow: "0 2px 4px rgba(30, 90, 59, 0.08)" }}>{value}</span>
            )}
            {suffix && <span className="text-[48px] font-extrabold text-text-primary">{suffix}</span>}
          </div>

          {/* Label */}
          <p className="text-sm font-medium text-text-secondary mb-4">{label}</p>

          {/* Trend */}
          {trend && (
            <div className="mb-4">
              <div className="inline-flex items-center space-x-1 text-xs font-semibold text-mint-200">
                <TrendingUp className="h-3 w-3" />
                <span>
                  {trend.isPositive ? "+" : "-"}
                  {Math.abs(trend.value)}%
                </span>
              </div>
            </div>
          )}

          {/* Progress Ring */}
          {progress !== undefined && (
            <div className="mt-auto relative">
              <svg className="w-[120px] h-[120px] transform -rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  stroke="#E8FAF0"
                  strokeWidth="8"
                  fill="none"
                />
                <motion.circle
                  cx="60"
                  cy="60"
                  r="52"
                  stroke="#80EFC0"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - progress / 100) }}
                  transition={{ duration: 1.5, delay: 0.5 }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-text-primary">{progress}%</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

