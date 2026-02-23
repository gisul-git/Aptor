'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  FileText,
  Bot,
  GraduationCap,
  BarChart3,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Shield,
  Lock,
  Zap,
  TrendingUp,
  Repeat,
} from 'lucide-react';

export default function AaptorJourney() {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      id: 1,
      icon: <FileText className="w-8 h-8" />,
      smallIcon: <FileText className="w-5 h-5" />,
      step: 'STEP 1',
      title: 'Assessment',
      description:
        'Employee takes AI-generated competency assessment with advanced proctoring and security features.',
      detailedDescription:
        'Our AI-powered assessment engine creates role-based tests that accurately evaluate competencies across multiple formats including MCQ, subjective questions, and pseudocode challenges.',
      tags: ['Proctored', 'Secure'],
      features: [
        { icon: <Shield className="w-4 h-4" />, text: 'AI-generated questions based on role' },
        { icon: <Lock className="w-4 h-4" />, text: 'Advanced proctoring with face detection' },
        { icon: <Zap className="w-4 h-4" />, text: 'Multi-format assessment types' },
      ],
      color: '#FF6B9D',
      gradient: 'from-[#FF6B9D] to-[#FFA5C3]',
    },
    {
      id: 2,
      icon: <Bot className="w-8 h-8" />,
      smallIcon: <Bot className="w-5 h-5" />,
      step: 'STEP 2',
      title: 'AI Evaluation',
      description:
        'AI analyzes performance across all dimensions and generates a comprehensive capability score with detailed insights.',
      detailedDescription:
        'Advanced machine learning algorithms evaluate responses in real-time, identifying strengths, weaknesses, and providing actionable insights for improvement.',
      tags: ['Instant', 'Accurate'],
      features: [
        { icon: <Zap className="w-4 h-4" />, text: 'Instant automated grading' },
        { icon: <BarChart3 className="w-4 h-4" />, text: 'Detailed performance analytics' },
        { icon: <TrendingUp className="w-4 h-4" />, text: 'Capability score generation' },
      ],
      color: '#9B59B6',
      gradient: 'from-[#9B59B6] to-[#BB7FD9]',
    },
    {
      id: 3,
      icon: <GraduationCap className="w-8 h-8" />,
      smallIcon: <GraduationCap className="w-5 h-5" />,
      step: 'STEP 3',
      title: 'Learning Path',
      description:
        'Personalized learning paths are generated based on identified weakness areas and skill gaps.',
      detailedDescription:
        'AI curates targeted courses from platforms like Udemy, Coursera, and custom content to address specific skill gaps and accelerate capability development.',
      tags: ['Udemy', 'Custom'],
      features: [
        { icon: <GraduationCap className="w-4 h-4" />, text: 'Personalized course recommendations' },
        { icon: <TrendingUp className="w-4 h-4" />, text: 'Skill gap analysis' },
        { icon: <Zap className="w-4 h-4" />, text: 'Custom learning content' },
      ],
      color: '#2D7A52',
      gradient: 'from-[#2D7A52] to-[#3BA76A]',
    },
    {
      id: 4,
      icon: <BarChart3 className="w-8 h-8" />,
      smallIcon: <BarChart3 className="w-5 h-5" />,
      step: 'STEP 4',
      title: 'Activity Tracking',
      description:
        'Comprehensive tracking of learning activities across GitHub, LinkedIn, courses, and development platforms.',
      detailedDescription:
        'Monitor real-world skill application through GitHub commits, course completions, LinkedIn certifications, and project contributions.',
      tags: ['GitHub', 'LinkedIn'],
      features: [
        { icon: <BarChart3 className="w-4 h-4" />, text: 'GitHub commit tracking' },
        { icon: <TrendingUp className="w-4 h-4" />, text: 'Course completion monitoring' },
        { icon: <Shield className="w-4 h-4" />, text: 'LinkedIn activity integration' },
      ],
      color: '#3498DB',
      gradient: 'from-[#3498DB] to-[#5DADE2]',
    },
    {
      id: 5,
      icon: <RefreshCw className="w-8 h-8" />,
      smallIcon: <RefreshCw className="w-5 h-5" />,
      step: 'STEP 5',
      title: 'Re-Assessment',
      description:
        'Retake assessments to measure growth and update capability scores, completing the continuous improvement cycle.',
      detailedDescription:
        'Track progress over time with periodic reassessments that showcase skill development and capability growth trajectory.',
      tags: ['Growth', 'Continuous'],
      features: [
        { icon: <RefreshCw className="w-4 h-4" />, text: 'Periodic reassessment unlocking' },
        { icon: <TrendingUp className="w-4 h-4" />, text: 'Growth tracking over time' },
        { icon: <BarChart3 className="w-4 h-4" />, text: 'Updated capability scores' },
      ],
      color: '#E74C3C',
      gradient: 'from-[#E74C3C] to-[#EC7063]',
    },
  ];

  const totalSteps = steps.length;

  // Always auto-rotate through steps
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % totalSteps);
    }, 5000);

    return () => clearInterval(interval);
  }, [totalSteps]);

  const getCirclePosition = (index: number, total: number, activeIndex: number) => {
    const angle = ((index - activeIndex) * (360 / total) - 90) * (Math.PI / 180);
    const radius = 190;

    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      scale: index === activeIndex ? 1.2 : 0.8,
      opacity: index === activeIndex ? 1 : 0.5,
      zIndex: index === activeIndex ? 10 : 1,
    };
  };

  const currentStep = steps[activeStep];

  return (
    <section className="relative py-20 md:py-32 px-4 md:px-8 bg-gradient-to-b from-white via-[#F8FDF9] to-[#E8F9F0] overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-[420px] h-[420px] bg-[#C9F4D4]/25 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[420px] h-[420px] bg-[#9DE8B0]/20 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#2D5F4A] mb-4">
            How AAPTOR Transforms Your Workforce
          </h2>
          <p className="text-base md:text-lg text-[#5A8B70] max-w-3xl mx-auto">
            From assessment to continuous growth - a complete capability building lifecycle
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[600px]">
          {/* Left: Circular animation */}
          <div className="relative h-[520px] flex items-center justify-center">
            <motion.div
              className="absolute w-24 h-24 bg-gradient-to-br from-[#9DE8B0] to-[#2D7A52] rounded-full shadow-[0_30px_80px_rgba(45,122,82,0.55)] flex items-center justify-center z-20"
              animate={{ rotate: 360 }}
              transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            >
              <RefreshCw className="w-10 h-10 text-white" />
            </motion.div>

            {steps.map((step, index) => {
              const position = getCirclePosition(index, totalSteps, activeStep);

              return (
                <motion.div
                  key={step.id}
                  className="absolute cursor-pointer"
                  animate={{
                    x: position.x,
                    y: position.y,
                    scale: position.scale,
                    opacity: position.opacity,
                    zIndex: position.zIndex,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 100,
                    damping: 20,
                    duration: 0.8,
                  }}
                  onClick={() => {
                    setActiveStep(index);
                  }}
                  whileHover={{ scale: position.scale * 1.1 }}
                >
                  <div
                    className={`w-20 h-20 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 backdrop-blur-sm ${
                      index === activeStep
                        ? `bg-gradient-to-br ${step.gradient} ring-4 ring-white`
                        : 'bg-white/90 border border-[#E5F7EE]'
                    }`}
                    style={{ color: index === activeStep ? 'white' : step.color }}
                  >
                    {index === activeStep ? step.icon : step.smallIcon}
                  </div>

                  <div
                    className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${
                      index === activeStep
                        ? 'bg-white text-[#2D5F4A]'
                        : 'bg-white/80 text-gray-500 border border-gray-200/60'
                    }`}
                  >
                    {index + 1}
                  </div>
                </motion.div>
              );
            })}

            <div className="absolute w-[380px] h-[380px] border border-dashed border-[#C9F4D4]/70 rounded-full opacity-60 shadow-[0_40px_120px_rgba(0,0,0,0.08)]" />
          </div>

          {/* Right: step details */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full text-[#2D5F4A] text-sm font-semibold shadow-sm border border-[#E8F9F0]">
                <span style={{ color: currentStep.color }}>●</span>
                {currentStep.step}
              </div>

              <h3 className="text-3xl md:text-4xl font-bold text-[#2D5F4A]">{currentStep.title}</h3>

              <p className="text-lg text-[#5A8B70] leading-relaxed">
                {currentStep.detailedDescription}
              </p>

              <div className="space-y-3">
                {currentStep.features.map((feature) => (
                  <motion.div
                    key={feature.text}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{}}
                    className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-[#E8F9F0]"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: `${currentStep.color}20`,
                        color: currentStep.color,
                      }}
                    >
                      {feature.icon}
                    </div>
                    <span className="text-sm text-[#2D5F4A] font-medium">{feature.text}</span>
                  </motion.div>
                ))}
              </div>

              <div className="flex gap-2 flex-wrap">
                {currentStep.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-sm px-4 py-2 rounded-full font-medium bg-[#E8F9F0] text-[#2D5F4A]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6 mt-12">
          <button
            onClick={() => {
              setActiveStep((prev) => (prev - 1 + totalSteps) % totalSteps);
            }}
            className="w-12 h-12 bg-white rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center text-[#2D5F4A] hover:bg-[#F0FDF4]"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex gap-2">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setActiveStep(index);
                }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === activeStep ? 'w-8 bg-[#2D7A52]' : 'w-2 bg-[#C9F4D4] hover:bg-[#9DE8B0]'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => {
              setActiveStep((prev) => (prev + 1) % totalSteps);
            }}
            className="w-12 h-12 bg-white rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center text-[#2D5F4A] hover:bg-[#F0FDF4]"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Bottom message */}
        <motion.div
          className="flex items-center justify-center gap-3 text-center mt-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
        >
          <Repeat className="w-5 h-5 text-[#2D7A52]" />
          <p className="text-base md:text-lg text-[#5A8B70] font-medium">
            The cycle repeats, continuously building employee capabilities
          </p>
        </motion.div>
      </div>
    </section>
  );
}

