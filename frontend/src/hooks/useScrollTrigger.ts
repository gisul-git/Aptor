"use client"

import { useState, useEffect } from "react"

export function useScrollTrigger(threshold: number = 200) {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > threshold)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll() // Check initial state

    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [threshold])

  return isScrolled
}

