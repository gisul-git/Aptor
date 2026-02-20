'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Plus, FilePlus, UserPlus, BarChart3 } from 'lucide-react';
import { QuickMenuItem } from '../ui/QuickMenuItem';

export const QuickCreateButton = ({ onOpenWizard }: { onOpenWizard: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setIsOpen(!isOpen)} className={`flex items-center gap-2 bg-[#1E5A3B] hover:bg-[#15422B] cursor-pointer text-white pl-4 pr-5 py-3 rounded-full font-bold shadow-lg shadow-[#1E5A3B]/20 transition-all active:scale-95 z-50 relative ${isOpen ? 'ring-4 ring-[#C9F4D4]' : ''}`}>
        <Plus size={18} className={`transition-transform duration-300 ${isOpen ? 'rotate-45' : 'rotate-0'}`} />
        <span>Quick Create</span>
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-3 w-72 bg-white/90 backdrop-blur-xl border border-[#C9F4D4] rounded-2xl shadow-2xl p-2 z-40 animate-dropdown-enter origin-top-right">
          <div className="px-3 py-2 text-xs font-bold text-[#2D7A52]/60 uppercase tracking-wider">Actions</div>
          <QuickMenuItem icon={FilePlus} label="Create Assessment" onClick={() => { setIsOpen(false); onOpenWizard(); }} />
          <QuickMenuItem icon={UserPlus} label="Add Candidate" />
          <QuickMenuItem icon={BarChart3} label="Generate Report" />
        </div>
      )}
    </div>
  );
};