'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useModeStore } from '@/store/mode-store';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Home, Users, Search, FileText, BarChart3, Target, TrendingUp, Calendar, GraduationCap, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import ModeIndicator from './ModeIndicator';

// EMPLOYEE MODE NAVIGATION
const employeeNavItems = [
  { label: 'Dashboard', href: '/dashboard', icon: Home },
  { label: 'Employees', href: '/dashboard/employees', icon: Users, badge: 47 },
  { label: 'Talent Search', href: '/dashboard/talent-search', icon: Search },
  { label: 'Assessments', href: '/dashboard/assessments', icon: FileText, badge: 12 },
  { label: 'Learning Paths', href: '/dashboard/learning-paths', icon: GraduationCap },
  { label: 'Projects', href: '/dashboard/projects', icon: Briefcase },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
];

// HIRING MODE NAVIGATION
const hiringNavItems = [
  { label: 'Dashboard', href: '/dashboard', icon: Home },
  { label: 'Candidates', href: '/dashboard/candidates', icon: Users, badge: 247 },
  { label: 'Positions', href: '/dashboard/positions', icon: Target, badge: 12 },
  { label: 'Assessments', href: '/dashboard/assessments', icon: FileText, badge: 12 },
  { label: 'Pipeline', href: '/dashboard/pipeline', icon: TrendingUp },
  { label: 'Interviews', href: '/dashboard/interviews', icon: Calendar },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
];

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const { mode } = useModeStore();
  const router = useRouter();
  const pathname = router.pathname;
  
  const navItems = mode === 'employees' ? employeeNavItems : hiringNavItems;
  
  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };
  
  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden p-2 text-gray-600 hover:text-gray-900"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>
      
      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Menu Panel */}
            <motion.div
              initial={{ opacity: 0, x: -300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -300 }}
              className="fixed inset-y-0 left-0 w-80 bg-white shadow-2xl z-50 lg:hidden overflow-y-auto"
            >
              <div className="p-6">
                {/* Mode Selector */}
                <div className="mb-6">
                  <ModeIndicator />
                </div>
                
                {/* Nav Items */}
                <nav className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-lg font-semibold transition-all",
                          active
                            ? mode === 'employees'
                              ? "bg-mint-50 text-mint-600"
                              : "bg-blue-50 text-blue-600"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        )}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-bold min-w-[24px] text-center flex-shrink-0",
                            active
                              ? mode === 'employees'
                                ? "bg-mint-500 text-white"
                                : "bg-blue-500 text-white"
                              : "bg-gray-200 text-gray-700"
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

