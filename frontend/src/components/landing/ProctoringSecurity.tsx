'use client';

import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import {
  Shield,
  Copy,
  MousePointer,
  Lock,
  Eye,
  ScanEye,
  Video,
  UserCheck,
  Monitor,
  Brain,
  Zap,
  Check,
} from 'lucide-react';

type FeatureId =
  | 'copy'
  | 'tab'
  | 'browser'
  | 'focus'
  | 'gaze'
  | 'video'
  | 'screen'
  | 'face'
  | 'ai';

const features: {
  id: FeatureId;
  label: string;
  title: string;
  description: string;
  icon: JSX.Element;
  group: 'Behavioral' | 'System' | 'Environmental' | 'AI Analysis';
}[] = [
  {
    id: 'copy',
    label: 'Copy-Paste',
    title: 'Copy-Paste Restriction',
    description: 'Blocks copy, paste and select-all shortcuts to prevent sharing answers.',
    icon: <Copy className="w-5 h-5" />,
    group: 'System',
  },
  {
    id: 'tab',
    label: 'Tab Switching',
    title: 'Tab Switching Detection',
    description: 'Detects when candidates move away from the test window or open other tabs.',
    icon: <MousePointer className="w-5 h-5" />,
    group: 'System',
  },
  {
    id: 'browser',
    label: 'Browser Lock',
    title: 'Browser Lock-down',
    description: 'Restricts browser functions, shortcuts and developer tools during tests.',
    icon: <Lock className="w-5 h-5" />,
    group: 'System',
  },
  {
    id: 'focus',
    label: 'Focus',
    title: 'Focus Loss Tracking',
    description: 'Monitors window focus and flags unusual focus changes throughout the exam.',
    icon: <Eye className="w-5 h-5" />,
    group: 'Behavioral',
  },
  {
    id: 'gaze',
    label: 'Gaze',
    title: 'Gaze Survey',
    description:
      'Uses AI-based gaze and attention analysis to detect off-screen behavior and anomalous focus patterns during assessments.',
    icon: <ScanEye className="w-5 h-5" />,
    group: 'Behavioral',
  },
  {
    id: 'video',
    label: 'Live Video',
    title: 'Live Proctoring',
    description: 'Supports human and AI proctors with real-time audio/video feeds.',
    icon: <Video className="w-5 h-5" />,
    group: 'Environmental',
  },
  {
    id: 'screen',
    label: 'Screen',
    title: 'Screen Recording',
    description: 'Captures the full screen session for post-test review and auditing.',
    icon: <Monitor className="w-5 h-5" />,
    group: 'Environmental',
  },
  {
    id: 'face',
    label: 'Face',
    title: 'Face Mismatch Detection',
    description: 'Verifies that the same person remains in front of the camera throughout the test.',
    icon: <UserCheck className="w-5 h-5" />,
    group: 'Behavioral',
  },
  {
    id: 'ai',
    label: 'AI',
    title: 'AI Behavior Analysis',
    description: 'Correlates all signals to detect anomalies, impersonation and collusion.',
    icon: <Brain className="w-5 h-5" />,
    group: 'AI Analysis',
  },
];

export default function ProctoringSecurity() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [activeFeature, setActiveFeature] = useState<FeatureId>('gaze');

  const active = features.find((f) => f.id === activeFeature) ?? features[0];

  const systemSignals = features.filter((f) => f.group === 'System');
  const behavioralSignals = features.filter((f) => f.group === 'Behavioral');
  const environmentalSignals = features.filter((f) => f.group === 'Environmental');

  return (
    <section
      ref={ref}
      className="relative py-20 md:py-32 px-4 md:px-8 bg-gradient-to-b from-white via-[#FAFFFE] to-[#F0FDF4] overflow-hidden"
    >
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-24 left-10 w-80 h-80 bg-[#E8F9F0] rounded-full blur-3xl opacity-70" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#C9F4D4] rounded-full blur-3xl opacity-60" />
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full text-[#2D5F4A] text-sm font-semibold mb-6 shadow-sm border border-[#E8F9F0]">
            <Shield className="w-4 h-4 text-[#2D7A52]" />
            Security &amp; Proctoring
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#2D5F4A] mb-4 max-w-3xl mx-auto">
            Enterprise-Grade Security &amp; Proctoring
          </h2>
          <p className="text-base md:text-lg text-[#5A8B70] max-w-3xl mx-auto">
            A multi-layered security system built for capability-based assessments, combining
            real-time proctoring with AI-driven behavior intelligence.
          </p>
        </div>

        {/* Split layout: shield left, details right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          {/* Shield visualization */}
          <div className="relative flex items-center justify-center">
            <div className="relative w-[320px] h-[320px] md:w-[360px] md:h-[360px]">
              {/* outer halo */}
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-to-br from-[#9DE8B0]/40 to-[#C9F4D4]/40 blur-3xl"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              />

              {/* orbit ring */}
              <div className="absolute inset-6 rounded-full border border-dashed border-[#C9F4D4]/70" />

              {/* middle ring */}
              <div className="absolute inset-16 rounded-full border border-[#E8F9F0]" />

              {/* inner ring */}
              <div className="absolute inset-24 rounded-full border border-[#F0FDF4]" />

              {/* central shield */}
              <motion.div
                className="absolute inset-[100px] md:inset-[110px] rounded-3xl bg-gradient-to-br from-[#2D7A52] to-[#1E5A3B] shadow-[0_25px_70px_rgba(45,122,82,0.55)] flex flex-col items-center justify-center text-white"
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Shield className="w-10 h-10 mb-2" />
                <span className="text-xs uppercase tracking-[0.2em] text-white/70">
                  Shield
                </span>
                <span className="mt-1 text-sm font-semibold flex items-center gap-1">
                  <Zap className="w-4 h-4 text-[#C9F4D4]" />
                  Smart Proctoring
                </span>
              </motion.div>

              {/* orbiting feature pills */}
              {/* System signals (bottom row) */}
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-3 flex gap-3">
                {systemSignals.map((f) => (
                  <motion.button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFeature(f.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm bg-white/90 backdrop-blur-sm flex items-center gap-1 ${
                      activeFeature === f.id
                        ? 'border-[#E74C3C] text-[#E74C3C]'
                        : 'border-[#F0FDF4] text-[#2D5F4A]'
                    }`}
                    whileHover={{ y: -2 }}
                  >
                    {f.icon}
                    {f.label}
                  </motion.button>
                ))}
              </div>

              {/* Behavioral signals (sides) */}
              <div className="absolute -left-4 top-1/2 -translate-y-1/2 flex flex-col gap-3">
                {behavioralSignals.slice(0, 2).map((f) => (
                  <motion.button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFeature(f.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm bg-white/90 backdrop-blur-sm flex items-center gap-1 ${
                      activeFeature === f.id
                        ? 'border-[#2D7A52] text-[#2D7A52]'
                        : 'border-[#F0FDF4] text-[#2D5F4A]'
                    }`}
                    whileHover={{ x: -2 }}
                  >
                    {f.icon}
                    {f.label}
                  </motion.button>
                ))}
              </div>

              <div className="absolute -right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 items-end">
                {behavioralSignals.slice(2).map((f) => (
                  <motion.button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFeature(f.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm bg-white/90 backdrop-blur-sm flex items-center gap-1 ${
                      activeFeature === f.id
                        ? 'border-[#2D7A52] text-[#2D7A52]'
                        : 'border-[#F0FDF4] text-[#2D5F4A]'
                    }`}
                    whileHover={{ x: 2 }}
                  >
                    {f.icon}
                    {f.label}
                  </motion.button>
                ))}
              </div>

              {/* Environmental + AI signals (top row) */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-3 flex gap-3">
                {[...environmentalSignals, ...features.filter((f) => f.group === 'AI Analysis')].map(
                  (f) => (
                  <motion.button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFeature(f.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm bg-white/90 backdrop-blur-sm flex items-center gap-1 ${
                      activeFeature === f.id
                        ? 'border-[#9B59B6] text-[#9B59B6]'
                        : 'border-[#F0FDF4] text-[#2D5F4A]'
                    }`}
                    whileHover={{ y: 2 }}
                  >
                    {f.icon}
                    {f.label}
                  </motion.button>
                  ),
                )}
              </div>
            </div>
          </div>

          {/* Details panel */}
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.35 }}
                className="bg-white/80 backdrop-blur-lg rounded-3xl border border-[#E8F9F0] shadow-xl p-6 md:p-8"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F0FDF4] text-xs font-semibold text-[#2D5F4A] mb-4">
                  <span className="w-2 h-2 rounded-full bg-[#2D7A52]" />
                  {active.group}
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E8F9F0] flex items-center justify-center text-[#2D7A52]">
                    {active.icon}
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold text-[#2D5F4A]">
                    {active.title}
                  </h3>
                </div>

                <p className="text-sm md:text-base text-[#5A8B70] mb-6">{active.description}</p>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-[#2D5F4A]">
                    <Check className="w-4 h-4 text-[#2D7A52]" />
                    Works together with other shield segments to keep every assessment secure.
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#2D5F4A]">
                    <Brain className="w-4 h-4 text-[#9B59B6]" />
                    Signals feed into AI behavior analysis for real-time risk scoring.
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-3 py-1 rounded-full bg-[#E8F9F0] text-[#2D5F4A] font-medium">
                    Copy-paste, tabs, video, gaze, AI — all connected
                  </span>
                  <span className="px-3 py-1 rounded-full bg-[#E8F9F0] text-[#2D5F4A] font-medium flex items-center gap-1">
                    <Zap className="w-3 h-3 text-[#2D7A52]" />
                    Real-time alerts
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Security score */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <div className="inline-flex items-center gap-3 bg-white rounded-2xl border border-[#E8F9F0] px-5 py-3 shadow-sm">
                <Shield className="w-6 h-6 text-[#2D7A52]" />
                <div>
                  <div className="text-xs text-[#5A8B70]">Security score</div>
                  <div className="text-xl font-bold text-[#2D7A52]">100%</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#5A8B70]">
                <div className="w-6 h-1.5 rounded-full bg-[#2D7A52]" />
                <div className="w-6 h-1.5 rounded-full bg-[#9DE8B0]" />
                <span className="font-medium">All layers active</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-xs md:text-sm text-[#5A8B70]">
          Hover and click different shield segments to explore how our security features work
          together.
        </div>
      </div>
    </section>
  );
}

