'use client';
import React, { useState, useEffect, useRef } from 'react';

export const ScrollReveal = ({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setIsVisible(true); }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => { if (ref.current) observer.unobserve(ref.current); };
  }, []);
  return <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`transform transition-all duration-1000 cubic-bezier(0.17, 0.55, 0.55, 1) ${isVisible ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 translate-y-12 blur-sm'}`}>{children}</div>;
};