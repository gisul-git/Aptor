'use client';
import React from 'react';
import { Menu, Search, Command } from 'lucide-react';
import { NotificationBell } from '../features/NotificationBell';
import { QuickCreateButton } from '../features/QuickCreateButton';

export const Navbar = ({ onMenuClick, onOpenWizard }: { onMenuClick: () => void, onOpenWizard: () => void }) => (
  <header className="absolute top-0 left-0 right-0 h-24 z-30 px-8 flex items-center justify-between bg-gradient-to-b from-white/80 to-transparent pointer-events-none">
    <div className="flex items-center gap-4 pointer-events-auto">
      <button onClick={onMenuClick} className="lg:hidden p-3 bg-white rounded-xl shadow-sm text-[#1E5A3B]"><Menu size={20} /></button>
      <h2 className="hidden md:block text-2xl font-bold text-[#1E5A3B]">Overview</h2>
    </div>
    <div className="flex items-center gap-4 pointer-events-auto">
      {/* <div className="hidden md:flex items-center bg-white/80 backdrop-blur-md border border-[#C9F4D4] rounded-full px-4 py-2.5 shadow-sm hover:shadow-md transition-all group w-30 focus-within:w-30">
        <Search size={18} className="text-[#2D7A52] group-focus-within:text-[#1E5A3B]" />
        <input type="text" placeholder="Search..." className="bg-transparent border-none outline-none ml-2 w-full text-sm text-[#1E5A3B] placeholder-[#2D7A52]/50" />
        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[#E8FAF0] rounded text-[10px] font-bold text-[#2D7A52] border border-[#C9F4D4]"><Command size={10} /><span>K</span></div>
      </div> */}
      <div className="flex items-center gap-3">
        <NotificationBell />
        <QuickCreateButton onOpenWizard={onOpenWizard} />
      </div>
    </div>
  </header>
);