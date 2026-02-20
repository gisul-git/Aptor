'use client';

import { useModeStore } from '@/store/mode-store';
import { Users, Target, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function ModeIndicator() {
  const { mode, setMode } = useModeStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);
  
  return (
    <div className="relative" ref={dropdownRef}>
      {/* Mode Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-semibold text-base whitespace-nowrap h-10",
          mode === 'employees'
            ? "bg-mint-100 border-2 border-mint-300 text-text-primary hover:bg-mint-200"
            : "bg-white border border-gray-300 text-text-secondary hover:border-mint-300 hover:text-text-primary"
        )}
      >
        {mode === 'employees' ? (
          <>
            <Users className="w-4 h-4 flex-shrink-0" />
            <span className="hidden md:inline">Employee</span>
          </>
        ) : (
          <>
            <Target className="w-4 h-4 flex-shrink-0" />
            <span className="hidden md:inline">Hiring</span>
          </>
        )}
        <ChevronDown className={cn(
          "w-4 h-4 transition-transform flex-shrink-0",
          isOpen && "rotate-180"
        )} />
      </button>
      
      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border-2 border-gray-200 overflow-hidden z-[100]"
          >
            <div className="p-2">
              {/* Employee Mode Option */}
              <button
                onClick={() => {
                  setMode('employees');
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full p-4 text-left transition-all rounded-lg mb-1",
                  mode === 'employees'
                    ? "bg-mint-50 border-2 border-mint-200"
                    : "hover:bg-gray-50 border-2 border-transparent"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                    mode === 'employees'
                      ? "bg-mint-500 shadow-lg shadow-mint-500/30"
                      : "bg-mint-100"
                  )}>
                    <Users className={cn(
                      "w-5 h-5",
                      mode === 'employees' ? "text-white" : "text-mint-600"
                    )} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900">Employee Mode</h3>
                      {mode === 'employees' && (
                        <span className="px-2 py-0.5 bg-mint-500 text-white text-xs rounded-full font-bold">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      Internal capability building, upskilling, and talent development
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-md font-medium">
                        Employees
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-md font-medium">
                        Learning
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-md font-medium">
                        Projects
                      </span>
                    </div>
                  </div>
                </div>
              </button>
              
              {/* Hiring Mode Option */}
              <button
                onClick={() => {
                  setMode('hiring');
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full p-4 text-left transition-all rounded-lg",
                  mode === 'hiring'
                    ? "bg-blue-50 border-2 border-blue-200"
                    : "hover:bg-gray-50 border-2 border-transparent"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                    mode === 'hiring'
                      ? "bg-blue-500 shadow-lg shadow-blue-500/30"
                      : "bg-blue-100"
                  )}>
                    <Target className={cn(
                      "w-5 h-5",
                      mode === 'hiring' ? "text-white" : "text-blue-600"
                    )} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900">Hiring Mode</h3>
                      {mode === 'hiring' && (
                        <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full font-bold">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      External candidate screening, recruitment, and hiring pipeline
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-md font-medium">
                        Candidates
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-md font-medium">
                        Positions
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-md font-medium">
                        Pipeline
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

