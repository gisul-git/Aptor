'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, ShieldCheck, Users, Building2 } from 'lucide-react';

export default function Features() {
  const prefersReducedMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.6,
        ease: [0.21, 0.8, 0.35, 1],
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 12 },
    visible: (index: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.45,
        ease: [0.21, 0.8, 0.35, 1],
        delay: prefersReducedMotion ? 0 : 0.1 + index * 0.1,
      },
    }),
  };

  return (
    <section id="features" className="py-16 sm:py-20 md:py-24 bg-white">
      <motion.div
        className="max-w-6xl px-4 sm:px-6 md:px-8 lg:px-12 mx-auto"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
      >
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-[#1F2933] mb-4">
            AI‑Powered Capability Intelligence
          </h2>
          <p className="text-base md:text-lg text-[#5A8B70]">
            One platform that turns everyday activity into meaningful growth signals for your people and your business.
          </p>

          {/* Subtle AI-assisted badge */}
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#E5F7EE] bg-[#F4FBF7] px-4 py-1.5 text-xs font-medium text-[#336155]">
            <Sparkles className="w-3.5 h-3.5 text-[#2D7A52]" aria-hidden="true" />
            <span>AI‑assisted, human‑led decisions</span>
          </div>

          {/* Gradient divider */}
          <div className="mt-10 h-px w-40 mx-auto bg-gradient-to-r from-transparent via-[#C9F4D4] to-transparent" />
        </div>

        {/* Stakeholder Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Employees */}
          <motion.article
            className="relative flex flex-col rounded-2xl border border-[#D5E9FF] bg-gradient-to-b from-[#F5FBFF] to-white p-8 lg:p-9 transition-transform duration-150 ease-out hover:-translate-y-1 hover:border-sky-300 hover:shadow-[0_18px_40px_rgba(59,130,246,0.16)]"
            variants={cardVariants}
            custom={0}
            initial="hidden"
            whileInView="visible"
            aria-labelledby="stakeholder-employees"
          >
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-sky-100 bg-sky-50/70 text-sky-700 shadow-sm">
              <Users className="w-6 h-6" aria-hidden="true" />
            </div>

            <h3 id="stakeholder-employees" className="text-xl md:text-2xl font-semibold text-[#1F2933] mb-1">
              For Employees
            </h3>
            <p className="text-sm md:text-base text-[#445566] mb-6">
              Clear growth paths, visible progress, real outcomes.
            </p>

            <ul className="mt-2 space-y-3 text-sm text-[#4B5563]">
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500 flex-shrink-0" />
                <p className="leading-relaxed">
                  Personalized learning paths that are continuously tuned to assessed capability
                  gaps and strengths.
                </p>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500 flex-shrink-0" />
                <p className="leading-relaxed">
                  Transparent progress and capability tracking that makes growth visible and
                  shareable with managers.
                </p>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500 flex-shrink-0" />
                <p className="leading-relaxed">
                  Aaptor ID as a living capability passport – one place for skills, experiences, and
                  verified outcomes.
                </p>
              </li>
            </ul>
          </motion.article>

          {/* Managers */}
          <motion.article
            className="relative flex flex-col rounded-2xl border border-[#D3F2E2] bg-gradient-to-b from-[#F8FDF9] to-white p-8 lg:p-9 transition-transform duration-150 ease-out hover:-translate-y-1 hover:border-emerald-300 hover:shadow-[0_18px_40px_rgba(16,185,129,0.18)]"
            variants={cardVariants}
            custom={1}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            aria-labelledby="stakeholder-managers"
          >
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50/70 text-emerald-700 shadow-sm">
              <ShieldCheck className="w-6 h-6" aria-hidden="true" />
            </div>

            <h3
              id="stakeholder-managers"
              className="text-xl md:text-2xl font-semibold text-[#1F2933] mb-1"
            >
              For Managers
            </h3>
            <p className="text-sm md:text-base text-[#445566] mb-6">
              Confident, people‑first decisions grounded in capability reality.
            </p>

            <ul className="mt-2 space-y-3 text-sm text-[#4B5563]">
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <p className="leading-relaxed">
                  Role‑based capability views for each report, not just course completions or badge
                  counts.
                </p>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <p className="leading-relaxed">
                  AI‑assisted recommendations on where to focus coaching, feedback, and learning
                  time.
                </p>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <p className="leading-relaxed">
                  A shared capability language across hiring, performance, and development
                  conversations.
                </p>
              </li>
            </ul>
          </motion.article>

          {/* Organizations */}
          <motion.article
            className="relative flex flex-col rounded-2xl border border-[#E2D8FF] bg-gradient-to-b from-[#F7F5FF] to-white p-8 lg:p-9 transition-transform duration-150 ease-out hover:-translate-y-1 hover:border-violet-300 hover:shadow-[0_18px_40px_rgba(129,140,248,0.18)]"
            variants={cardVariants}
            custom={2}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            aria-labelledby="stakeholder-orgs"
          >
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-violet-100 bg-violet-50/70 text-violet-700 shadow-sm">
              <Building2 className="w-6 h-6" aria-hidden="true" />
            </div>

            <h3 id="stakeholder-orgs" className="text-xl md:text-2xl font-semibold text-[#1F2933] mb-1">
              For Organizations
            </h3>
            <p className="text-sm md:text-base text-[#445566] mb-6">
              Turn capability data into strategic advantage.
            </p>

            <ul className="mt-2 space-y-3 text-sm text-[#4B5563]">
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                <p className="leading-relaxed">
                  Capability dashboards across roles, teams, and regions to reveal strengths and
                  critical gaps.
                </p>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                <p className="leading-relaxed">
                  Forward‑looking insight into skill risk and opportunity, grounded in real
                  assessment data.
                </p>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                <p className="leading-relaxed">
                  Measurable ROI on learning investments through a shared language of capability and
                  outcomes.
                </p>
              </li>
            </ul>
          </motion.article>
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 flex flex-col items-center gap-4">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-[#2D7A52] px-8 py-3 text-sm md:text-base font-semibold text-white shadow-[0_14px_30px_rgba(45,122,82,0.25)] hover:bg-[#256845] hover:shadow-[0_18px_40px_rgba(45,122,82,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2D7A52] transition-colors duration-150"
            aria-label="Explore how Aaptor works"
          >
            Explore How Aaptor Works
          </button>

          <button
            type="button"
            className="text-sm md:text-base font-medium text-[#2D7A52] hover:text-[#1E5A3B] inline-flex items-center gap-1 focus-visible:outline-none focus-visible:underline"
            aria-label="See capability scoring in action"
          >
            <span>See Capability Scoring in Action</span>
            <ArrowRightIcon />
          </button>
        </div>
      </motion.div>
    </section>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5 10h8m0 0-3-3m3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

