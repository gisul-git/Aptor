'use client'

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Navbar from "@/components/landing/Navbar";
import ScrollProgress from "@/components/landing/ScrollProgress";
import Hero from "@/components/landing/Hero";
import SocialProof from "@/components/landing/SocialProof";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import Testimonials from "@/components/landing/Testimonials";
import Pricing from "@/components/landing/Pricing";
import FAQ from "@/components/landing/FAQ";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/landing/Footer";

export default function HomePage() {
  const { status } = useSession();
  const router = useRouter();

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
    <main>
      <ScrollProgress />
      <Navbar />
      <Hero />
      <SocialProof />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
