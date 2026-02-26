"use client"

import { useState } from "react"
import { Search, Bell, HelpCircle, User, Settings, LogOut, Zap, FileText, UserPlus, BarChart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/store/auth.store"
import { useNotificationStore } from "@/store/notification-store"
import { useSidebarStore } from "@/store/sidebar-store"
import { cn } from "@/lib/utils"
import Link from "next/link"

const mockNotifications = [
  {
    id: "1",
    type: "candidate" as const,
    title: "New candidate started test",
    description: "John Doe started Frontend Developer Assessment",
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    read: false,
    icon: User,
    link: "/dashboard/candidates",
  },
  {
    id: "2",
    type: "proctoring" as const,
    title: "Proctoring alert",
    description: "Tab switch detected for candidate #123",
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    read: false,
    icon: Bell,
    link: "/dashboard/proctoring",
  },
  {
    id: "3",
    type: "credit" as const,
    title: "Low credits warning",
    description: "You have less than 50 credits remaining",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    read: true,
    icon: BarChart,
    link: "/dashboard/billing",
  },
]

export function TopNav() {
  const { user, logout } = useAuthStore()
  const { unreadCount } = useNotificationStore()
  const { isCollapsed } = useSidebarStore()
  const [searchQuery, setSearchQuery] = useState("")

  const unreadNotifications = mockNotifications.filter((n) => !n.read)

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 h-16 bg-white border-b border-mint-50 transition-all duration-300",
        isCollapsed ? "left-16" : "left-64"
      )}
    >
      <div className="flex h-full items-center justify-between px-8">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-subtle" />
            <Input
              type="search"
              placeholder="Search assessments, candidates... (Cmd+K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full bg-complementary-warm-beige border-mint-100 rounded-xl focus:border-mint-200 focus:ring-mint-200 text-text-primary placeholder:text-text-subtle"
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-4">
          {/* Quick Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center space-x-2 text-text-secondary hover:text-text-primary hover:bg-mint-50"
              >
                <Zap className="h-4 w-4" />
                <span className="hidden md:inline">Quick Create</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white border-mint-100">
              <DropdownMenuItem asChild>
                <Link href="/competency" className="flex items-center space-x-2 cursor-pointer">
                  <FileText className="h-4 w-4 text-text-subtle" />
                  <span>New Assessment</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/employee/management" className="flex items-center space-x-2 cursor-pointer">
                  <UserPlus className="h-4 w-4 text-text-subtle" />
                  <span>Add Candidate</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/reports" className="flex items-center space-x-2 cursor-pointer">
                  <BarChart className="h-4 w-4 text-text-subtle" />
                  <span>Generate Report</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Help */}
          <Button
            variant="ghost"
            size="icon"
            className="text-text-subtle hover:text-text-primary hover:bg-mint-50 rounded-full"
            aria-label="Help"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative text-text-subtle hover:text-text-primary hover:bg-mint-50 rounded-full"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadNotifications.length > 0 && (
                  <Badge
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 border-2 border-white"
                  >
                    {unreadNotifications.length > 9 ? "9+" : unreadNotifications.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-96 bg-white border-mint-100 rounded-xl shadow-[0_8px_32px_rgba(201,244,212,0.2)]">
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
                    {mockNotifications.map((notification) => {
                      const Icon = notification.icon
                      return (
                        <Link
                          key={notification.id}
                          href={notification.link || "#"}
                          className={cn(
                            "block p-4 hover:bg-mint-50 transition-colors",
                            !notification.read && "bg-mint-50"
                          )}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="mt-0.5">
                              <div className="w-8 h-8 rounded-lg bg-mint-100 flex items-center justify-center">
                                <Icon className="h-4 w-4 text-text-primary" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-text-primary">{notification.title}</p>
                              <p className="text-xs text-text-secondary mt-1">{notification.description}</p>
                              <p className="text-xs text-text-subtle mt-2">
                                {notification.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            {!notification.read && (
                              <div className="w-2 h-2 rounded-full bg-mint-200 mt-2"></div>
                            )}
                          </div>
                        </Link>
                      )
                    })}
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

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 h-auto p-2 hover:bg-mint-50 rounded-lg">
                <Avatar className="h-8 w-8 border-2 border-mint-200">
                  <AvatarImage src={user?.avatar} alt={user?.name} />
                  <AvatarFallback className="bg-gradient-to-br from-mint-100 to-mint-300 text-text-primary">
                    {user?.name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-text-primary">{user?.name || "User"}</p>
                  <p className="text-xs text-text-subtle">{user?.role || "Admin"}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white border-mint-100">
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
              <DropdownMenuItem onClick={logout} className="text-red-600 hover:bg-red-50">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
