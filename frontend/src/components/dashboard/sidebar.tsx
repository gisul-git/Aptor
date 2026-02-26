"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import Image from "next/image"
import {
  Home,
  Plus,
  FileText,
  Users,
  BarChart3,
  Code,
  FileBarChart,
  Activity,
  Settings,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  Eye,
  Database,
  CreditCard,
  UserCircle,
  Sparkles,
  Cloud,
  Brain,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { NAV_ITEMS } from "@/lib/constants"
import { useSidebarStore } from "@/store/sidebar-store"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuthStore } from "@/store/auth.store"
import { motion, AnimatePresence } from "framer-motion"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  Plus,
  FileText,
  Users,
  BarChart3,
  Code,
  FileBarChart,
  Activity,
  Settings,
  Eye,
  Database,
  CreditCard,
  UserCircle,
  Sparkles,
  Cloud,
  Brain,
}

export function Sidebar() {
  const router = useRouter()
  const pathname = router.pathname
  const { isCollapsed, toggle } = useSidebarStore()
  const { user } = useAuthStore()
  const [expandedItems, setExpandedItems] = useState<string[]>([])

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const isActive = (href: string) => {
    if (href === "#") return false
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-white border-r border-mint-100 transition-all duration-300 shadow-[0_2px_12px_rgba(201,244,212,0.1)]",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo Section */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-mint-50">
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center space-x-2 group">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center overflow-hidden">
                <Image
                  src="/Aaptor%20Logo.png"
                  alt="Aaptor logo"
                  width={40}
                  height={40}
                  className="h-10 w-auto object-contain"
                  priority
                />
              </div>
              <span className="font-bold text-2xl text-text-primary">Aaptor</span>
            </Link>
          )}
          {isCollapsed && (
            <div className="h-10 w-10 rounded-lg flex items-center justify-center overflow-hidden mx-auto">
              <Image
                src="/Aaptor%20Logo.png"
                alt="Aaptor logo"
                width={40}
                height={40}
                className="h-10 w-auto object-contain"
                priority
              />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="h-8 w-8 text-text-subtle hover:text-text-primary hover:bg-mint-50"
            aria-label="Toggle sidebar"
          >
            {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = iconMap[item.icon] || Home
            const hasSubmenu = 'submenu' in item && item.submenu && item.submenu.length > 0
            const isItemActive = isActive(item.href)
            const isExpanded = expandedItems.includes(item.id)

            if (hasSubmenu) {
              return (
                <div key={item.id}>
                  <button
                    onClick={() => toggleExpanded(item.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-3 mx-2 rounded-lg text-sm font-medium transition-all duration-200",
                      isItemActive
                        ? "bg-gradient-to-r from-mint-100 to-mint-50 text-text-primary font-semibold border-l-3 border-mint-200"
                        : "text-text-secondary hover:bg-mint-50 hover:text-text-primary"
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className={cn("h-5 w-5 flex-shrink-0", isItemActive ? "text-text-primary" : "text-text-subtle")} />
                      {!isCollapsed && <span>{item.label}</span>}
                    </div>
                    {!isCollapsed && (
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 transition-transform text-text-subtle",
                          isExpanded && "rotate-90"
                        )}
                      />
                    )}
                  </button>
                  <AnimatePresence>
                    {!isCollapsed && isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="ml-8 mt-1 space-y-1"
                      >
                        {item.submenu?.map((subItem) => (
                          <Link
                            key={subItem.id}
                            href={subItem.href}
                            className={cn(
                              "block px-3 py-2 rounded-lg text-sm transition-all duration-200",
                              isActive(subItem.href)
                                ? "bg-mint-50 text-text-primary font-medium border-l-2 border-mint-200"
                                : "text-text-subtle hover:bg-mint-50/50 hover:text-text-primary"
                            )}
                          >
                            {subItem.label}
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center space-x-3 px-3 py-3 mx-2 rounded-lg text-sm font-medium transition-all duration-200",
                  isItemActive
                    ? "bg-gradient-to-r from-mint-100 to-mint-50 text-text-primary font-semibold border-l-3 border-mint-200"
                    : "text-text-secondary hover:bg-mint-50 hover:text-text-primary"
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className={cn("h-5 w-5 flex-shrink-0", isItemActive ? "text-text-primary" : "text-text-subtle")} />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Credits Widget */}
        {!isCollapsed && (
          <div className="p-4 border-t border-mint-50">
            <div className="bg-gradient-to-br from-mint-50 to-mint-100 border border-mint-100 rounded-xl p-4">
              <p className="text-xs font-medium text-text-secondary mb-2">Credits Remaining</p>
              <p className="text-3xl font-bold text-text-primary mb-3">127</p>
              <div className="w-full bg-white/50 rounded-full h-1.5 mb-3">
                <div className="bg-mint-200 h-1.5 rounded-full" style={{ width: "60%" }}></div>
              </div>
              <Link
                href="/dashboard/billing"
                className="text-xs font-medium text-mint-200 hover:text-text-primary transition-colors inline-flex items-center space-x-1"
              >
                <span>Buy More Credits</span>
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}

        {/* User Profile */}
        {!isCollapsed && (
          <>
            <Separator className="bg-mint-50" />
            <div className="p-4">
              <div className="flex items-center space-x-3">
                <Avatar className="border-2 border-mint-200">
                  <AvatarImage src={user?.avatar} alt={user?.name} />
                  <AvatarFallback className="bg-gradient-to-br from-mint-100 to-mint-300 text-text-primary">
                    {user?.name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{user?.name || "User"}</p>
                  <p className="text-xs text-text-subtle truncate">{user?.email || "user@example.com"}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
