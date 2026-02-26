'use client';
import React from 'react';
export const AnimatedTitle = ({ text }: { text: string }) => {
  const words = text.split(" ");
  return <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight text-[#1E5A3B] flex flex-wrap justify-center gap-x-4 gap-y-2">{words.map((word, wI) => <span key={wI} className="inline-flex whitespace-nowrap">{word.split("").map((char, cI) => <span key={`${wI}-${cI}`} className="inline-block opacity-0 animate-letter-reveal" style={{ animationDelay: `${800 + (wI * 150) + (cI * 40)}ms`, animationFillMode: 'forwards' }}>{char}</span>)}</span>)}</h1>;
};