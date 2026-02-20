"use client"

import { LucideIcon, TrendingUp, TrendingDown, MoreVertical } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import CountUp from "react-countup"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

interface MetricCardProps {
  title: string
  value: number | string
  trend?: {
    value: number
    isPositive: boolean
  }
  subtitle?: string
  icon: LucideIcon
  iconColor?: string
  loading?: boolean
  onClick?: () => void
}

export function MetricCard({
  title,
  value,
  trend,
  subtitle,
  icon: Icon,
  iconColor = "text-mint-200",
  loading = false,
  onClick,
}: MetricCardProps) {
  if (loading) {
    return (
      <Card className="hover:shadow-[0_4px_20px_rgba(201,244,212,0.15)] transition-all border-mint-100">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="flex justify-between items-start">
              <div className="h-4 bg-mint-50 rounded w-24"></div>
              <div className="h-8 w-8 bg-mint-50 rounded-lg"></div>
            </div>
            <div className="h-8 bg-mint-50 rounded w-32"></div>
            <div className="h-4 bg-mint-50 rounded w-20"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          "hover:shadow-[0_4px_20px_rgba(201,244,212,0.25)] transition-all border-mint-100 hover:border-mint-200 cursor-pointer bg-white",
          onClick && "hover:border-mint-200"
        )}
        onClick={onClick}
      >
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <p className="text-sm font-medium text-text-secondary">{title}</p>
            <div className="flex items-center space-x-2">
              <div className={cn("p-2 rounded-lg bg-gradient-to-br from-mint-100 to-mint-50 border border-mint-200")}>
                <Icon className={cn("h-5 w-5", iconColor)} />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-text-subtle hover:text-text-primary hover:bg-mint-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white border-mint-100">
                  <DropdownMenuItem className="text-text-secondary hover:text-text-primary hover:bg-mint-50">
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-text-secondary hover:text-text-primary hover:bg-mint-50">
                    Export Data
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-text-secondary hover:text-text-primary hover:bg-mint-50">
                    Set Alert
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline space-x-2">
              {typeof value === "number" ? (
                <CountUp
                  end={value}
                  duration={1.5}
                  className="text-5xl font-bold text-text-primary"
                />
              ) : (
                <span className="text-5xl font-bold text-text-primary">{value}</span>
              )}
            </div>
            {subtitle && (
              <p className="text-sm font-medium text-mint-200">{subtitle}</p>
            )}
            {trend && (
              <div
                className={cn(
                  "flex items-center space-x-1 text-sm font-medium",
                  trend.isPositive ? "text-mint-200" : "text-red-500"
                )}
              >
                {trend.isPositive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span>{Math.abs(trend.value)}%</span>
                <span className="text-text-subtle text-xs ml-1">vs last month</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
