import React, { ReactNode } from 'react';

interface MetricCardProps {
  icon: ReactNode;
  iconColor: string;
  iconBg: string;
  value: string | number;
  label: string;
  badgeText: string;
  badgeColor: string;
  badgeBg: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  iconColor,
  iconBg,
  value,
  label,
  badgeText,
  badgeColor,
  badgeBg,
}) => {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #E2E8F0",
        borderRadius: "1rem",
        padding: "1.5rem",
        position: "relative",
        transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
        cursor: "default",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-5px)";
        e.currentTarget.style.boxShadow = "0 15px 30px -5px rgba(0, 0, 0, 0.08)";
        e.currentTarget.style.borderColor = "#C9F4D4";
        
        const iconBox = e.currentTarget.querySelector('.icon-box') as HTMLElement | null;
        if (iconBox) iconBox.style.transform = "scale(1.1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.02)";
        e.currentTarget.style.borderColor = "#E2E8F0";
        
        const iconBox = e.currentTarget.querySelector('.icon-box') as HTMLElement | null;
        if (iconBox) iconBox.style.transform = "scale(1)";
      }}
    >
      {/* Icon */}
      <div
        className="icon-box"
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "0.75rem",
          backgroundColor: iconBg,
          color: iconColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "1rem",
          transition: "transform 0.3s ease",
        }}
      >
        {icon}
      </div>

      {/* Value */}
      <div
        style={{
          fontSize: "2.5rem",
          fontWeight: 800,
          color: "#0F172A",
          lineHeight: 1,
          marginBottom: "0.5rem",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>

      {/* Label */}
      <div
        style={{
          fontSize: "0.875rem",
          color: "#64748b",
          fontWeight: 500,
          marginBottom: "1.25rem",
        }}
      >
        {label}
      </div>

      {/* Badge */}
      <div
        style={{
          display: "inline-block",
          padding: "0.25rem 0.75rem",
          backgroundColor: badgeBg,
          color: badgeColor,
          borderRadius: "99px",
          fontSize: "0.75rem",
          fontWeight: 700,
          letterSpacing: "0.02em",
        }}
      >
        {badgeText}
      </div>
    </div>
  );
};

export default MetricCard;