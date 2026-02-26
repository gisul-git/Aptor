'use client';
import React from 'react';
export const NotificationItem = ({ title, desc, time, isRead }: { title: string, desc: string, time: string, isRead: boolean }) => (
  <div className={`p-4 hover:bg-[#E8FAF0]/50 transition-colors border-b border-[#E8FAF0] last:border-0 ${!isRead ? 'bg-[#E8FAF0]/30' : ''}`}>
    <div className="flex justify-between items-start mb-1">
      <h4 className="text-sm font-bold text-[#1E5A3B]">{title}</h4>
      <span className="text-[10px] text-[#2D7A52]/60 font-medium">{time}</span>
    </div>
    <p className="text-xs text-[#2D7A52]">{desc}</p>
  </div>
);