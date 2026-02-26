'use client'

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Navbar from "@/components/landing/Navbar";
import ScrollProgress from "@/components/landing/ScrollProgress";
import Hero from "@/components/landing/Hero";
import VideoShowcase from "@/components/landing/VideoShowcase";
import SkillCapabilityExplainer from "@/components/landing/SkillCapabilityExplainer";
import PlatformCompetencies from "@/components/landing/PlatformCompetencies";
import AaptorJourney from "@/components/landing/AaptorJourney";
import ProctoringSecurity from "@/components/landing/ProctoringSecurity";
import IntegrationEcosystem from "@/components/landing/IntegrationEcosystem";
import Features from "@/components/landing/Features";
import EarlyAccessCTA from "@/components/landing/EarlyAccessCTA";
import Footer from "@/components/landing/Footer";

export default function HomePage() {
  const { status } = useSession();
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2400); // keep splash visible a bit longer before showing navbar/content
    return () => clearTimeout(timer);
  }, [showSplash]);

  useEffect(() => {
    // Only redirect authenticated users away from home page
    // Redirect immediately to prevent showing landing page
    if (status === "authenticated") {
      // Check if we just signed in (session storage flag set by signin page)
      const justSignedIn = typeof window !== "undefined" && 
        sessionStorage.getItem("justSignedIn") === "true";
      
      // If we just signed in, clear the flag and redirect immediately
      if (justSignedIn) {
        sessionStorage.removeItem("justSignedIn");
        // Redirect immediately to dashboard - signin page will handle role-based redirect
        router.replace("/dashboard");
        return;
      }
      
      // For other authenticated users, redirect immediately based on role
      const redirectImmediately = async () => {
        try {
          const session = await fetch("/api/auth/session").then((res) => res.json());
          const userRole = session?.user?.role;
          
          if (userRole === "super_admin") {
            router.replace("/super-admin/dashboard");
          } else if (userRole) {
            router.replace("/dashboard");
          } else {
            // Fallback to dashboard if role not available
            router.replace("/dashboard");
          }
        } catch (error) {
          // If session fetch fails, redirect to dashboard as fallback
          console.error("Failed to fetch session for redirect:", error);
          router.replace("/dashboard");
        }
      };
      
      redirectImmediately();
    }
  }, [status, router]);

  // Avoid flashing the landing page when we already know we're going to redirect.
  if (status === "loading" || status === "authenticated") {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
          padding: "2rem",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1rem", fontWeight: 600, color: "#1a1625" }}>
            Redirecting to dashboard...
          </div>
          <div style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#6b6678" }}>
            Please wait.
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      {/* Splash with Aaptor logo fading out on initial landing */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-white via-[#F8FDF9] to-[#F0FDF4]"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 1.6, ease: "easeOut" }}
            >
              <Image
                src="/Aaptor%20Logo.png"
                alt="Aaptor logo"
                width={220}
                height={260}
                className="w-40 md:w-56 h-auto object-contain"
                priority
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showSplash && (
        <main>
          <ScrollProgress />
          <Navbar />
          <Hero />
          <VideoShowcase />
          <SkillCapabilityExplainer />
          <PlatformCompetencies />
          <AaptorJourney />
          <ProctoringSecurity />
          <IntegrationEcosystem />
          <Features />
          <EarlyAccessCTA />
          <Footer />
        </main>
      )}
    </>
  );
}
