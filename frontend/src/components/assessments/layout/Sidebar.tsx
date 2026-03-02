'use client';
import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { LayoutDashboard, Users, Search, FileText, GraduationCap, Briefcase, BarChart3, Sparkles, X, ChevronDown } from 'lucide-react';
import { SidebarItem } from '../ui/SidebarItem';

export const Sidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { data: session } = useSession();
  // State to track if the profile image failed to load
  const [imageError, setImageError] = useState(false);

  // Helper to generate initials (e.g., "Tushar Mishra" -> "TM")
  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .filter(Boolean) 
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const userInitials = session?.user?.name ? getInitials(session.user.name) : 'TM';

  return (
    <aside className={`fixed lg:static inset-y-4 left-4 z-50 w-[280px] shrink-0 bg-white/80 backdrop-blur-xl rounded-[2.5rem] border border-white/40 shadow-2xl shadow-[#1E5A3B]/5 flex flex-col py-6 transition-transform duration-500 ease-cubic ${isOpen ? 'translate-x-0' : '-translate-x-[120%] lg:translate-x-0'}`}>
      <div className="px-8 mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3 animate-logo-pop">
            <div className="w-10 h-10 bg-gradient-to-br from-[#C9F4D4] to-[#9DEBB0] rounded-xl flex items-center justify-center text-[#1E5A3B] shadow-sm"><Sparkles size={20} fill="currentColor" className="text-white/40" /></div>
            <span className="text-xl font-extrabold tracking-tight text-[#1E5A3B]">AssessAI</span>
        </div>
        <button onClick={onClose} className="lg:hidden text-[#2D7A52] p-2 hover:bg-[#E8FAF0] rounded-full"><X size={20} /></button>
      </div>
      
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto mint-scrollbar pr-2 mr-1">
        <div className="px-4 pb-2 text-xs font-bold text-[#2D7A52]/60 uppercase tracking-wider opacity-0 animate-sidebar-smooth" style={{ animationDelay: '100ms' }}>Main Menu</div>
        <SidebarItem icon={LayoutDashboard} label="Dashboard" delay={150} />
        <SidebarItem icon={Users} label="Employees" badge="47" delay={200} />
        <SidebarItem icon={Search} label="Talent Search" delay={250} />
        <div className="my-4 mx-4 h-px bg-gradient-to-r from-transparent via-[#C9F4D4] to-transparent opacity-0 animate-sidebar-smooth" style={{ animationDelay: '300ms' }} />
        <div className="px-4 pb-2 text-xs font-bold text-[#2D7A52]/60 uppercase tracking-wider opacity-0 animate-sidebar-smooth" style={{ animationDelay: '350ms' }}>Tools</div>
        <SidebarItem icon={FileText} label="Assessments" active={true} badge="12" delay={400} />
        <SidebarItem icon={GraduationCap} label="Learning Paths" delay={450} />
        <SidebarItem icon={Briefcase} label="Projects" delay={500} />
        <SidebarItem icon={BarChart3} label="Analytics" delay={550} />
      </nav>

      <div className="px-4 mt-4 opacity-0 animate-sidebar-smooth" style={{ animationDelay: '600ms' }}>
        <div className="bg-[#E8FAF0] p-4 rounded-3xl flex items-center gap-3 cursor-pointer hover:bg-[#C9F4D4] transition-colors group">
          {/* Dynamic Avatar Container */}
          <div className="w-10 h-10 rounded-full bg-white border-2 border-white shadow-sm flex items-center justify-center text-[#1E5A3B] font-bold group-hover:scale-105 transition-transform overflow-hidden relative">
            
            {/* Logic: Show Image if exists AND didn't error. Otherwise show Initials. */}
            {session?.user && 'image' in session.user && session.user.image && !imageError ? (
              <img 
                src={(session.user as any).image} 
                alt={session.user.name || 'User'} 
                className="w-full h-full object-cover" 
                onError={() => setImageError(true)} 
              />
            ) : (
              <span className="text-sm tracking-tight">{userInitials}</span>
            )}
          </div>
          
          {/* Dynamic User Details */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#1E5A3B] truncate">
              {session?.user?.name || 'Admin'}
            </p>
            <p className="text-xs text-[#2D7A52] truncate">
              {session?.user?.email || 'Admin Workspace'}
            </p>
          </div>
          <ChevronDown size={16} className="text-[#2D7A52]" />
        </div>
      </div>
    </aside>
  );
};