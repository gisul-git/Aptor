'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { Github, Linkedin, BookOpen, MessageSquare, GraduationCap, FileCode } from 'lucide-react';

type IntegrationId = 'github' | 'jupyter' | 'linkedin' | 'coursera' | 'udemy' | 'slack';

type Integration = {
  id: IntegrationId;
  name: string;
  icon: JSX.Element;
  angle: number;
  radius: number;
  brandColor: string;
  description: string;
  contribution: string;
};

const INTEGRATIONS: Integration[] = [
  {
    id: 'github',
    name: 'GitHub',
    icon: <Github className="w-6 h-6" />,
    angle: -10,
    radius: 180,
    brandColor: '#181717',
    description: 'GitHub Connected',
    contribution: 'Ingesting commit activity, pull requests, and code review patterns as coding capability signals.',
  },
  {
    id: 'jupyter',
    name: 'Jupyter',
    icon: <FileCode className="w-6 h-6" />,
    angle: 55,
    radius: 200,
    brandColor: '#F37726',
    description: 'Jupyter Connected',
    contribution: 'Tracking notebook execution, experimentation depth, and data science workflows.',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: <Linkedin className="w-6 h-6" />,
    angle: 125,
    radius: 190,
    brandColor: '#0A66C2',
    description: 'LinkedIn Connected',
    contribution: 'Bringing in certifications, posts, and career signals to complete the capability picture.',
  },
  {
    id: 'coursera',
    name: 'Coursera',
    icon: <BookOpen className="w-6 h-6" />,
    angle: 190,
    radius: 190,
    brandColor: '#0056D2',
    description: 'Coursera Connected',
    contribution: 'Surfacing specialization progress and course outcomes as learning engagement signals.',
  },
  {
    id: 'udemy',
    name: 'Udemy',
    icon: <GraduationCap className="w-6 h-6" />,
    angle: 250,
    radius: 200,
    brandColor: '#A435F0',
    description: 'Udemy Connected',
    contribution: 'Capturing course completions, quiz performance, and learning momentum.',
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: <MessageSquare className="w-6 h-6" />,
    angle: 315,
    radius: 185,
    brandColor: '#4A154B',
    description: 'Slack Connected',
    contribution: 'Reading collaboration patterns, knowledge sharing, and participation signals.',
  },
];

function polarToCartesian(angleDeg: number, radius: number) {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: Math.cos(radians) * radius,
    y: Math.sin(radians) * radius,
  };
}

export default function IntegrationEcosystem() {
  const prefersReducedMotion = useReducedMotion();
  const [activeId, setActiveId] = useState<IntegrationId | null>(null);

  const activeIntegration = useMemo(
    () => INTEGRATIONS.find((i) => i.id === activeId) ?? null,
    [activeId],
  );

  const hubTitle = activeIntegration ? activeIntegration.description : 'Aaptor Capability Hub';
  const hubSubtitle =
    activeIntegration?.contribution ??
    'Ingesting capability signals from the tools your teams already use every day.';

  const containerVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.6,
        ease: [0.21, 0.8, 0.35, 1],
      },
    },
  };

  return (
    <section className="relative py-20 md:py-32 px-4 md:px-8 bg-gradient-to-b from-[#E8F9F0] via-white to-[#F8FDF9] overflow-hidden">
      {/* Background washes */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-10 right-16 h-80 w-80 rounded-full bg-[#C9F4D4]/30 blur-3xl" />
        <div className="absolute bottom-0 left-10 h-96 w-96 rounded-full bg-[#9DE8B0]/25 blur-3xl" />
      </div>

      <motion.div
        className="max-w-5xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
      >
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-[#1F2933] mb-4">
            Seamlessly Integrates With Your Tools
          </h2>
          <p className="text-base md:text-lg text-[#5A8B70]">
            Track capability growth across every platform employees use.
          </p>
        </div>

        {/* Hub + spokes */}
        <div className="mt-16 flex flex-col items-center">
          <motion.div
            className="relative h-[440px] w-full max-w-[520px] flex items-center justify-center"
            initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.98 }}
            whileInView={{
              opacity: 1,
              scale: 1,
            }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: prefersReducedMotion ? 0.3 : 0.6, ease: [0.21, 0.8, 0.35, 1] }}
          >
            {/* Outer ring */}
            <div className="absolute inset-10 rounded-full border border-dashed border-[#C9F4D4]/70" />
            <div className="absolute inset-24 rounded-full border border-[#E4F5EC]" />

            {/* Hub glow */}
            {!prefersReducedMotion && (
              <motion.div
                className="absolute h-52 w-52 rounded-full bg-[#2D7A52] blur-3xl opacity-30"
                animate={{ opacity: [0.15, 0.3, 0.15] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}

            {/* Center hub */}
            <motion.div
              className="relative z-10 flex h-40 w-40 flex-col items-center justify-center rounded-full bg-gradient-to-br from-[#1E5A3B] to-[#0F3B26] text-white shadow-[0_24px_80px_rgba(15,64,37,0.55)]"
              animate={
                prefersReducedMotion
                  ? {}
                  : {
                      scale: [1, 1.03, 1],
                    }
              }
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              aria-label="Aaptor capability hub"
            >
              <div className="text-xs tracking-[0.2em] uppercase text-emerald-100/80 mb-1">
                AAPTOR
              </div>
              <div className="text-sm font-semibold">Capability Hub</div>
            </motion.div>

            {/* Animated connector lines */}
            <svg
              className="absolute inset-0 h-full w-full pointer-events-none"
              aria-hidden="true"
            >
              {INTEGRATIONS.map((integration) => {
                const { x, y } = polarToCartesian(integration.angle, integration.radius);
                const isActive = activeId === integration.id;
                const strokeColor = isActive ? '#2D7A52' : '#A7DCC2';
                const dashArray = '2 8';
                return (
                  <motion.line
                    key={integration.id}
                    x1="50%"
                    y1="50%"
                    x2={256 + x}
                    y2={220 + y}
                    stroke={strokeColor}
                    strokeWidth={isActive ? 1.5 : 1}
                    strokeDasharray={dashArray}
                    initial={{ opacity: 0, pathLength: 0 }}
                    animate={{
                      opacity: isActive ? 0.9 : 0.6,
                      pathLength: 1,
                      strokeDashoffset: prefersReducedMotion ? 0 : [0, -40],
                    }}
                    transition={{
                      duration: prefersReducedMotion ? 0.6 : 5,
                      repeat: prefersReducedMotion ? 0 : Infinity,
                      ease: 'linear',
                    }}
                  />
                );
              })}
            </svg>

            {/* Integration nodes */}
            {INTEGRATIONS.map((integration) => {
              const { x, y } = polarToCartesian(integration.angle, integration.radius);
              const isActive = activeId === integration.id;

              return (
                <motion.button
                  key={integration.id}
                  type="button"
                  className="absolute flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-white text-slate-900 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500"
                  style={{
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                    borderColor: isActive ? integration.brandColor : 'rgba(148, 196, 171, 0.6)',
                    boxShadow: isActive
                      ? `0 12px 30px ${integration.brandColor}22`
                      : '0 8px 20px rgba(15, 23, 42, 0.08)',
                  }}
                  onMouseEnter={() => setActiveId(integration.id)}
                  onFocus={() => setActiveId(integration.id)}
                  onMouseLeave={() => setActiveId((current) => (current === integration.id ? null : current))}
                  onBlur={() => setActiveId((current) => (current === integration.id ? null : current))}
                  aria-label={integration.name}
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white"
                    style={{ color: isActive ? integration.brandColor : '#1F2933' }}
                  >
                    {integration.icon}
                  </span>
                </motion.button>
              );
            })}
          </motion.div>

          {/* Dynamic description panel */}
          <div className="mt-10 max-w-xl text-center text-sm md:text-base text-[#4B5563] space-y-2 px-4">
            <p className="font-semibold text-[#1F2933]">{hubTitle}</p>
            <p>{hubSubtitle}</p>
            <p className="pt-4 text-xs md:text-sm text-[#6B7280]">
              Signals are securely processed and contribute to AI‑driven capability scoring and
              longitudinal growth insights across your workforce.
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}


