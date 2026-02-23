"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Search, Zap, Bell, HelpCircle, User, Menu, Settings, LogOut } from "lucide-react"
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
import { motion } from "framer-motion"
import { QuickActionsMenu } from "./QuickActionsMenu"
import ModeIndicator from "./ModeIndicator"
import { cn } from "@/lib/utils"

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

interface FloatingTopBarProps {
  onCommandPaletteOpen?: () => void
}

export function FloatingTopBar({ onCommandPaletteOpen }: FloatingTopBarProps) {
  const { user } = useAuthStore()
  const { unreadCount } = useNotificationStore()
  const [searchQuery, setSearchQuery] = useState("")

  const unreadNotifications = mockNotifications.filter((n) => !n.read)

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed top-4 left-6 right-6 z-[100] max-w-[1600px] mx-auto"
      >
        <div className="relative bg-white/80 backdrop-blur-2xl border border-mint-100/30 rounded-2xl shadow-[0_8px_32px_rgba(128,239,192,0.15)] px-6 py-4">
          <div className="flex items-center justify-between h-full gap-4">
            {/* Left Section */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onCommandPaletteOpen?.()}
                className="h-10 w-10 text-text-subtle hover:text-text-primary hover:bg-mint-50 rounded-lg"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
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

            {/* Center Section - Search */}
            <div className="flex-1 max-w-[480px] mx-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-subtle" />
                <Input
                  type="search"
                  placeholder="Search anything... Cmd+K"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => onCommandPaletteOpen?.()}
                  className="pl-11 pr-4 w-full bg-mint-50/60 border-mint-100/40 rounded-xl focus:border-mint-200 focus:ring-4 focus:ring-mint-200 focus:bg-white text-text-primary placeholder:text-text-subtle h-11 transition-all"
                />
              </div>
            </div>

            {/* Right Section - Actions */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Mode Indicator */}
              <ModeIndicator />
              
              {/* Quick Create */}
              <QuickActionsMenu />

              {/* Notifications */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-10 w-10 text-text-subtle hover:text-text-primary hover:bg-mint-50 rounded-lg transition-all"
                    aria-label="Notifications"
                  >
                    <motion.div
                      animate={unreadNotifications.length > 0 ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
                    >
                      <Bell className="h-5 w-5" />
                    </motion.div>
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
                    className="h-10 w-10 p-0 rounded-full hover:scale-110 transition-all"
                  >
                    <Avatar className="h-10 w-10 border-2 border-mint-300 hover:border-mint-400 transition-all">
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
                <DropdownMenuContent align="end" className="w-56 bg-white/95 backdrop-blur-xl border-mint-100">
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
    </>
  )
}

