'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import {
  Target,
  Binary,
  FileText,
  Brain,
  Cloud,
  GitBranch,
  Database,
  Palette,
  Sparkles,
} from 'lucide-react';

export default function PlatformCompetencies() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.2,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      },
    },
  };

  const competencies = [
    {
      id: 1,
      icon: <Target className="w-6 h-6" />,
      iconBg: 'bg-gradient-to-br from-[#FF6B9D]/20 to-[#FFA5C3]/20',
      iconColor: 'text-[#FF6B9D]',
      title: 'General Assessment',
      description:
        'Role-based AI-generated assessments with MCQ, subjective, and pseudocode questions',
      tags: ['AI-Generated', 'Multi-Format'],
    },
    {
      id: 2,
      icon: <Binary className="w-6 h-6" />,
      iconBg: 'bg-gradient-to-br from-[#FFD93D]/20 to-[#FFE67C]/20',
      iconColor: 'text-[#FFB000]',
      title: 'DSA Assessment',
      description:
        'Data structures & algorithms testing with Python, Java, C++, and custom evaluator',
      tags: ['Multi-Language', 'Real-Time'],
    },
    {
      id: 3,
      icon: <FileText className="w-6 h-6" />,
      iconBg: 'bg-gradient-to-br from-[#FFA500]/20 to-[#FFB84D]/20',
      iconColor: 'text-[#FF8C00]',
      title: 'Custom MCQ',
      description: 'Create custom MCQ and subjective questions with full manual control',
      tags: ['Custom Build', 'Flexible'],
    },
    {
      id: 4,
      icon: <Brain className="w-6 h-6" />,
      iconBg: 'bg-gradient-to-br from-[#9B59B6]/20 to-[#BB7FD9]/20',
      iconColor: 'text-[#9B59B6]',
      title: 'AI/ML Playground',
      description: 'AI-generated machine learning questions with automated answer evaluation',
      tags: ['Auto-Generated', 'AI-Graded'],
    },
    {
      id: 5,
      icon: <Cloud className="w-6 h-6" />,
      iconBg: 'bg-gradient-to-br from-[#9DE8B0]/30 to-[#B0EFC0]/30',
      iconColor: 'text-[#2D7A52]',
      title: 'Cloud Infrastructure',
      description: 'AWS cloud testing with EC2, CLI commands in real environment',
      tags: ['AWS', 'Hands-On'],
    },
    {
      id: 6,
      icon: <GitBranch className="w-6 h-6" />,
      iconBg: 'bg-gradient-to-br from-[#3498DB]/20 to-[#5DADE2]/20',
      iconColor: 'text-[#2980B9]',
      title: 'DevOps & CI/CD',
      description: 'GitHub Actions, Kubernetes, Docker, and pipeline automation testing',
      tags: ['Pipeline', 'Container'],
    },
    {
      id: 7,
      icon: <Database className="w-6 h-6" />,
      iconBg: 'bg-gradient-to-br from-[#E74C3C]/20 to-[#EC7063]/20',
      iconColor: 'text-[#C0392B]',
      title: 'Data Engineering',
      description: 'ETL pipelines, data processing, and warehouse solutions assessment',
      tags: ['ETL', 'Big Data'],
    },
    {
      id: 8,
      icon: <Palette className="w-6 h-6" />,
      iconBg: 'bg-gradient-to-br from-[#FF6B9D]/20 to-[#FFA5C3]/20',
      iconColor: 'text-[#E91E63]',
      title: 'UI/UX Design',
      description: 'Figma-like design environment for UI/UX capability assessment',
      tags: ['Interactive', 'Visual'],
    },
  ];

  return (
    <section
      ref={ref}
      className="relative py-20 md:py-32 px-4 md:px-8 bg-white overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white via-[#FAFFFE] to-white -z-10" />

      <div className="max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className="inline-flex items-center gap-2 bg-[#E8F9F0] px-4 py-2 rounded-full text-[#2D5F4A] text-sm font-semibold mb-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ delay: 0.2 }}
          >
            <Sparkles className="w-4 h-4" />
            Assessment Types
          </motion.div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#2D5F4A] mb-4">
            Comprehensive Competency Assessment
          </h2>
          <p className="text-base md:text-lg text-[#5A8B70] max-w-3xl mx-auto">
            Test, track, and transform every skill domain with AI-powered evaluations
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
        >
          {competencies.map((competency) => (
            <motion.div
              key={competency.id}
              variants={cardVariants}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className="group"
            >
              <div className="bg-white rounded-2xl p-6 border border-[#E8F9F0] shadow-sm hover:shadow-xl hover:border-[#C9F4D4] transition-all duration-300 h-full flex flex-col">
                <div
                  className={`w-14 h-14 ${competency.iconBg} rounded-xl flex items-center justify-center mb-4 ${competency.iconColor} group-hover:scale-110 transition-transform duration-300`}
                >
                  {competency.icon}
                </div>

                <h3 className="text-xl font-bold text-[#2D5F4A] mb-3 group-hover:text-[#1E5A3B] transition-colors">
                  {competency.title}
                </h3>

                <p className="text-sm text-[#5A8B70] leading-relaxed mb-4 flex-grow">
                  {competency.description}
                </p>

                <div className="flex flex-wrap gap-2">
                  {competency.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-[#E8F9F0] text-[#2D5F4A] px-3 py-1.5 rounded-full font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: 0.8 }}
        >
          <p className="text-base text-[#5A8B70] mb-6">
            Customize assessments for any role or skill domain
          </p>
          <button className="px-8 py-3.5 bg-gradient-to-r from-[#2D7A52] to-[#2D5F4A] text-white rounded-full font-semibold shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300">
            Explore All Competencies →
          </button>
        </motion.div>
      </div>
    </section>
  );
}


