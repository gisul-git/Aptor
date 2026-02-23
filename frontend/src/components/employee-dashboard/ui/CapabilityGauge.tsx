import React, { useEffect, useState } from 'react';

interface CapabilityGaugeProps {
  score: number;
  maxScore?: number;
  increase?: number; // e.g. 12
}

const CapabilityGauge: React.FC<CapabilityGaugeProps> = ({ score, maxScore = 100, increase }) => {
  // --- Gauge Config ---
  // We keep internal radius same (70) and rely on SVG width/height to scale it up visually
  const radius = 70;
  const circumference = 2 * Math.PI * radius; 
  const visibleArcLength = circumference * 0.666; // 240-degree arc
  
  // State for Arc Animation
  const [offset, setOffset] = useState(visibleArcLength);
  
  // State for Number Count-up Animation
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    // 1. Calculate Target Offset for Gauge
    const targetOffset = visibleArcLength * (1 - score / maxScore);
    
    // 2. Start Animations after small delay (300ms) to ensure smooth entrance
    const startDelay = setTimeout(() => {
      
      // A. Trigger Gauge Arc Animation
      setOffset(targetOffset);

      // B. Trigger Number Count-Up Animation
      let startTimestamp: number | null = null;
      const duration = 1500; // 1.5 seconds (matches the CSS transition of the gauge)

      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // Easing function: Ease-Out Quart (starts fast, slows down at end)
        const easeProgress = 1 - Math.pow(1 - progress, 4);

        // Calculate current number
        const currentCount = Math.floor(easeProgress * score);
        setDisplayScore(currentCount);

        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      };

      window.requestAnimationFrame(step);

    }, 300);

    return () => clearTimeout(startDelay);
  }, [score, maxScore, visibleArcLength]);

  return (
    // CHANGED: Increased container size from 200px/180px to 260px/235px
    <div style={{ position: "relative", width: "260px", height: "235px", flexShrink: 0 }}>
      
      {/* --- Radial Green Glow Effect --- */}
      <div 
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          // CHANGED: Increased glow size from 160px to 220px
          width: "220px",
          height: "220px",
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(255, 255, 255, 0) 70%)",
          filter: "blur(25px)",
          borderRadius: "50%",
          zIndex: 0, 
          pointerEvents: "none"
        }}
      />

      {/* Floating Badge (Animated Pop-in) */}
      {increase && (
        <div
          style={{
            position: "absolute",
            top: "-10px",
            right: "0px",
            backgroundColor: "#D1FAE5",
            color: "#065F46",
            padding: "0.25rem 0.75rem",
            borderRadius: "99px",
            fontSize: "0.85rem", // Slightly larger font
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "2px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            zIndex: 10,
            animation: "fadeIn 0.5s ease-out 0.8s backwards"
          }}
        >
          ↗ +{increase}
        </div>
      )}

      {/* The Gauge SVG */}
      {/* CHANGED: Increased SVG dimensions from 200 to 260 */}
      <svg width="260" height="260" viewBox="0 0 160 160" style={{ overflow: "visible", position: "relative", zIndex: 1 }}>
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#065F46" /> {/* Dark Forest */}
            <stop offset="100%" stopColor="#10B981" /> {/* Bright Emerald */}
          </linearGradient>
        </defs>

        {/* Rotate 150deg to position the gap at the bottom */}
        <g transform="rotate(150, 80, 80)">
          {/* Background Track */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="#F1F5F9"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${visibleArcLength} ${circumference}`}
          />
          {/* Animated Progress Bar */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${visibleArcLength} ${circumference}`}
            strokeDashoffset={offset}
            style={{ 
              transition: "stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1)", 
              filter: "drop-shadow(0 0 4px rgba(16, 185, 129, 0.3))"
            }}
          />
        </g>
      </svg>

      {/* Center Text */}
      <div
        style={{
          position: "absolute",
          top: "55%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          width: "100%",
          zIndex: 2
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", lineHeight: 1 }}>
            {/* Animated Score Number - CHANGED: 3.5rem -> 4.5rem */}
            <span style={{ fontSize: "4.5rem", fontWeight: 800, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
              {displayScore}
            </span>
            {/* CHANGED: 1.25rem -> 1.5rem */}
            <span style={{ fontSize: "1.5rem", fontWeight: 600, color: "#94A3B8", marginLeft: "2px" }}>
              /{maxScore}
            </span>
        </div>
        <div style={{ 
          fontSize: "0.875rem", // CHANGED: Slightly larger label
          color: "#64748B", 
          fontWeight: 700, 
          textTransform: "uppercase", 
          letterSpacing: "0.05em", 
          marginTop: "0.25rem" 
        }}>
          Capability Score
        </div>
      </div>
    </div>
  );
};

export default CapabilityGauge;