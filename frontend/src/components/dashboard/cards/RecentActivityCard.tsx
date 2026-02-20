"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowRight, Play, CheckCircle, UserPlus, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface TimelineEvent {
  id: string
  type: "candidate_start" | "candidate_complete" | "new_candidate" | "alert"
  user: {
    name: string
    avatar?: string
    initials: string
  }
  action: string
  timestamp: Date
  link?: string
  metadata?: string
  badge?: string
}

const events: TimelineEvent[] = [
  {
    id: "1",
    type: "candidate_start",
    user: { name: "Sarah Chen", initials: "SC" },
    action: "started Frontend Developer Assessment",
    timestamp: new Date(Date.now() - 1000 * 60 * 14),
    link: "/dashboard/candidates/1",
    badge: "Assessment",
    metadata: "23 candidates",
  },
  {
    id: "2",
    type: "candidate_complete",
    user: { name: "Mike Johnson", initials: "MJ" },
    action: "completed Backend Engineer Test",
    timestamp: new Date(Date.now() - 1000 * 60 * 27),
    link: "/dashboard/candidates/2",
    badge: "DSA",
    metadata: "Score: 82.3%",
  },
  {
    id: "3",
    type: "new_candidate",
    user: { name: "System", initials: "S" },
    action: "New candidate added: John Doe",
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
    link: "/dashboard/candidates",
    metadata: "Added via bulk upload",
  },
]

const iconMap = {
  candidate_start: Play,
  candidate_complete: CheckCircle,
  new_candidate: UserPlus,
  alert: AlertTriangle,
}

const iconColors = {
  candidate_start: "text-mint-200",
  candidate_complete: "text-green-500",
  new_candidate: "text-blue-500",
  alert: "text-amber-500",
}

export function RecentActivityCard() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="h-full"
    >
      <Card className="h-full bg-gradient-to-b from-white to-mint-50/30 border-mint-100 rounded-3xl shadow-[0_2px_8px_rgba(201,244,212,0.12)] hover:shadow-[0_8px_24px_rgba(201,244,212,0.25)] hover:border-mint-200 transition-all overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-semibold text-text-primary">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-mint-200 hover:text-text-primary group">
              <Link href="/dashboard/logs">
                View All <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-mint-50" />

            <div className="space-y-0">
              {events.map((event, index) => {
                const Icon = iconMap[event.type]
                const timeAgo = getTimeAgo(event.timestamp)

                return (
                  <Link key={event.id} href={event.link || "#"}>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.1, duration: 0.3 }}
                      whileHover={{ y: -2 }}
                      className="relative pl-[72px] pr-4 py-4 rounded-xl hover:bg-mint-50/50 transition-all cursor-pointer group"
                    >
                      {/* Timeline Dot */}
                      <div className="absolute left-[48px] top-[52px] w-3 h-3 rounded-full bg-white border-2 border-mint-200 z-10 group-hover:scale-150 group-hover:shadow-[0_0_12px_rgba(128,239,192,0.5)] transition-all" />

                      {/* Avatar */}
                      <div className="absolute left-0 top-4">
                        <Avatar className="w-10 h-10 border-2 border-mint-100 shadow-[0_2px_8px_rgba(201,244,212,0.2)]">
                          <AvatarImage src={event.user.avatar} />
                          <AvatarFallback className="bg-gradient-to-br from-mint-100 to-mint-200 text-text-primary text-xs font-semibold">
                            {event.user.initials}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      {/* Content */}
                      <div>
                        <p className="text-[15px] font-semibold text-text-primary mb-1">
                          <span className="font-bold">{event.user.name}</span> {event.action}
                        </p>
                        <p className="text-[13px] text-text-subtle mb-2">{timeAgo}</p>
                        {event.metadata && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {event.badge && (
                              <Badge className="text-[13px] bg-mint-50 text-text-secondary border-mint-100">
                                {event.badge}
                              </Badge>
                            )}
                            <span className="text-[13px] text-text-secondary">{event.metadata}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </Link>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds} seconds ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? "s" : ""} ago`
}

