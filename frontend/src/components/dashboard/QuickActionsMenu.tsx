"use client"

import { useState } from "react"
import { Zap, FileText, UserPlus, BarChart, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { motion } from "framer-motion"
import Link from "next/link"
import { cn } from "@/lib/utils"

const quickActions = [
  {
    id: "create-assessment",
    label: "Create Assessment",
    icon: FileText,
    href: "/competency",
  },
  {
    id: "add-candidate",
    label: "Add Candidate",
    icon: UserPlus,
    href: "/employee/management",
  },
  {
    id: "generate-report",
    label: "Generate Report",
    icon: BarChart,
    href: "/dashboard/reports",
  },
]

export function QuickActionsMenu() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            variant="ghost"
            className="h-10 px-4 bg-gradient-to-r from-mint-100 to-mint-200 hover:from-mint-200 hover:to-mint-300 text-text-primary font-medium rounded-lg border border-mint-200 shadow-sm"
          >
            <Zap className="h-4 w-4 mr-2" />
            <span className="hidden md:inline">Quick Create</span>
          </Button>
        </motion.div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-56 bg-white/95 backdrop-blur-xl border-mint-100 rounded-xl shadow-[0_8px_32px_rgba(201,244,212,0.2)] p-2"
      >
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <DropdownMenuItem key={action.id} asChild className="p-0">
              <Link
                href={action.href}
                className="flex items-center justify-between w-full px-4 py-3 rounded-lg text-text-secondary hover:text-text-primary hover:bg-mint-50 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-mint-100 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-mint-200" />
                  </div>
                  <span className="font-medium">{action.label}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-text-subtle" />
              </Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

