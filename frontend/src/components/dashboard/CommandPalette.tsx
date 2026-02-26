"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/router"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search, FileText, UserPlus, BarChart, Settings, CreditCard, Clock, ArrowRight } from "lucide-react"
import { CommandItem } from "@/types/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const allCommands: CommandItem[] = [
  {
    id: "create-assessment",
    label: "Create Assessment",
    icon: FileText,
    category: "action",
    shortcut: "C",
    action: () => {},
    keywords: ["create", "assessment", "test", "new"],
    href: "/competency",
  },
  {
    id: "add-candidate",
    label: "Add Candidate",
    icon: UserPlus,
    category: "action",
    shortcut: "A",
    action: () => {},
    keywords: ["add", "candidate", "user", "invite"],
    href: "/employee/management",
  },
  {
    id: "view-analytics",
    label: "View Analytics",
    icon: BarChart,
    category: "link",
    shortcut: "V",
    action: () => {},
    keywords: ["analytics", "stats", "metrics", "reports"],
    href: "/dashboard/analytics",
  },
  {
    id: "generate-report",
    label: "Generate Report",
    icon: FileText,
    category: "action",
    shortcut: "G",
    action: () => {},
    keywords: ["generate", "report", "export", "download"],
    href: "/dashboard/reports",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    category: "link",
    shortcut: "S",
    action: () => {},
    keywords: ["settings", "preferences", "config"],
    href: "/dashboard/settings",
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
    category: "link",
    shortcut: "B",
    action: () => {},
    keywords: ["billing", "payment", "credits", "subscription"],
    href: "/dashboard/billing",
  },
]

const recentCommands: CommandItem[] = [
  {
    id: "recent-1",
    label: "Full Stack Dev Test",
    icon: FileText,
    category: "recent",
    action: () => {},
    href: "/dashboard/assessments/1",
  },
  {
    id: "recent-2",
    label: "Backend Engineer Assessment",
    icon: FileText,
    category: "recent",
    action: () => {},
    href: "/dashboard/assessments/2",
  },
]

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter commands based on query
  const filteredCommands = query
    ? allCommands.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          cmd.keywords?.some((kw) => kw.toLowerCase().includes(query.toLowerCase()))
      )
    : []

  // Group commands by category
  const groupedCommands = {
    actions: filteredCommands.filter((cmd) => cmd.category === "action"),
    links: filteredCommands.filter((cmd) => cmd.category === "link"),
    recent: !query ? recentCommands : [],
    search: filteredCommands.filter((cmd) => cmd.category === "search"),
  }

  const allFiltered = [
    ...groupedCommands.actions,
    ...groupedCommands.links,
    ...groupedCommands.recent,
    ...groupedCommands.search,
  ]

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "k",
      metaKey: true,
      callback: () => onOpenChange(!open),
    },
    {
      key: "Escape",
      callback: () => onOpenChange(false),
    },
  ])

  // Handle selection
  const handleSelect = (command: CommandItem) => {
    if (command.href) {
      router.push(command.href)
    }
    command.action()
    onOpenChange(false)
    setQuery("")
    setSelectedIndex(0)
  }

  // Keyboard navigation
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % allFiltered.length)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + allFiltered.length) % allFiltered.length)
      } else if (e.key === "Enter") {
        e.preventDefault()
        if (allFiltered[selectedIndex]) {
          handleSelect(allFiltered[selectedIndex])
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, allFiltered, selectedIndex])

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
      setQuery("")
      setSelectedIndex(0)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 bg-white border-mint-100 rounded-3xl shadow-[0_20px_80px_rgba(128,239,192,0.3)] overflow-hidden">
        <div className="p-6 border-b border-mint-50">
          <div className="relative">
            <Search className="absolute left-0 top-1/2 transform -translate-y-1/2 h-5 w-5 text-text-subtle ml-2" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Type a command or search..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelectedIndex(0)
              }}
              className="pl-10 pr-4 text-lg border-0 border-b-2 border-mint-100 focus:border-mint-200 focus:ring-0 rounded-none bg-transparent text-text-primary placeholder:text-text-subtle"
            />
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {allFiltered.length === 0 && query ? (
            <div className="p-8 text-center text-text-subtle">
              <p>No results found for "{query}"</p>
            </div>
          ) : (
            <div className="p-2">
              {/* Actions */}
              {groupedCommands.actions.length > 0 && (
                <div className="mb-4">
                  <p className="px-4 py-2 text-xs font-semibold text-text-subtle uppercase tracking-wide">
                    Actions
                  </p>
                  {groupedCommands.actions.map((cmd, idx) => {
                    const Icon = cmd.icon
                    const isSelected = allFiltered.indexOf(cmd) === selectedIndex
                    return (
                      <motion.button
                        key={cmd.id}
                        onClick={() => handleSelect(cmd)}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all",
                          isSelected
                            ? "bg-mint-50 text-text-primary"
                            : "text-text-secondary hover:bg-mint-50/50"
                        )}
                        whileHover={{ x: 4 }}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-lg bg-mint-100 flex items-center justify-center">
                            <Icon className="h-5 w-5 text-mint-200" />
                          </div>
                          <span className="font-medium">{cmd.label}</span>
                        </div>
                        {cmd.shortcut && (
                          <kbd className="px-2 py-1 text-xs font-mono bg-mint-50 border border-mint-100 rounded text-text-subtle">
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              )}

              {/* Recent */}
              {groupedCommands.recent.length > 0 && (
                <div className="mb-4">
                  <p className="px-4 py-2 text-xs font-semibold text-text-subtle uppercase tracking-wide flex items-center space-x-2">
                    <Clock className="h-3 w-3" />
                    <span>Recent</span>
                  </p>
                  {groupedCommands.recent.map((cmd) => {
                    const Icon = cmd.icon
                    const isSelected = allFiltered.indexOf(cmd) === selectedIndex
                    return (
                      <motion.button
                        key={cmd.id}
                        onClick={() => handleSelect(cmd)}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all",
                          isSelected
                            ? "bg-mint-50 text-text-primary"
                            : "text-text-secondary hover:bg-mint-50/50"
                        )}
                        whileHover={{ x: 4 }}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-lg bg-mint-100 flex items-center justify-center">
                            <Icon className="h-5 w-5 text-mint-200" />
                          </div>
                          <span className="font-medium">{cmd.label}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-text-subtle" />
                      </motion.button>
                    )
                  })}
                </div>
              )}

              {/* Quick Links */}
              {groupedCommands.links.length > 0 && (
                <div className="mb-4">
                  <p className="px-4 py-2 text-xs font-semibold text-text-subtle uppercase tracking-wide">
                    Quick Links
                  </p>
                  {groupedCommands.links.map((cmd) => {
                    const Icon = cmd.icon
                    const isSelected = allFiltered.indexOf(cmd) === selectedIndex
                    return (
                      <motion.button
                        key={cmd.id}
                        onClick={() => handleSelect(cmd)}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all",
                          isSelected
                            ? "bg-mint-50 text-text-primary"
                            : "text-text-secondary hover:bg-mint-50/50"
                        )}
                        whileHover={{ x: 4 }}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-lg bg-mint-100 flex items-center justify-center">
                            <Icon className="h-5 w-5 text-mint-200" />
                          </div>
                          <span className="font-medium">{cmd.label}</span>
                        </div>
                        {cmd.shortcut && (
                          <kbd className="px-2 py-1 text-xs font-mono bg-mint-50 border border-mint-100 rounded text-text-subtle">
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-mint-50 bg-mint-50/30 flex items-center justify-between text-xs text-text-subtle">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-mint-100 rounded">↑↓</kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-mint-100 rounded">↵</kbd>
              <span>Select</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-mint-100 rounded">Esc</kbd>
              <span>Close</span>
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

