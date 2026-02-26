'use client';
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MiniCalendarProps {
  onSelect: (date: string) => void;
  onClose: () => void;
}

export const MiniCalendar = ({ onSelect, onClose }: MiniCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  const handleDateClick = (day: number) => {
    const selected = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    onSelect(selected.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    onClose();
  };

  const renderDays = () => {
    const days = [];
    const totalDays = daysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    const startDay = firstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

    // Empty slots for previous month
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-8 h-8" />);
    }

    // Days
    for (let i = 1; i <= totalDays; i++) {
      const isToday = 
        i === new Date().getDate() && 
        currentDate.getMonth() === new Date().getMonth() && 
        currentDate.getFullYear() === new Date().getFullYear();

      days.push(
        <button
          key={i}
          onClick={(e) => { e.stopPropagation(); handleDateClick(i); }}
          className={`
            w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold transition-all
            ${isToday ? 'bg-[#1E5A3B] text-white' : 'text-[#1E5A3B] hover:bg-[#E8FAF0]'}
          `}
        >
          {i}
        </button>
      );
    }
    return days;
  };

  return (
    <div 
      className="absolute top-full left-0 mt-2 bg-white border border-[#C9F4D4] rounded-xl shadow-xl p-4 z-50 animate-pop-in w-64"
      onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
    >
      <div className="flex justify-between items-center mb-3">
        <button onClick={(e) => { e.stopPropagation(); handlePrevMonth(); }} className="p-1 hover:bg-[#E8FAF0] rounded-full text-[#1E5A3B]">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-bold text-[#1E5A3B]">
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={(e) => { e.stopPropagation(); handleNextMonth(); }} className="p-1 hover:bg-[#E8FAF0] rounded-full text-[#1E5A3B]">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['S','M','T','W','T','F','S'].map(d => (
          <span key={d} className="text-[10px] font-bold text-[#2D7A52]/60">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 place-items-center">
        {renderDays()}
      </div>
    </div>
  );
};