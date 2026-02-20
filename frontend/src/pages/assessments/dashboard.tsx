import React, { useState } from 'react';
import { FileText, Code2, Cloud, Brain } from 'lucide-react';
import { Sidebar } from '../../components/assessments/layout/Sidebar';
import { Navbar } from '../../components/assessments/layout/Navbar';
import { HeroSection3D } from '../../components/assessments/features/HeroSection3D';
import { CreationWizard } from '../../components/assessments/features/CreationWizard';
import { ScrollReveal } from '../../components/assessments/ui/ScrollReveal';
import { ActionCard } from '../../components/assessments/ui/ActionCard';
import { AnimatedTitle } from '../../components/assessments/ui/AnimatedTitle';

export default function Dashboard() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  return (
    <>
      <CreationWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} />
      
      {/* Background Elements */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#E8FAF0]">
         <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#C9F4D4] rounded-full blur-[120px] opacity-60" />
         <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#C9F4D4] rounded-full blur-[120px] opacity-60" />
      </div>

      <div className={`h-screen font-sans text-[#1E5A3B] p-2 lg:p-4 flex gap-4 overflow-hidden selection:bg-[#C9F4D4] selection:text-[#1E5A3B] relative z-10 transition-all duration-300 ${isWizardOpen ? 'scale-95 blur-sm opacity-50 pointer-events-none' : ''}`}>
        
        <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
        
        <main className="flex-1 bg-white/30 border border-white/50 rounded-[2.5rem] shadow-sm relative flex flex-col overflow-hidden backdrop-blur-md animate-content-fade" style={{ animationDelay: '200ms' }}>
          
          <Navbar onMenuClick={() => setIsMobileMenuOpen(true)} onOpenWizard={() => setIsWizardOpen(true)} />

          {/* ▼ UPDATED SCROLL CONTAINER ▼ */}
          <div 
            className="flex-1 overflow-y-auto px-6 lg:px-12 pt-28 pb-12 scroll-smooth mint-scrollbar pr-2"
            style={{ WebkitOverflowScrolling: 'touch' }} 
          >
            <div className="max-w-6xl mx-auto">
              
              <div className="text-center mb-16">
                 <HeroSection3D />
                 <AnimatedTitle text="Let's Create Something Great" />
                 <p className="text-lg text-[#2D7A52] max-w-2xl mx-auto font-medium opacity-0 animate-content-fade" style={{ animationDelay: '1000ms', animationFillMode: 'forwards' }}>
                    Build an AI-powered assessment in 5 minutes. Select a module below to get started.
                 </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 pb-12">
                <ScrollReveal delay={100}>
                  <ActionCard onClick={() => setIsWizardOpen(true)} icon={FileText} title="Assessment" description="Create comprehensive evaluations with MCQ + Coding + Subjective questions." />
                </ScrollReveal>
                <ScrollReveal delay={200}>
                  <ActionCard onClick={() => setIsWizardOpen(true)} icon={Code2} title="DSA Coding" description="Challenge candidates with real-world Data Structures & Algorithms problems." />
                </ScrollReveal>
                <ScrollReveal delay={300}>
                  <ActionCard onClick={() => setIsWizardOpen(true)} icon={Cloud} title="Cloud Labs" description="Hands-on environments for Real AWS, Azure, and GCP Labs." />
                </ScrollReveal>
                <ScrollReveal delay={400}>
                  <ActionCard onClick={() => setIsWizardOpen(true)} icon={Brain} title="AI/ML" description="Assess proficiency in ML Models, Deployment, and Data Science." />
                </ScrollReveal>
              </div>

            </div>
          </div>
        </main>
      </div>
    </>
  );
}