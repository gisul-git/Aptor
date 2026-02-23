'use client';
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  badge?: string;
  delay?: number;
}

export const SidebarItem = ({ icon: Icon, label, active = false, badge, delay = 0 }: SidebarItemProps) => (
  <div className="group relative px-4 py-3 cursor-pointer opacity-0 animate-sidebar-smooth" style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}>
    {active && <div className="absolute inset-0 bg-gradient-to-r from-[#C9F4D4] to-[#E8FAF0] rounded-2xl mx-2 shadow-sm transition-all duration-300" />}
    {!active && <div className="absolute inset-0 bg-[#E8FAF0] rounded-2xl mx-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />}
    <div className="relative flex items-center gap-3 z-10">
      <div className={`p-2 rounded-xl transition-colors ${active ? 'bg-[#1E5A3B] text-white shadow-lg shadow-[#1E5A3B]/20' : 'text-[#2D7A52] group-hover:text-[#1E5A3B]'}`}><Icon size={18} strokeWidth={active ? 2.5 : 2} /></div>
      <span className={`flex-1 text-[15px] font-medium transition-colors ${active ? 'text-[#1E5A3B] font-bold' : 'text-[#2D7A52] group-hover:text-[#1E5A3B]'}`}>{label}</span>
      {badge && <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm ${active ? 'bg-[#1E5A3B] text-white' : 'bg-[#C9F4D4] text-[#1E5A3B]'}`}>{badge}</span>}
    </div>
  </div>
);