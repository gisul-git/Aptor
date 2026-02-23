'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
// Note the import path change: goes up one level to 'features', then up to 'assessments', then down to 'ui'
import { NotificationItem } from '../ui/NotificationItem';

export const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'New candidate started test', desc: 'John Doe started Frontend Developer Assessment', time: '11:48 AM', isRead: false },
    { id: 2, title: 'Proctoring alert', desc: 'Tab switch detected for candidate #123', time: '11:33 AM', isRead: false },
    { id: 3, title: 'Assessment Completed', desc: 'Sarah Smith finished UI/UX Designer Test', time: '10:15 AM', isRead: true },
  ]);
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const markAllRead = () => setNotifications(notifications.map(n => ({ ...n, isRead: true })));

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setIsOpen(!isOpen)} className="p-3 bg-white hover:bg-[#E8FAF0] rounded-full border border-[#C9F4D4] text-[#2D7A52] hover:text-[#1E5A3B] transition-colors relative shadow-sm cursor-pointer">
        <Bell size={20} />
        {unreadCount > 0 && <span className="absolute top-2 right-2.5 w-2.5 h-2.5 bg-[#FF6B6B] rounded-full border border-white"></span>}
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-3 w-80 bg-white/90 backdrop-blur-xl border border-[#C9F4D4] rounded-2xl shadow-2xl overflow-hidden z-40 animate-dropdown-enter origin-top-right">
          <div className="p-4 border-b border-[#E8FAF0] flex justify-between items-center">
            <h3 className="font-bold text-[#1E5A3B]">Notifications</h3>
            {unreadCount > 0 && <button onClick={markAllRead} className="text-[10px] font-bold text-[#2D7A52] hover:text-[#1E5A3B] bg-[#E8FAF0] px-2 py-1 rounded-full transition-colors">Mark all as read</button>}
          </div>
          <div className="max-h-[300px] overflow-y-auto mint-scrollbar">
            {notifications.map(notif => <NotificationItem key={notif.id} {...notif} />)}
          </div>
          <div className="p-3 border-t border-[#E8FAF0] text-center"><button className="text-xs font-bold text-[#2D7A52] hover:text-[#1E5A3B] transition-colors">View All Notifications →</button></div>
        </div>
      )}
    </div>
  );
};