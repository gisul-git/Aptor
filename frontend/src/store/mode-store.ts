"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

type DashboardMode = "employees" | "hiring"

interface ModeStore {
  mode: DashboardMode
  setMode: (mode: DashboardMode) => void
  toggleMode: () => void
}

export const useModeStore = create<ModeStore>()(
  persist(
    (set) => ({
      mode: "employees",
      setMode: (mode) => set({ mode }),
      toggleMode: () =>
        set((state) => ({
          mode: state.mode === "employees" ? "hiring" : "employees",
        })),
    }),
    {
      name: "dashboard-mode",
    }
  )
)

