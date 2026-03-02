"use client"

import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { LucideIcon, ArrowRight } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface QuickActionCardProps {
  icon: LucideIcon
  label: string
  subtitle?: string
  href: string
  gradient: string
  delay?: number
  size?: "default" | "wide"
}

export function QuickActionCard({ icon: Icon, label, subtitle, href, gradient, delay = 0, size = "default" }: QuickActionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ scale: 1.05, y: -2, transition: { duration: 0.2 } }}
      className="h-full"
    >
      <Link href={href} className="block h-full group">
        <Card className={cn(
          "h-full border-0 rounded-2xl shadow-[0_2px_8px_rgba(201,244,212,0.12)] hover:shadow-[0_8px_24px_rgba(201,244,212,0.25)] transition-all overflow-hidden bg-gradient-to-br",
          gradient
        )}>
          <CardContent className="p-6 h-full flex flex-col justify-between">
            <motion.div
              whileHover={{ rotate: 5, scale: 1.1 }}
              className="w-12 h-12 rounded-2xl bg-white/30 backdrop-blur-sm flex items-center justify-center mb-4 shadow-sm"
            >
              <Icon className="h-6 w-6 text-text-primary" />
            </motion.div>
            <div>
              <p className="text-base font-bold text-text-primary mb-1">{label}</p>
              {subtitle && (
                <p className="text-[13px] text-text-secondary">{subtitle}</p>
              )}
              <div className="mt-4 flex items-center text-mint-200 group-hover:text-text-primary transition-colors">
                <span className="text-sm font-medium">View</span>
                <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}

