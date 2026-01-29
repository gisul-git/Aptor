'use client';

import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Gift, Zap, Settings, Users, ArrowRight, Sparkles, Check } from 'lucide-react';

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export default function EarlyAccessCTA() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 30,
    hours: 12,
    minutes: 45,
    seconds: 30,
  });

  // Countdown timer
  useEffect(() => {
    const targetDate = new Date('2025-02-28T00:00:00').getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = Math.max(targetDate - now, 0);

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // 3D Tilt Effect for cards
  const Card3D = ({ children, delay = 0 }: { children: ReactNode; delay?: number }) => {
    const cardRef = useRef<HTMLDivElement | null>(null);
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const rotateX = useTransform(mouseY, [-300, 300], [10, -10]);
    const rotateY = useTransform(mouseX, [-300, 300], [-10, 10]);

    const springConfig = { stiffness: 300, damping: 30 };
    const rotateXSpring = useSpring(rotateX, springConfig);
    const rotateYSpring = useSpring(rotateY, springConfig);

    const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      mouseX.set(e.clientX - centerX);
      mouseY.set(e.clientY - centerY);
    };

    const handleMouseLeave = () => {
      mouseX.set(0);
      mouseY.set(0);
    };

    return (
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX: rotateXSpring,
          rotateY: rotateYSpring,
          transformStyle: 'preserve-3d',
        }}
        whileHover={{ scale: 1.05, z: 50 }}
      >
        {children}
      </motion.div>
    );
  };

  // Animated background particles
  const Particle = ({ delay = 0 }: { delay?: number }) => (
    <motion.div
      className="absolute w-1 h-1 bg-white/30 rounded-full"
      initial={{ opacity: 0, y: 0 }}
      animate={{
        opacity: [0, 1, 0],
        y: [-100, 100],
        x: Math.random() * 100 - 50,
      }}
      transition={{
        duration: 3 + Math.random() * 2,
        repeat: Infinity,
        delay,
        ease: 'linear',
      }}
      style={{
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
      }}
    />
  );

  // Flip Number Component
  const FlipNumber = ({ value }: { value: number }) => {
    const [displayValue, setDisplayValue] = useState(value);

    useEffect(() => {
      setDisplayValue(value);
    }, [value]);

    return (
      <motion.div
        initial={{ rotateX: -90, opacity: 0 }}
        animate={{ rotateX: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="inline-block"
      >
        {displayValue.toString().padStart(2, '0')}
      </motion.div>
    );
  };

  const benefits = [
    {
      icon: <Gift className="w-7 h-7" />,
      title: '3 Months Free',
      description: 'Full platform access',
      gradient: 'from-[#FF6B9D] to-[#FFA5C3]',
      delay: 0.2,
    },
    {
      icon: <Zap className="w-7 h-7" />,
      title: 'Priority Onboarding',
      description: 'Skip the queue',
      gradient: 'from-[#FFD93D] to-[#FFE67C]',
      delay: 0.3,
    },
    {
      icon: <Settings className="w-7 h-7" />,
      title: 'Custom Setup',
      description: 'Tailored capabilities',
      gradient: 'from-[#9DE8B0] to-[#7DD69A]',
      delay: 0.4,
    },
    {
      icon: <Users className="w-7 h-7" />,
      title: 'Success Manager',
      description: 'Dedicated support',
      gradient: 'from-[#9B59B6] to-[#BB7FD9]',
      delay: 0.5,
    },
  ];

  return (
    <section className="relative py-20 md:py-32 px-4 md:px-8 bg-gradient-to-br from-[#1E5A3B] via-[#2D7A52] to-[#1E5A3B] overflow-hidden">
      {/* Animated Background Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <Particle key={i} delay={i * 0.2} />
        ))}
      </div>

      {/* Background Gradient Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#9DE8B0]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#C9F4D4]/10 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Launch Badge */}
          <motion.div
            className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-5 py-2.5 rounded-full text-white text-sm font-semibold mb  -6 border border-white/20"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
          >
            <Sparkles className="w-4 h-4 text-yellow-300" />
            Launching February 2025
          </motion.div>

          {/* Main Heading */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
            Be Among the First
          </h2>
          <p className="text-xl md:text-2xl text-[#C9F4D4] max-w-3xl mx-auto">
            Join 500+ companies on the waitlist for exclusive early access
          </p>
        </motion.div>

        {/* Floating Benefit Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {benefits.map((benefit) => (
            <Card3D key={benefit.title} delay={benefit.delay}>
              <div
                className="group relative bg-white/10 backdrop-blur-lg p-6 rounded-2xl border border-white/20 shadow-2xl h-full"
                style={{ transform: 'translateZ(20px)' }}
              >
                {/* Glow effect */}
                <div
                  className={`pointer-events-none absolute -inset-0.5 bg-gradient-to-r ${benefit.gradient} rounded-2xl blur opacity-0 group-hover:opacity-40 transition-opacity`}
                />

                <div className="relative">
                  {/* Icon */}
                  <div
                    className={`w-14 h-14 bg-gradient-to-br ${benefit.gradient} rounded-xl flex items-center justify-center mb-4 text-white shadow-lg`}
                  >
                    {benefit.icon}
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-white mb-2">{benefit.title}</h3>

                  {/* Description */}
                  <p className="text-sm text-[#C9F4D4]">{benefit.description}</p>
                </div>
              </div>
            </Card3D>
          ))}
        </div>

        {/* Glassmorphic Form Card */}
        <motion.div
          className="max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl p-8 md:p-12 shadow-2xl border border-white/50 overflow-hidden">
            {/* Glow around form */}
            <div className="pointer-events-none absolute -inset-1 bg-gradient-to-r from-[#9DE8B0] via-[#C9F4D4] to-[#9DE8B0] rounded-3xl blur-xl opacity-30" />

            <div className="relative">
              {!isSubmitted ? (
                <>
                  <h3 className="text-2xl md:text-3xl font-bold text-[#2D5F4A] mb-6 text-center">
                    Request Early Access
                  </h3>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setIsSubmitted(true);
                    }}
                    className="space-y-4"
                  >
                    {/* Name and Email Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-[#2D5F4A] mb-2">
                          Company Name*
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Acme Corp"
                          className="w-full px-4 py-3 border-2 border-[#E8F9F0] rounded-xl focus:border-[#9DE8B0] focus:outline-none transition-colors bg-white/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#2D5F4A] mb-2">
                          Work Email*
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="you@company.com"
                          className="w-full px-4 py-3 border-2 border-[#E8F9F0] rounded-xl focus:border-[#9DE8B0] focus:outline-none transition-colors bg-white/50"
                        />
                      </div>
                    </div>

                    {/* Role and Size Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-[#2D5F4A] mb-2">
                          Your Role*
                        </label>
                        <select
                          required
                          className="w-full px-4 py-3 border-2 border-[#E8F9F0] rounded-xl focus:border-[#9DE8B0] focus:outline-none transition-colors bg-white/50 text-sm text-[#374151]"
                        >
                          <option value="">Select role</option>
                          <option>HR Manager</option>
                          <option>CTO/Tech Lead</option>
                          <option>L&amp;D Manager</option>
                          <option>CEO/Founder</option>
                          <option>Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#2D5F4A] mb-2">
                          Company Size*
                        </label>
                        <select
                          required
                          className="w-full px-4 py-3 border-2 border-[#E8F9F0] rounded-xl focus:border-[#9DE8B0] focus:outline-none transition-colors bg-white/50 text-sm text-[#374151]"
                        >
                          <option value="">Select size</option>
                          <option>1-50 employees</option>
                          <option>51-200 employees</option>
                          <option>201-1000 employees</option>
                          <option>1000+ employees</option>
                        </select>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <motion.button
                      type="submit"
                      className="w-full bg-gradient-to-r from-[#2D7A52] to-[#1E5A3B] text-white py-4 rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center gap-2 group"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Request Early Access
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </motion.button>
                  </form>

                  {/* Fine Print */}
                  <p className="text-sm text-[#5A8B70] text-center mt-6">
                    No credit card required. We'll contact you with next steps.
                  </p>
                </>
              ) : (
                /* Success State */
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring' }}
                    className="w-20 h-20 bg-gradient-to-br from-[#2D7A52] to-[#1E5A3B] rounded-full flex items-center justify-center mx-auto mb-6"
                  >
                    <Check className="w-10 h-10 text-white" />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-[#2D5F4A] mb-4">
                    You're on the list!
                  </h3>
                  <p className="text-[#5A8B70] mb-6">
                    Check your email for exclusive early access details and next steps.
                  </p>
                  <div className="inline-flex items-center gap-2 bg-[#E8F9F0] px-6 py-3 rounded-full text-[#2D5F4A] font-semibold">
                    <Sparkles className="w-4 h-4" />
                    Welcome to Aaptor Early Access
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Countdown Timer */}
        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
        >
          <p className="text-[#C9F4D4] text-sm md:text-base mb-4 uppercase tracking-wider font-semibold">
            Launching in
          </p>

          <div className="flex justify-center gap-3 md:gap-6">
            {[
              { value: timeLeft.days, label: 'Days' },
              { value: timeLeft.hours, label: 'Hours' },
              { value: timeLeft.minutes, label: 'Mins' },
              { value: timeLeft.seconds, label: 'Secs' },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-white/10 backdrop-blur-md px-4 md:px-6 py-4 md:py-6 rounded-2xl border border-white/20 min-w-[70px] md:min-w-[100px]"
              >
                <div className="text-3xl md:text-5xl font-bold text-white mb-1">
                  <FlipNumber value={item.value} />
                </div>
                <div className="text-xs md:text-sm text-[#C9F4D4] uppercase tracking-wider">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
