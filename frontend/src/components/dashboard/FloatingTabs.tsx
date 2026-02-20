"use client"

import { useRouter } from "next/router"
import Link from "next/link"
import { useScrollTrigger } from "@/hooks/useScrollTrigger"
import { motion, AnimatePresence } from "framer-motion"
import { NavigationTab } from "@/types/navigation"
import { Home, Plus, FileText, Users, BarChart3, MoreHorizontal, Search, Target, TrendingUp, Calendar, GraduationCap, Briefcase } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useModeStore } from "@/store/mode-store"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  Plus,
  FileText,
  Users,
  BarChart3,
}

// EMPLOYEE MODE TABS
const employeeTabs = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: Home },
  { id: "employees", label: "Employees", href: "/dashboard/employees", icon: Users, badge: 47 },
  { id: "talent-search", label: "Talent Search", href: "/dashboard/talent-search", icon: Search },
  { id: "assessments", label: "Assessments", href: "/assessments", icon: FileText, badge: 12 },
  { id: "learning-paths", label: "Learning Paths", href: "/dashboard/learning-paths", icon: GraduationCap },
  { id: "projects", label: "Projects", href: "/dashboard/projects", icon: Briefcase },
  { id: "analytics", label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
] as const

// HIRING MODE TABS
const hiringTabs = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: Home },
  { id: "candidates", label: "Candidates", href: "/dashboard/candidates", icon: Users, badge: 247 },
  { id: "positions", label: "Positions", href: "/dashboard/positions", icon: Target, badge: 12 },
  { id: "assessments", label: "Assessments", href: "/assessments", icon: FileText, badge: 12 },
  { id: "pipeline", label: "Pipeline", href: "/dashboard/pipeline", icon: TrendingUp },
  { id: "interviews", label: "Interviews", href: "/dashboard/interviews", icon: Calendar },
  { id: "analytics", label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
] as const

const moreTabs: NavigationTab[] = [
  { id: "dsa", label: "DSA", href: "/dashboard/dsa" },
  { id: "reports", label: "Reports", href: "/dashboard/reports" },
  { id: "logs", label: "Logs", href: "/dashboard/logs" },
  { id: "settings", label: "Settings", href: "/dashboard/settings" },
]

export function FloatingTabs() {
  const router = useRouter()
  const pathname = router.pathname
  const isScrolled = useScrollTrigger(200)
  const { mode } = useModeStore()

  // Select tabs based on mode
  const mainTabs = mode === 'employees' ? employeeTabs : hiringTabs

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <AnimatePresence>
      {isScrolled && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-24 left-6 right-6 z-[90] max-w-[1600px] mx-auto"
          key={mode}
        >
          <div className="bg-white/80 backdrop-blur-2xl border border-mint-100/30 rounded-full shadow-[0_8px_32px_rgba(128,239,192,0.15)] px-4 py-2.5 flex items-center gap-1.5 min-w-fit">
            {mainTabs.map((tab) => {
              const Icon = tab.icon
              const active = isActive(tab.href)

              return (
                <Link key={tab.id} href={tab.href}>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "relative px-4 py-2 rounded-xl text-base font-semibold transition-all duration-200 flex items-center gap-2.5 h-10 whitespace-nowrap",
                      active
                        ? "bg-mint-100 border-2 border-mint-300 text-text-primary shadow-sm"
                        : "bg-white border-0 text-text-secondary hover:text-text-primary"
                    )}
                  >
                    {Icon && <Icon className="w-[18px] h-[18px] flex-shrink-0" />}
                    <span>{tab.label}</span>
                    {"badge" in tab && tab.badge && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold min-w-[24px] text-center flex-shrink-0 bg-mint-200 text-text-primary">
                        {tab.badge}
                      </span>
                    )}
                  </motion.div>
                </Link>
              )
            })}

            {/* More Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "h-10 px-4 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2.5",
                    pathname !== "/dashboard" &&
                      moreTabs.some((tab) => isActive(tab.href))
                      ? "bg-mint-50 text-text-primary shadow-sm border border-mint-200"
                      : "text-text-subtle hover:bg-mint-50/50 hover:text-text-primary"
                  )}
                >
                  <MoreHorizontal className="w-[18px] h-[18px] flex-shrink-0" />
                  <span className="font-semibold">More</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-xl border-mint-100 rounded-xl shadow-[0_8px_32px_rgba(201,244,212,0.2)]">
                {moreTabs.map((tab) => (
                  <DropdownMenuItem
                    key={tab.id}
                    asChild
                    className={cn(
                      "text-text-secondary hover:text-text-primary hover:bg-mint-50",
                      isActive(tab.href) && "bg-mint-50 text-text-primary font-medium"
                    )}
                  >
                    <Link href={tab.href}>{tab.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

