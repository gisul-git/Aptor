'use client';
import React from 'react';
import { ChevronRight, LucideIcon } from 'lucide-react';
export const QuickMenuItem = ({ icon: Icon, label, onClick }: { icon: LucideIcon, label: string, onClick?: () => void }) => (
  <div onClick={onClick} className="flex items-center justify-between p-3 rounded-xl hover:bg-[#E8FAF0] cursor-pointer group transition-all duration-200">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-[#E8FAF0] group-hover:bg-white border border-transparent group-hover:border-[#C9F4D4] flex items-center justify-center text-[#1E5A3B] transition-all shadow-sm"><Icon size={18} strokeWidth={2} /></div>
      <span className="font-bold text-[#1E5A3B] text-sm group-hover:translate-x-1 transition-transform">{label}</span>
    </div>
    <ChevronRight size={16} className="text-[#2D7A52] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
  </div>
);