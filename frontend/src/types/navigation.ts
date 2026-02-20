import { LucideIcon } from "lucide-react"

export interface CommandItem {
  id: string
  label: string
  icon: LucideIcon
  category: "action" | "recent" | "link" | "search"
  shortcut?: string
  action: () => void
  keywords?: string[]
  href?: string
}

export interface NavigationTab {
  id: string
  label: string
  href: string
  icon?: LucideIcon
  badge?: number
}

