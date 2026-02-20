"use client"

import { motion } from "framer-motion"
import { FileText, TrendingUp, MoreVertical, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import CountUp from "react-countup"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LineChart, Line, ResponsiveContainer, Area, AreaChart } from "recharts"
import { cn } from "@/lib/utils"
import Link from "next/link"

const sparklineData = [
  { value: 42 },
  { value: 48 },
  { value: 45 },
  { value: 52 },
  { value: 50 },
  { value: 55 },
  { value: 58 },
  { value: 62 },
  { value: 60 },
  { value: 65 },
  { value: 68 },
  { value: 72 },
]

interface HeroMetricCardProps {
  value: number
  label: string
  trend: { value: number; isPositive: boolean }
  icon?: React.ComponentType<{ className?: string }>
}

export function HeroMetricCard({ value, label, trend, icon: Icon = FileText }: HeroMetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="h-full"
    >
      <Card className="h-full bg-gradient-to-b from-white to-mint-50/30 border-mint-100 rounded-3xl shadow-[0_2px_8px_rgba(201,244,212,0.12)] hover:shadow-[0_8px_24px_rgba(201,244,212,0.25)] hover:border-mint-200 transition-all">
        <CardContent className="p-8 h-full flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-mint-100 to-mint-200 flex items-center justify-center shadow-[0_4px_16px_rgba(201,244,212,0.3)]"
            >
              <Icon className="h-14 w-14 text-text-primary" />
            </motion.div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-text-subtle hover:text-text-primary hover:bg-mint-50 rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white border-mint-100 rounded-xl shadow-[0_8px_24px_rgba(201,244,212,0.2)]">
                <DropdownMenuItem className="text-text-secondary hover:text-text-primary hover:bg-mint-50">
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem className="text-text-secondary hover:text-text-primary hover:bg-mint-50">
                  Export Data
                </DropdownMenuItem>
                <DropdownMenuItem className="text-text-secondary hover:text-text-primary hover:bg-mint-50">
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem className="text-text-secondary hover:text-text-primary hover:bg-mint-50">
                  Set Alert
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Number */}
          <div className="mb-4">
            <CountUp
              end={value}
              duration={2}
              separator=","
              className="text-[64px] font-black text-text-primary leading-none"
              style={{ letterSpacing: "-0.03em", textShadow: "0 2px 4px rgba(30, 90, 59, 0.08)" }}
            />
          </div>

          {/* Label */}
          <p className="text-[15px] font-medium text-text-secondary mb-6 mt-2">{label}</p>

          {/* Trend */}
          <div className="mb-6">
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-mint-50/80 border border-mint-200/30">
              <TrendingUp className="h-4 w-4 text-mint-200" />
              <span className="text-[13px] font-semibold text-mint-200">
                {trend.isPositive ? "+" : "-"}
                {Math.abs(trend.value)}% vs last month
              </span>
            </div>
          </div>

          {/* Sparkline */}
          <div className="flex-1 min-h-[100px] mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C9F4D4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#C9F4D4" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#80EFC0"
                  strokeWidth={2.5}
                  fill="url(#sparklineGradient)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* CTA */}
          <Link
            href="/dashboard/assessments"
            className="inline-flex items-center space-x-2 text-sm font-medium text-mint-200 hover:text-text-primary transition-colors group"
          >
            <span>View Details</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  )
}

