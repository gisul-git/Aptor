'use client';
import React from 'react';
import { ArrowRight, LucideIcon } from 'lucide-react';

export const ActionCard = ({ icon: Icon, title, description, onClick }: { icon: LucideIcon, title: string, description: string, onClick?: () => void }) => (
  <div onClick={onClick} className="group relative overflow-hidden bg-white/40 backdrop-blur-xl border border-white/60 bg-gradient-to-br from-white/40 via-white/40 to-white/40 p-8 rounded-[2.5rem] transition-all duration-500 ease-out hover:from-white/90 hover:via-[#E8FAF0]/90 hover:to-[#C9F4D4]/60 hover:border-[#C9F4D4] hover:shadow-[0_20px_80px_-20px_rgba(30,90,59,0.15)] hover:-translate-y-2 cursor-pointer flex flex-col h-full shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]">
    <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <div className="absolute -top-32 -right-32 w-80 h-80 bg-gradient-to-br from-[#C9F4D4] to-[#E8FAF0] rounded-full blur-3xl opacity-0 group-hover:opacity-40 transition-opacity duration-700 pointer-events-none" />
    <div className="flex justify-between items-start mb-8 relative z-10">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-[#E8FAF0] text-[#1E5A3B] transition-all duration-500 ease-out group-hover:bg-[#1E5A3B] group-hover:text-[#E8FAF0] group-hover:scale-110 group-hover:rotate-3 shadow-inner group-hover:shadow-lg"><Icon size={30} strokeWidth={1.5} /></div>
      <div className="w-10 h-10 rounded-full border border-[#C9F4D4]/50 flex items-center justify-center text-[#1E5A3B] opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 group-hover:bg-[#E8FAF0] transition-all duration-500 delay-75"><ArrowRight size={18} /></div>
    </div>
    <div className="relative z-10 flex flex-col flex-1"><h3 className="text-2xl font-bold text-[#1E5A3B] mb-3 tracking-tight group-hover:text-[#15422B] transition-colors">{title}</h3><p className="text-[#2D7A52] text-[15px] leading-relaxed opacity-90 group-hover:opacity-100 transition-opacity">{description}</p></div>
  </div>
);