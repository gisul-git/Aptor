"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import Image from "next/image"
import { Search as SearchIcon, Zap, Bell, HelpCircle, User, Settings, LogOut, Home, Plus, FileText, Users, BarChart3, MoreHorizontal, ChevronDown, Target, TrendingUp, Calendar, GraduationCap, Briefcase, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuthStore } from "@/store/auth.store"
import { useNotificationStore } from "@/store/notification-store"
import { useModeStore } from "@/store/mode-store"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import ModeIndicator from "./ModeIndicator"
import MobileNav from "./MobileNav"

const mockNotifications = [
  {
    id: "1",
    type: "candidate" as const,
    title: "New candidate started test",
    description: "John Doe started Frontend Developer Assessment",
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    read: false,
  },
  {
    id: "2",
    type: "proctoring" as const,
    title: "Proctoring alert",
    description: "Tab switch detected for candidate #123",
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    read: false,
  },
]

// EMPLOYEE MODE NAVIGATION
const employeeNavItems = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: Home },
  { id: "employees", label: "Employees", href: "/dashboard/employees", icon: Users, badge: 47, description: "Manage your workforce" },
  { id: "talent-search", label: "Talent Search", href: "/dashboard/talent-search", icon: Search, description: "Find skilled employees" },
  { id: "assessments", label: "Assessments", href: "/dashboard/assessments", icon: FileText, badge: 12, description: "Skill assessments" },
  { id: "learning-paths", label: "Learning Paths", href: "/dashboard/learning-paths", icon: GraduationCap, description: "Employee development" },
  { id: "projects", label: "Projects", href: "/dashboard/projects", icon: Briefcase, description: "Assign talent to projects" },
  { id: "analytics", label: "Analytics", href: "/dashboard/analytics", icon: BarChart3, description: "Capability insights" },
]

// HIRING MODE NAVIGATION
const hiringNavItems = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: Home },
  { id: "candidates", label: "Candidates", href: "/dashboard/candidates", icon: Users, badge: 247, description: "Applicant pool" },
  { id: "positions", label: "Positions", href: "/dashboard/positions", icon: Target, badge: 12, description: "Open job positions" },
  { id: "assessments", label: "Assessments", href: "/dashboard/assessments", icon: FileText, badge: 12, description: "Screening tests" },
  { id: "pipeline", label: "Pipeline", href: "/dashboard/pipeline", icon: TrendingUp, description: "Hiring funnel" },
  { id: "interviews", label: "Interviews", href: "/dashboard/interviews", icon: Calendar, description: "Schedule & track" },
  { id: "analytics", label: "Analytics", href: "/dashboard/analytics", icon: BarChart3, description: "Hiring metrics" },
]

const moreNavItems = [
  { id: "reports", label: "Reports", href: "/dashboard/reports" },
  { id: "dsa", label: "DSA", href: "/dashboard/dsa" },
  { id: "logs", label: "Logs", href: "/dashboard/logs" },
  { id: "settings", label: "Settings", href: "/dashboard/settings" },
]

interface UnifiedTopBarProps {
  onCommandPaletteOpen?: () => void
}

export function UnifiedTopBar({ onCommandPaletteOpen }: UnifiedTopBarProps) {
  const { user } = useAuthStore()
  const { unreadCount } = useNotificationStore()
  const { mode } = useModeStore()
  const router = useRouter()
  const pathname = router.pathname
  const [searchQuery, setSearchQuery] = useState("")

  const unreadNotifications = mockNotifications.filter((n) => !n.read)

  // Select nav items based on mode - this will update reactively when mode changes
  const mainNavItems = mode === 'employees' ? employeeNavItems : hiringNavItems

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-[100] w-full h-20 bg-white/95 backdrop-blur-xl border-b border-mint-100/30 shadow-[0_1px_3px_rgba(201,244,212,0.1)]"
    >
      <div className="max-w-[1600px] mx-auto px-6 h-full">
        <div className="flex items-center justify-between h-full gap-4">
          {/* Left Section: Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Mobile Menu Button */}
            <MobileNav />
            
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden">
                <Image
                  src="/Aaptor%20Logo.png"
                  alt="Aaptor logo"
                  width={44}
                  height={44}
                  className="h-11 w-auto object-contain"
                  priority
                />
              </div>
              <span className="font-bold text-2xl text-text-primary hidden sm:block">
                Aaptor
              </span>
            </Link>
          </div>

          {/* Center Section: Navigation Items */}
          <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center max-w-5xl mx-4" key={mode}>
              {mainNavItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)

                return (
                  <Link key={`${mode}-${item.id}`} href={item.href}>
                    <motion.div
                      whileHover={{ y: -1 }}
                      className={cn(
                        "relative group px-4 py-2.5 rounded-xl flex items-center gap-2.5 text-sm font-semibold transition-all duration-200 whitespace-nowrap h-10",
                        active
                          ? mode === 'employees'
                            ? "text-mint-600 bg-mint-50 shadow-sm"
                            : "text-blue-600 bg-blue-50 shadow-sm"
                          : "text-text-subtle hover:text-text-primary hover:bg-mint-50/50"
                      )}
                    >
                      <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                      <span className="font-semibold">{item.label}</span>
                      {item.badge && (
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-bold min-w-[24px] text-center flex-shrink-0",
                          active
                            ? mode === 'employees'
                              ? "bg-mint-500 text-white"
                              : "bg-blue-500 text-white"
                            : "bg-gray-200 text-gray-700"
                        )}>
                          {item.badge}
                        </span>
                      )}
                      {active && (
                        <motion.div
                          layoutId="activeIndicator"
                          className={cn(
                            "absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full",
                            mode === 'employees' ? "bg-mint-500" : "bg-blue-500"
                          )}
                          initial={false}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      )}
                      {/* Tooltip */}
                      {item.description && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                          {item.description}
                          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
                        </div>
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
                    moreNavItems.some((item) => isActive(item.href))
                      ? "text-text-primary bg-mint-50 shadow-sm"
                      : "text-text-subtle hover:text-text-primary hover:bg-mint-50/50"
                  )}
                >
                  <MoreHorizontal className="h-[18px] w-[18px] flex-shrink-0" />
                  <span className="font-semibold">More</span>
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-white/95 backdrop-blur-xl border-mint-100 rounded-xl shadow-[0_8px_32px_rgba(201,244,212,0.2)]">
                  {moreNavItems.map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      asChild
                      className={cn(
                        "text-text-secondary hover:text-text-primary hover:bg-mint-50",
                        isActive(item.href) && "bg-mint-50 text-text-primary font-medium"
                      )}
                    >
                      <Link href={item.href}>{item.label}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
          </nav>

          {/* Right Section: Search + Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Search */}
            <div className="relative hidden lg:block">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-subtle" />
              <Input
                type="search"
                placeholder="Search... Cmd+K"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => onCommandPaletteOpen?.()}
                className="pl-10 pr-4 w-64 bg-mint-50/60 border-mint-100/40 rounded-lg focus:border-mint-200 focus:ring-2 focus:ring-mint-200/20 focus:bg-white text-text-primary placeholder:text-text-subtle h-10 text-sm"
              />
            </div>

            {/* Mode Indicator */}
            <ModeIndicator />

            {/* Quick Create */}
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-text-subtle hover:text-text-primary hover:bg-mint-50 rounded-lg"
              onClick={() => onCommandPaletteOpen?.()}
            >
              <Zap className="h-5 w-5" />
            </Button>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-10 w-10 text-text-subtle hover:text-text-primary hover:bg-mint-50 rounded-lg"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadNotifications.length > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 border-2 border-white">
                      {unreadNotifications.length > 9 ? "9+" : unreadNotifications.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-96 bg-white/95 backdrop-blur-xl border-mint-100 rounded-xl shadow-[0_8px_32px_rgba(201,244,212,0.2)]">
                <div className="p-4 border-b border-mint-50 flex items-center justify-between">
                  <DropdownMenuLabel className="text-text-primary font-semibold p-0">Notifications</DropdownMenuLabel>
                  <Button variant="ghost" size="sm" className="text-xs text-mint-200 hover:text-text-primary h-auto p-0">
                    Mark all as read
                  </Button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {mockNotifications.length === 0 ? (
                    <div className="p-4 text-sm text-text-subtle text-center">No new notifications</div>
                  ) : (
                    <div className="divide-y divide-mint-50">
                      {mockNotifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={cn(
                            "block p-4 hover:bg-mint-50 transition-colors",
                            !notification.read && "bg-mint-50"
                          )}
                        >
                          <p className="text-sm font-semibold text-text-primary">{notification.title}</p>
                          <p className="text-xs text-text-secondary mt-1">{notification.description}</p>
                          <p className="text-xs text-text-subtle mt-2">
                            {notification.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-3 border-t border-mint-50 text-center">
                  <Link
                    href="/dashboard/notifications"
                    className="text-sm font-medium text-mint-200 hover:text-text-primary transition-colors"
                  >
                    View All Notifications →
                  </Link>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Help */}
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-text-subtle hover:text-text-primary hover:bg-mint-50 rounded-lg"
              aria-label="Help"
            >
              <HelpCircle className="h-5 w-5" />
            </Button>

            {/* Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-10 w-10 p-0 rounded-full hover:scale-110 transition-transform"
                >
                  <Avatar className="h-10 w-10 border-2 border-mint-200">
                    <AvatarImage src={user?.avatar} alt={user?.name} />
                    <AvatarFallback className="bg-gradient-to-br from-mint-100 to-mint-300 text-text-primary">
                      {user?.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white/95 backdrop-blur-xl border-mint-100 rounded-xl shadow-[0_8px_32px_rgba(201,244,212,0.2)]">
                <DropdownMenuLabel className="text-text-primary">My Account</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-mint-50" />
                <DropdownMenuItem className="text-text-secondary hover:text-text-primary hover:bg-mint-50">
                  <User className="mr-2 h-4 w-4 text-text-subtle" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="text-text-secondary hover:text-text-primary hover:bg-mint-50">
                  <Settings className="mr-2 h-4 w-4 text-text-subtle" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-mint-50" />
                <DropdownMenuItem className="text-red-600 hover:bg-red-50">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </motion.header>
  )
}

