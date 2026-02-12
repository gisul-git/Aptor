import React from "react";

// Human-readable labels for event types (distinct labels for each type)
const DEFAULT_EVENT_TYPE_LABELS: Record<string, string> = {
  TAB_SWITCH: "Tab switch detected",
  FOCUS_LOST: "Window focus was lost",
  FULLSCREEN_EXIT: "Fullscreen was exited",
  FULLSCREEN_ENABLED: "Fullscreen was enabled",
  FULLSCREEN_REFUSED: "Fullscreen was declined",
  COPY_RESTRICT: "Copy restriction violated",
  PASTE_ATTEMPT: "Paste attempt blocked",
  RIGHT_CLICK: "Right click blocked",
  DEVTOOLS_OPEN: "Developer tools opened",
  SCREENSHOT_ATTEMPT: "Screenshot attempt detected",
  IDLE: "Idle timeout detected",
  GAZE_AWAY: "Gaze away detected",
  MULTI_FACE: "Multiple faces detected",
  SPOOF_DETECTED: "Spoof attempt detected",
};

// Order of event types for display (most important first)
const EVENT_TYPE_ORDER = [
  "FULLSCREEN_REFUSED",
  "FULLSCREEN_EXIT",
  "TAB_SWITCH",
  "FOCUS_LOST",
  "FULLSCREEN_ENABLED",
  "COPY_RESTRICT",
  "PASTE_ATTEMPT",
  "RIGHT_CLICK",
  "DEVTOOLS_OPEN",
  "SCREENSHOT_ATTEMPT",
  "IDLE",
  "GAZE_AWAY",
  "MULTI_FACE",
  "SPOOF_DETECTED",
];

interface ProctorSummaryCardProps {
  summary: Record<string, number>;
  totalViolations: number;
  eventTypeLabels?: Record<string, string>;
}

export const ProctorSummaryCard: React.FC<ProctorSummaryCardProps> = ({
  summary,
  totalViolations,
  eventTypeLabels = DEFAULT_EVENT_TYPE_LABELS,
}) => {
  // Merge provided labels with defaults
  const mergedLabels = { ...DEFAULT_EVENT_TYPE_LABELS, ...eventTypeLabels };
  // Get event types with counts > 0, maintaining display order
  const eventTypesWithCounts = Object.keys(summary).filter(type => summary[type] > 0);
  
  // Sort by predefined order, with unknown types at the end
  const displayEventTypes = eventTypesWithCounts.sort((a, b) => {
    const aIndex = EVENT_TYPE_ORDER.indexOf(a);
    const bIndex = EVENT_TYPE_ORDER.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  return (
    <div
      style={{
        backgroundColor: "#fef2f2",
        border: "1px solid #fecaca",
        borderRadius: "0.75rem",
        padding: "1.5rem",
        marginBottom: "1.5rem",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "1.25rem",
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#dc2626"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <h3
          style={{
            fontSize: "1.125rem",
            fontWeight: 600,
            color: "#dc2626",
            margin: 0,
          }}
        >
          Proctoring violations summary
        </h3>
        {totalViolations > 0 && (
          <span
            style={{
              backgroundColor: "#dc2626",
              color: "#ffffff",
              padding: "0.25rem 0.75rem",
              borderRadius: "9999px",
              fontSize: "0.875rem",
              fontWeight: 600,
              marginLeft: "auto",
            }}
          >
            {totalViolations} total
          </span>
        )}
      </div>

      {/* Violation Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {displayEventTypes.map((eventType) => {
          const count = summary[eventType] || 0;
          const label = mergedLabels[eventType] || eventType.replace(/_/g, " ");
          const hasViolations = count > 0;

          return (
            <div
              key={eventType}
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "0.5rem",
                padding: "1rem 1.25rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
              }}
            >
              <span
                style={{
                  fontSize: "0.9375rem",
                  color: "#374151",
                  fontWeight: 500,
                }}
              >
                {label}
              </span>
              <span
                style={{
                  backgroundColor: hasViolations ? "#fecaca" : "#d1fae5",
                  color: hasViolations ? "#dc2626" : "#059669",
                  padding: "0.25rem 0.75rem",
                  borderRadius: "9999px",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  minWidth: "60px",
                  textAlign: "center",
                }}
              >
                {count} {count === 1 ? "time" : "times"}
              </span>
            </div>
          );
        })}
      </div>

      {/* No violations message */}
      {totalViolations === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "2rem",
            color: "#059669",
            backgroundColor: "#d1fae5",
            borderRadius: "0.5rem",
            marginTop: "1rem",
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ margin: "0 auto 0.5rem" }}
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p style={{ margin: 0, fontWeight: 600 }}>
            No proctoring violations detected
          </p>
        </div>
      )}
    </div>
  );
};

export default ProctorSummaryCard;

