"use client"

import { useEffect, useCallback } from "react"

interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  callback: () => void
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatches = shortcut.ctrlKey ? event.ctrlKey : !event.ctrlKey
        const metaMatches = shortcut.metaKey ? event.metaKey : !event.metaKey
        const shiftMatches = shortcut.shiftKey ? event.shiftKey : !event.shiftKey
        const altMatches = shortcut.altKey ? event.altKey : !event.altKey

        // Handle Cmd on Mac or Ctrl on Windows/Linux
        const modifierMatches =
          shortcut.metaKey || shortcut.ctrlKey
            ? event.metaKey || event.ctrlKey
            : !event.metaKey && !event.ctrlKey

        if (
          keyMatches &&
          modifierMatches &&
          shiftMatches &&
          altMatches &&
          !event.repeat
        ) {
          // Check if user is typing in an input
          const target = event.target as HTMLElement
          if (
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable
          ) {
            // Allow Cmd+K in inputs
            if (shortcut.key === "k" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              shortcut.callback()
            }
            continue
          }

          event.preventDefault()
          shortcut.callback()
          break
        }
      }
    },
    [shortcuts]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [handleKeyDown])
}

