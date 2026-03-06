'use client'

import { useEffect, useState } from "react";
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
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2400);
    return () => clearTimeout(timer);
  }, [showSplash]);

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
