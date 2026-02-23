import { GetServerSideProps } from "next";
import { requireAuth } from "../lib/auth";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useModeStore } from "@/store/mode-store";
import { FloatingTopBar } from "@/components/dashboard/FloatingTopBar";
import { FloatingTabs } from "@/components/dashboard/FloatingTabs";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { ModeProvider } from "@/contexts/ModeContext";
import { useEffect, useState } from "react";

// Dynamically import dashboard components with SSR disabled (recharts doesn't support SSR)
const EmployeeDashboard = dynamic(
  () => import("@/components/dashboard/EmployeeDashboard").then((mod) => ({ default: mod.EmployeeDashboard })),
  { ssr: false }
);

const HiringDashboard = dynamic(
  () => import("@/components/dashboard/HiringDashboard").then((mod) => ({ default: mod.HiringDashboard })),
  { ssr: false }
);

interface DashboardPageProps {
  session: any;
}

function DashboardContent() {
  const { mode } = useModeStore();
  const [mounted, setMounted] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Global keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "k",
      metaKey: true,
      callback: () => setIsCommandPaletteOpen(true),
    },
  ]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-mint-50 pb-12">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="bg-white rounded-2xl p-6 mb-8 shadow-sm border-2 border-gray-200">
            <div className="h-8 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <ModeProvider>
      <div className="min-h-screen bg-mint-50">
        <FloatingTopBar onCommandPaletteOpen={() => setIsCommandPaletteOpen(true)} />
        <FloatingTabs />
        <main className="pt-24 pb-12">
          <div className="max-w-[1600px] mx-auto px-6">
            {/* Conditional Dashboard Content */}
            <AnimatePresence mode="wait">
              {mode === "employees" ? (
                <motion.div
                  key="employees"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <EmployeeDashboard />
                </motion.div>
              ) : (
                <motion.div
                  key="hiring"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <HiringDashboard />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
        <CommandPalette open={isCommandPaletteOpen} onOpenChange={setIsCommandPaletteOpen} />
      </div>
    </ModeProvider>
  );
}

export default function DashboardPage({ session: serverSession }: DashboardPageProps) {
  return <DashboardContent />;
}

// Server-side authentication check
export const getServerSideProps: GetServerSideProps = requireAuth;