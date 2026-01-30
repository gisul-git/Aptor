'use client';

import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useState, useRef } from 'react';
import {
  Code,
  Server,
  Database,
  Laptop,
  BarChart3,
  GitBranch,
  Sparkles,
} from 'lucide-react';

export default function SkillCapabilityExplainer() {
  const [activeRole, setActiveRole] = useState('fullstack');
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);
  const [hoveredCompetency, setHoveredCompetency] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  // Role configurations
  const roles = {
    fullstack: {
      id: 'fullstack',
      name: 'Full-Stack Developer',
      icon: <Code className="w-5 h-5" />,
      capability: {
        title: 'Full-Stack Developer',
        subtitle: 'Complete professional expertise',
        icon: <Laptop className="w-10 h-10" />,
      },
      competencies: [
        {
          id: 'frontend',
          title: 'Front-End',
          icon: <Code className="w-6 h-6" />,
          skills: ['HTML', 'CSS', 'JavaScript', 'React'],
          color: '#9DE8B0',
        },
        {
          id: 'backend',
          title: 'Back-End',
          icon: <Server className="w-6 h-6" />,
          skills: ['Python', 'Node.js', 'Express', 'REST APIs'],
          color: '#B0EFC0',
        },
        {
          id: 'database',
          title: 'Database',
          icon: <Database className="w-6 h-6" />,
          skills: ['SQL', 'MongoDB', 'Redis'],
          color: '#9DE8B0',
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
      id: 'dataengineer',
      name: 'Data Engineer',
      icon: <BarChart3 className="w-5 h-5" />,
      capability: {
        title: 'Data Engineer',
        subtitle: 'Data infrastructure expertise',
        icon: <BarChart3 className="w-10 h-10" />,
      },
      competencies: [
        {
          id: 'processing',
          title: 'Data Processing',
          icon: <Code className="w-6 h-6" />,
          skills: ['Python', 'Spark', 'Pandas'],
          color: '#9DE8B0',
        },
        {
          id: 'pipeline',
          title: 'Data Pipeline',
          icon: <Server className="w-6 h-6" />,
          skills: ['Airflow', 'Kafka', 'ETL'],
          color: '#B0EFC0',
        },
        {
          id: 'storage',
          title: 'Data Storage',
          icon: <Database className="w-6 h-6" />,
          skills: ['SQL', 'NoSQL', 'Warehouse'],
          color: '#9DE8B0',
        },
      ],
      allSkills: [
        'Python',
        'Spark',
        'Pandas',
        'Airflow',
        'Kafka',
        'ETL',
        'SQL',
        'NoSQL',
        'Warehouse',
        'AWS',
        'Docker',
        'Git',
      ],
    },
    devops: {
      id: 'devops',
      name: 'DevOps Engineer',
      icon: <GitBranch className="w-5 h-5" />,
      capability: {
        title: 'DevOps Engineer',
        subtitle: 'Infrastructure automation expertise',
        icon: <GitBranch className="w-10 h-10" />,
      },
      competencies: [
        {
          id: 'cicd',
          title: 'CI/CD',
          icon: <Code className="w-6 h-6" />,
          skills: ['GitHub Actions', 'Jenkins', 'GitLab CI'],
          color: '#9DE8B0',
        },
        {
          id: 'containers',
          title: 'Containers',
          icon: <Server className="w-6 h-6" />,
          skills: ['Docker', 'Kubernetes', 'Helm'],
          color: '#B0EFC0',
        },
        {
          id: 'cloud',
          title: 'Cloud',
          icon: <Database className="w-6 h-6" />,
          skills: ['AWS', 'Azure', 'Terraform'],
          color: '#9DE8B0',
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

  const currentRole = roles[activeRole as keyof typeof roles];

  // Helper: Find which competency a skill belongs to
  const getSkillCompetency = (skillName: string) => {
    return currentRole.competencies.find((comp) => comp.skills.includes(skillName));
  };

  // Animation variants
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <section
      ref={sectionRef}
      className="relative py-20 md:py-32 px-4 md:px-8 bg-gradient-to-b from-[#E8F9F0] via-[#F0FDF4] to-white overflow-hidden"
    >
      {/* Background Elements */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#C9F4D4]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#9DE8B0]/15 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full text-[#2D5F4A] text-sm font-semibold mb-6 shadow-sm border border-[#E8F9F0]"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.2 }}
          >
            <Sparkles className="w-4 h-4 text-[#9DE8B0]" />
            Core Concept
          </motion.div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#2D5F4A] mb-4">
            Understanding Capability Building
          </h2>
          <p className="text-base md:text-lg text-[#5A8B70] max-w-2xl mx-auto">
            Aaptor connects skills into end-to-end capabilities and tracks how they compound over
            time.
          </p>
        </motion.div>

        {/* Role Tab Switcher */}
        <motion.div
          className="flex justify-center gap-3 mb-16 flex-wrap"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.3 }}
        >
          {Object.values(roles).map((role) => (
            <button
              key={role.id}
              onClick={() => setActiveRole(role.id)}
              className={`px-5 py-3 rounded-xl font-medium text-sm transition-all duration-300 flex items-center gap-2 ${
                activeRole === role.id
                  ? 'bg-[#2D7A52] text-white shadow-lg scale-105'
                  : 'bg-white text-[#2D5F4A] border-2 border-[#E8F9F0] hover:border-[#C9F4D4] hover:shadow-md'
              }`}
            >
              {role.icon}
              {role.name}
            </button>
          ))}
        </motion.div>

        {/* Main Graph Visualization */}
        <div ref={containerRef} className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeRole}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-0"
            >
              {/* CAPABILITY CARD (Top) */}
              <motion.div
                className="flex justify-center mb-16"
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 100 }}
              >
                <div className="relative max-w-md w-full">
                  {/* Badge */}
                  <div className="absolute -top-3 right-8 bg-white text-[#2D5F4A] text-xs font-bold px-4 py-1.5 rounded-full shadow-md z-10 border-2 border-[#E8F9F0]">
                    CAPABILITY
                  </div>

                  <motion.div
                    className="bg-gradient-to-br from-[#2D7A52] to-[#1E5A3B] text-white px-8 py-10 rounded-3xl shadow-2xl"
                    whileHover={{
                      y: -8,
                      scale: 1.02,
                      boxShadow: '0 30px 60px -12px rgba(45, 122, 82, 0.5)',
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Icon */}
                    <div className="flex justify-center mb-5">
                      <motion.div
                        className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white"
                        whileHover={{ rotate: 360, scale: 1.1 }}
                        transition={{ duration: 0.6 }}
                      >
                        {currentRole.capability.icon}
                      </motion.div>
                    </div>

                    {/* Title */}
                    <h3 className="text-2xl md:text-3xl font-bold text-center mb-2 text-white">
                      {currentRole.capability.title}
                    </h3>

                    {/* Subtitle */}
                    <p className="text-sm text-center text-white/90">
                      {currentRole.capability.subtitle}
                    </p>
                  </motion.div>
                </div>
              </motion.div>

              {/* Curved Lines - Capability to Competencies */}
              <div className="relative h-24 -my-8">
                <svg
                  className="absolute inset-0 w-full h-full"
                  style={{ overflow: 'visible' }}
                  viewBox="0 0 1000 200"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#2D7A52" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#9DE8B0" stopOpacity="0.6" />
                    </linearGradient>
                  </defs>

                  {/* Curved lines from Capability to each Competency */}
                  {currentRole.competencies.map((competency, index) => {
                    const totalComps = currentRole.competencies.length;
                    const startX = 500;
                    const startY = 0;
                    const endX = (1000 / (totalComps + 1)) * (index + 1);
                    const endY = 200;

                    // Control points for smooth curve
                    const cp1X = startX;
                    const cp1Y = startY + 80;
                    const cp2X = endX;
                    const cp2Y = endY - 80;

                    const isHighlighted = hoveredCompetency === competency.id;

                    return (
                      <motion.path
                        key={index}
                        d={`M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`}
                        stroke={isHighlighted ? '#2D7A52' : 'url(#lineGradient)'}
                        strokeWidth={isHighlighted ? '4' : '3'}
                        fill="none"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{
                          duration: 1,
                          delay: 0.3 + index * 0.1,
                          ease: 'easeOut',
                        }}
                      />
                    );
                  })}
                </svg>
              </div>

              {/* COMPETENCY CARDS (Middle Row) */}
              <motion.div
                className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {currentRole.competencies.map((competency, index) => (
                  <motion.div
                    key={competency.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.5 + index * 0.1,
                      type: 'spring',
                      stiffness: 100,
                    }}
                    onMouseEnter={() => setHoveredCompetency(competency.id)}
                    onMouseLeave={() => setHoveredCompetency(null)}
                  >
                    <div className="relative">
                      {/* Badge */}
                      <div className="absolute -top-2.5 right-6 bg-white text-[#2D5F4A] text-[10px] font-bold px-3 py-1 rounded-full shadow-sm z-10 border-2 border-[#E8F9F0]">
                        COMPETENCY
                      </div>

                      <motion.div
                        className="relative bg-gradient-to-br from-[#B0EFC0] to-[#9DE8B0] rounded-[1.5rem] shadow-xl border-2 border-[#7DD69A]/30 h-full transition-all duration-300 overflow-hidden"
                        whileHover={{
                          y: -8,
                          boxShadow: '0 20px 40px -10px rgba(45, 122, 82, 0.3)',
                        }}
                      >
                        {/* Header */}
                        <div className="p-6 pb-4">
                          <div className="flex items-center gap-3">
                            <motion.div
                              className="w-12 h-12 bg-white/40 backdrop-blur-sm rounded-xl flex items-center justify-center text-[#2D5F4A]"
                              whileHover={{ rotate: 360, scale: 1.1 }}
                              transition={{ duration: 0.5 }}
                            >
                              {competency.icon}
                            </motion.div>
                            <h4 className="text-lg font-bold text-[#2D5F4A]">
                              {competency.title}
                            </h4>
                          </div>
                        </div>

                        {/* Skills Box */}
                        <div className="bg-white/60 backdrop-blur-sm mx-4 mb-4 p-4 rounded-2xl shadow-inner border border-white/40 overflow-hidden">
                          <div className="flex flex-wrap gap-2">
                            {competency.skills.map((skill) => (
                              <motion.span
                                key={skill}
                                className="text-xs bg-white text-[#2D5F4A] px-3 py-1.5 rounded-lg font-medium cursor-default border border-[#E8F9F0] shadow-sm"
                                onMouseEnter={() => setHoveredSkill(skill)}
                                onMouseLeave={() => setHoveredSkill(null)}
                                whileHover={{
                                  scale: 1.05,
                                  backgroundColor: '#E8F9F0',
                                  boxShadow: '0 4px 8px rgba(45, 122, 82, 0.2)',
                                }}
                              >
                                {skill}
                              </motion.span>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Curved Lines - Competencies to Skills */}
              <div className="relative h-32 -my-8">
                <svg
                  className="absolute inset-0 w-full h-full"
                  style={{ overflow: 'visible' }}
                  viewBox="0 0 1000 200"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="skillLineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#9DE8B0" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#C9F4D4" stopOpacity="0.3" />
                    </linearGradient>
                  </defs>

                  {/* Lines from Competencies to Skills */}
                  {currentRole.competencies.map((competency, compIndex) => {
                    const totalComps = currentRole.competencies.length;
                    const compX = (1000 / (totalComps + 1)) * (compIndex + 1);

                    return competency.skills.map((skill) => {
                      const skillIndex = currentRole.allSkills.indexOf(skill);
                      const totalSkills = currentRole.allSkills.length;
                      const skillX = (1000 / (totalSkills + 1)) * (skillIndex + 1);

                      const isHighlighted =
                        hoveredSkill === skill || hoveredCompetency === competency.id;

                      // Curved path
                      const startY = 0;
                      const endY = 200;
                      const cp1Y = startY + 60;
                      const cp2Y = endY - 60;

                      return (
                        <motion.path
                          key={`${compIndex}-${skill}`}
                          d={`M ${compX} ${startY} C ${compX} ${cp1Y}, ${skillX} ${cp2Y}, ${skillX} ${endY}`}
                          stroke={isHighlighted ? '#2D7A52' : 'url(#skillLineGradient)'}
                          strokeWidth={isHighlighted ? '3' : '2'}
                          strokeDasharray={isHighlighted ? '0' : '6 6'}
                          fill="none"
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{
                            pathLength: 1,
                            opacity: isHighlighted ? 0.9 : 0.4,
                          }}
                          transition={{
                            duration: 0.8,
                            delay: 0.8 + compIndex * 0.05,
                            ease: 'easeOut',
                          }}
                        />
                      );
                    });
                  })}
                </svg>
              </div>

              {/* SKILL PILLS (Bottom Row) */}
              <motion.div
                className="flex justify-center gap-2 flex-wrap max-w-5xl mx-auto pt-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                {currentRole.allSkills.map((skill, index) => {
                  const competency = getSkillCompetency(skill);
                  const isHighlighted =
                    hoveredSkill === skill || (competency && hoveredCompetency === competency.id);

                  return (
                    <motion.span
                      key={skill}
                      className={`px-4 py-2 rounded-full text-sm font-medium shadow-md cursor-default transition-all duration-200 border-2 ${
                        isHighlighted
                          ? 'bg-[#E8F9F0] border-[#2D7A52] text-[#2D5F4A] shadow-lg'
                          : 'bg-white border-[#E8F9F0] text-[#2D5F4A] hover:border-[#C9F4D4]'
                      }`}
                      initial={{ opacity: 0, scale: 0.8, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{
                        delay: 1.1 + index * 0.03,
                        type: 'spring',
                        stiffness: 200,
                      }}
                      onMouseEnter={() => setHoveredSkill(skill)}
                      onMouseLeave={() => setHoveredSkill(null)}
                      whileHover={{
                        scale: 1.1,
                        y: -6,
                        boxShadow: '0 12px 24px -6px rgba(45, 122, 82, 0.4)',
                      }}
                    >
                      {skill}
                    </motion.span>
                  );
                })}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
