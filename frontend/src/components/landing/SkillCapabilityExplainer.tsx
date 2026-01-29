'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import {
  Code,
  Database,
  Server,
  Laptop,
  BarChart3,
  GitBranch,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export default function SkillCapabilityExplainer() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [activeExample, setActiveExample] = useState<'fullstack' | 'dataengineer' | 'devops'>('fullstack');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      },
    },
  };

  const badgeVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: (i: number) => ({
      opacity: 1,
      scale: 1,
      transition: {
        delay: i * 0.03,
        duration: 0.3,
      },
    }),
  };

  const examples = {
    fullstack: {
      capability: {
        title: 'Full-Stack Developer',
        subtitle: 'Complete professional expertise',
        icon: <Laptop className="w-8 h-8" />,
        badge: 'CAPABILITY',
      },
      competencies: [
        {
          title: 'Front-End',
          icon: <Code className="w-5 h-5" />,
          skills: ['HTML', 'CSS', 'JavaScript', 'React'],
        },
        {
          title: 'Back-End',
          icon: <Server className="w-5 h-5" />,
          skills: ['Python', 'Node.js', 'Express', 'REST APIs'],
        },
        {
          title: 'Database',
          icon: <Database className="w-5 h-5" />,
          skills: ['SQL', 'MongoDB', 'Redis'],
        },
      ],
      allSkills: [
        'HTML',
        'CSS',
        'JavaScript',
        'React',
        'Python',
        'Node.js',
        'Express',
        'REST APIs',
        'SQL',
        'MongoDB',
        'Redis',
        'Git',
      ],
    },
    dataengineer: {
      capability: {
        title: 'Data Engineer',
        subtitle: 'Data infrastructure expertise',
        icon: <BarChart3 className="w-8 h-8" />,
        badge: 'CAPABILITY',
      },
      competencies: [
        {
          title: 'Data Processing',
          icon: <Code className="w-5 h-5" />,
          skills: ['Python', 'Spark', 'Pandas', 'NumPy'],
        },
        {
          title: 'Data Pipeline',
          icon: <Server className="w-5 h-5" />,
          skills: ['Airflow', 'Kafka', 'ETL', 'Stream'],
        },
        {
          title: 'Data Storage',
          icon: <Database className="w-5 h-5" />,
          skills: ['SQL', 'NoSQL', 'Data Warehouse'],
        },
      ],
      allSkills: [
        'Python',
        'Spark',
        'Pandas',
        'NumPy',
        'Airflow',
        'Kafka',
        'ETL',
        'Stream',
        'SQL',
        'NoSQL',
        'Data Warehouse',
        'AWS',
      ],
    },
    devops: {
      capability: {
        title: 'DevOps Engineer',
        subtitle: 'Infrastructure & automation expertise',
        icon: <GitBranch className="w-8 h-8" />,
        badge: 'CAPABILITY',
      },
      competencies: [
        {
          title: 'CI/CD',
          icon: <Code className="w-5 h-5" />,
          skills: ['GitHub Actions', 'Jenkins', 'GitLab CI'],
        },
        {
          title: 'Containers',
          icon: <Server className="w-5 h-5" />,
          skills: ['Docker', 'Kubernetes', 'Helm'],
        },
        {
          title: 'Cloud',
          icon: <Database className="w-5 h-5" />,
          skills: ['AWS', 'Azure', 'Terraform'],
        },
      ],
      allSkills: [
        'GitHub Actions',
        'Jenkins',
        'GitLab CI',
        'Docker',
        'Kubernetes',
        'Helm',
        'AWS',
        'Azure',
        'Terraform',
        'Linux',
        'Bash',
        'Python',
      ],
    },
  };

  const currentExample = examples[activeExample];

  return (
    <section
      ref={ref}
      className="relative py-20 md:py-32 px-4 md:px-8 bg-gradient-to-b from-[#F0FDF4] via-[#F8FDF9] to-white overflow-hidden"
    >
      {/* Decorative Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#C9F4D4]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#9DE8B0]/15 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full text-[#2D5F4A] text-sm font-semibold mb-6 shadow-sm border border-[#C9F4D4]">
            <Sparkles className="w-4 h-4 text-[#9DE8B0]" />
            Core Concept
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#2D5F4A] mb-4">
            Understanding Capability Building
          </h2>
          <p className="text-base md:text-lg text-[#5A8B70] max-w-2xl mx-auto">
            Aaptor connects skills into end‑to‑end capabilities and tracks how they compound over time.
          </p>
        </motion.div>

        {/* Example Selector Tabs */}
        <motion.div
          className="flex justify-center gap-3 mb-12 flex-wrap"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.3 }}
        >
          <button
            onClick={() => setActiveExample('fullstack')}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center gap-2 ${
              activeExample === 'fullstack'
                ? 'bg-[#2D7A52] text-white shadow-lg'
                : 'bg-white text-[#2D5F4A] border border-[#C9F4D4] hover:border-[#9DE8B0]'
            }`}
          >
            <Code className="w-4 h-4" />
            Full-Stack Developer
          </button>
          <button
            onClick={() => setActiveExample('dataengineer')}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center gap-2 ${
              activeExample === 'dataengineer'
                ? 'bg-[#2D7A52] text-white shadow-lg'
                : 'bg-white text-[#2D5F4A] border border-[#C9F4D4] hover:border-[#9DE8B0]'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Data Engineer
          </button>
          <button
            onClick={() => setActiveExample('devops')}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center gap-2 ${
              activeExample === 'devops'
                ? 'bg-[#2D7A52] text-white shadow-lg'
                : 'bg-white text-[#2D5F4A] border border-[#C9F4D4] hover:border-[#9DE8B0]'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            DevOps Engineer
          </button>
        </motion.div>

        {/* Main Visualization */}
        <motion.div
          className="max-w-5xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
        >
          {/* CAPABILITY CARD */}
          <motion.div className="flex justify-center mb-8" variants={cardVariants}>
            <motion.div
              className="relative group"
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3 }}
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-[#2D7A52] to-[#1E5A3B] rounded-2xl blur opacity-25 group-hover:opacity-40 transition-opacity" />

              <div className="relative bg-gradient-to-br from-[#2D7A52] to-[#1E5A3B] text-white px-8 py-6 rounded-2xl shadow-xl w-full max-w-sm">
                <div className="absolute -top-3 right-6 bg-white text-[#2D7A52] text-xs font-bold px-3 py-1 rounded-full shadow">
                  {currentExample.capability.badge}
                </div>

                <div className="flex justify-center mb-3">
                  <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center text-3xl">
                    {currentExample.capability.icon}
                  </div>
                </div>

                <h3 className="text-2xl md:text-3xl font-bold text-center mb-2">
                  {currentExample.capability.title}
                </h3>

                <p className="text-sm text-center opacity-90">
                  {currentExample.capability.subtitle}
                </p>
              </div>
            </motion.div>
          </motion.div>

          {/* COMPETENCY CARDS */}
          <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8" variants={cardVariants}>
            {currentExample.competencies.map((competency) => (
              <motion.div
                key={competency.title}
                className="relative group"
                whileHover={{ scale: 1.03, y: -4 }}
                transition={{ duration: 0.3 }}
              >
                <div className="absolute -inset-0.5 bg-[#9DE8B0] rounded-xl blur opacity-0 group-hover:opacity-30 transition-opacity" />

                <div className="relative bg-gradient-to-br from-[#B0EFC0] to-[#9DE8B0] rounded-xl overflow-hidden shadow-lg">
                  <div className="absolute -top-2 right-4 bg-white text-[#2D7A52] text-xs font-bold px-2 py-1 rounded-full shadow text-[10px]">
                    COMPETENCY
                  </div>

                  <div className="p-5 pb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-white/50 rounded-lg flex items-center justify-center text-[#2D5F4A]">
                        {competency.icon}
                      </div>
                      <h4 className="text-lg font-bold text-[#2D5F4A]">{competency.title}</h4>
                    </div>
                  </div>

                  <div className="bg-white p-4 mx-3 mb-3 rounded-lg">
                    <div className="flex flex-wrap gap-1.5">
                      {competency.skills.map((skill) => (
                        <span
                          key={skill}
                          className="text-xs bg-[#E8F9F0] text-[#2D5F4A] px-2 py-1 rounded"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* SKILL BADGES */}
          <motion.div className="flex justify-center gap-2 flex-wrap" variants={cardVariants}>
            {currentExample.allSkills.map((skill, index) => (
              <motion.div
                key={skill}
                className="bg-white hover:bg-[#F0FDF4] px-3 py-1.5 rounded-full text-sm text-[#2D5F4A] border border-[#C9F4D4] hover:border-[#9DE8B0] shadow-sm cursor-default transition-all duration-200"
                variants={badgeVariants}
                custom={index}
                whileHover={{ scale: 1.05, y: -2 }}
              >
                {skill}
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

      </div>
    </section>
  );
}
