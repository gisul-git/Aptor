/**
 * Clean, Category-Based Proctoring Logs Review UI
 * 
 * Groups violations by type with dedicated tabs for visual evidence.
 * Designed for admin review of 50-100+ logs without clutter.
 */

import React, { useState, useMemo } from "react";

interface ProctorLog {
  _id?: string;
  eventType: string;
  timestamp: string;
  severity?: string;
  metadata?: Record<string, any>;
  snapshotBase64?: string; // Legacy field
  evidence?: {
    type: string;
    format?: string;
    data?: string;
  };
}

interface ProctorLogsReviewProps {
  logs: ProctorLog[];
  candidateName?: string;
}

/**
 * Extract snapshot from log - works with both legacy snapshotBase64 and new evidence field
 * @param log Proctor log entry
 * @returns Data URI string or null
 */
const extractSnapshot = (log: ProctorLog): string | null => {
  if (!log) return null;

  // New format: evidence field
  if (log.evidence?.type === "image" && log.evidence.data) {
    const format = log.evidence.format || "jpeg";
    // Check if already has data URI prefix
    if (log.evidence.data.startsWith("data:")) {
      return log.evidence.data;
    }
    return `data:image/${format};base64,${log.evidence.data}`;
  }

  // Legacy format: snapshotBase64
  if (log.snapshotBase64) {
    if (log.snapshotBase64.startsWith("data:")) {
      return log.snapshotBase64;
    }
    return `data:image/jpeg;base64,${log.snapshotBase64}`;
  }

  return null;
};

type TabType = 
  | "VISUAL_EVIDENCE"
  | "FULLSCREEN_EXIT"
  | "TAB_SWITCH"
  | "WINDOW_FOCUS_LOST"
  | "GAZE_AWAY"
  | "NO_FACE"
  | "MULTIPLE_FACE"
  | "FACE_MISMATCH"
  | "SYSTEM_EVENTS";

const TAB_CONFIG: Record<TabType, { label: string; icon: string; eventTypes: string[] }> = {
  VISUAL_EVIDENCE: {
    label: "📸 Visual Evidence",
    icon: "📸",
    eventTypes: ["GAZE_AWAY", "NO_FACE_DETECTED", "MULTIPLE_FACES_DETECTED", "FACE_MISMATCH"],
  },
  FULLSCREEN_EXIT: {
    label: "⛔ Fullscreen Violations",
    icon: "⛔",
    eventTypes: ["FULLSCREEN_EXIT"],
  },
  TAB_SWITCH: {
    label: "⚠ Tab Switch",
    icon: "⚠",
    eventTypes: ["TAB_SWITCH"],
  },
  WINDOW_FOCUS_LOST: {
    label: "⚠ Window Focus Lost",
    icon: "⚠",
    eventTypes: ["WINDOW_FOCUS_LOST"],
  },
  GAZE_AWAY: {
    label: "⚠ Gaze Away",
    icon: "⚠",
    eventTypes: ["GAZE_AWAY"],
  },
  NO_FACE: {
    label: "⚠ No Face Detected",
    icon: "⚠",
    eventTypes: ["NO_FACE_DETECTED"],
  },
  MULTIPLE_FACE: {
    label: "❗ Multiple Faces",
    icon: "❗",
    eventTypes: ["MULTIPLE_FACES_DETECTED"],
  },
  FACE_MISMATCH: {
    label: "🔒 Face Mismatch",
    icon: "🔒",
    eventTypes: ["FACE_MISMATCH"],
  },
  SYSTEM_EVENTS: {
    label: "ℹ System Events",
    icon: "ℹ",
    eventTypes: ["PROCTORING_STARTED", "PROCTORING_STOPPED", "CAMERA_PERMISSION_GRANTED"],
  },
};

const getSeverityStyle = (severity?: string) => {
  switch (severity?.toUpperCase()) {
    case "HIGH":
      return { color: "#dc2626", badge: "⛔ HIGH", bg: "#fee2e2" };
    case "MEDIUM":
      return { color: "#ea580c", badge: "⚠ MEDIUM", bg: "#ffedd5" };
    case "LOW":
      return { color: "#64748b", badge: "ℹ LOW", bg: "#f1f5f9" };
    default:
      return { color: "#64748b", badge: "ℹ INFO", bg: "#f8fafc" };
  }
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export const ProctorLogsReview: React.FC<ProctorLogsReviewProps> = ({ logs, candidateName }) => {
  const [activeTab, setActiveTab] = useState<TabType>("VISUAL_EVIDENCE");
  const [selectedImage, setSelectedImage] = useState<ProctorLog | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Calculate statistics
  const stats = useMemo(() => {
    const snapshotLogs = logs.filter((log) => extractSnapshot(log) !== null);
    const categoryCounts: Record<TabType, number> = {
      VISUAL_EVIDENCE: snapshotLogs.length,
      FULLSCREEN_EXIT: 0,
      TAB_SWITCH: 0,
      WINDOW_FOCUS_LOST: 0,
      GAZE_AWAY: 0,
      NO_FACE: 0,
      MULTIPLE_FACE: 0,
      FACE_MISMATCH: 0,
      SYSTEM_EVENTS: 0,
    };

    logs.forEach((log) => {
      Object.entries(TAB_CONFIG).forEach(([tab, config]) => {
        if (config.eventTypes.includes(log.eventType)) {
          categoryCounts[tab as TabType]++;
        }
      });
    });

    return {
      totalViolations: logs.length,
      snapshotCount: snapshotLogs.length,
      categoryCounts,
    };
  }, [logs]);

  // Filter logs by active tab
  const filteredLogs = useMemo(() => {
    const config = TAB_CONFIG[activeTab];
    if (activeTab === "VISUAL_EVIDENCE") {
      return logs.filter((log) => extractSnapshot(log) !== null);
    }
    return logs.filter((log) => config.eventTypes.includes(log.eventType));
  }, [logs, activeTab]);

  const toggleGroup = (eventType: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(eventType)) {
      newExpanded.delete(eventType);
    } else {
      newExpanded.add(eventType);
    }
    setExpandedGroups(newExpanded);
  };

  // Group logs by event type for non-visual tabs
  const groupedLogs = useMemo(() => {
    const groups: Record<string, ProctorLog[]> = {};
    filteredLogs.forEach((log) => {
      if (!groups[log.eventType]) {
        groups[log.eventType] = [];
      }
      groups[log.eventType].push(log);
    });
    return groups;
  }, [filteredLogs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header Summary */}
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "0.75rem",
          padding: "1.25rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>
            Proctoring Review {candidateName && `— ${candidateName}`}
          </h2>
        </div>
        <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.875rem" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#dc2626" }}>
              {stats.totalViolations}
            </div>
            <div style={{ color: "#64748b", fontSize: "0.75rem" }}>violations</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#2563eb" }}>
              {stats.snapshotCount}
            </div>
            <div style={{ color: "#64748b", fontSize: "0.75rem" }}>snapshots</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
          borderBottom: "2px solid #e2e8f0",
          paddingBottom: "0.5rem",
        }}
      >
        {(Object.keys(TAB_CONFIG) as TabType[]).map((tab) => {
          const count = stats.categoryCounts[tab];
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "#2563eb" : "#64748b",
                backgroundColor: isActive ? "#eff6ff" : "transparent",
                border: "1px solid",
                borderColor: isActive ? "#2563eb" : "#e2e8f0",
                borderRadius: "0.5rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                transition: "all 0.2s",
              }}
            >
              <span>{TAB_CONFIG[tab].label}</span>
              {count > 0 && (
                <span
                  style={{
                    backgroundColor: isActive ? "#2563eb" : "#e2e8f0",
                    color: isActive ? "#ffffff" : "#64748b",
                    padding: "0.125rem 0.5rem",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div style={{ minHeight: "400px" }}>
        {filteredLogs.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "3rem",
              color: "#64748b",
              backgroundColor: "#f8fafc",
              borderRadius: "0.75rem",
            }}
          >
            No violations in this category
          </div>
        ) : activeTab === "VISUAL_EVIDENCE" ? (
          // Visual Evidence Tab - Image Grid
          <div>
            <div style={{ marginBottom: "1rem", color: "#64748b", fontSize: "0.875rem" }}>
              Showing snapshots captured at violation trigger
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "1rem",
              }}
            >
              {filteredLogs.map((log, index) => {
                const severityStyle = getSeverityStyle(log.severity);
                const snapshot = extractSnapshot(log);
                if (!snapshot) return null; // Safety check
                
                return (
                  <div
                    key={log._id || index}
                    onClick={() => setSelectedImage(log)}
                    style={{
                      cursor: "pointer",
                      border: "1px solid #e2e8f0",
                      borderRadius: "0.5rem",
                      overflow: "hidden",
                      backgroundColor: "#ffffff",
                      transition: "transform 0.2s, box-shadow 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <img
                      src={snapshot}
                      alt={log.eventType}
                      style={{
                        width: "100%",
                        height: "150px",
                        objectFit: "cover",
                        backgroundColor: "#f1f5f9",
                      }}
                    />
                    <div style={{ padding: "0.75rem" }}>
                      <div
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: severityStyle.color,
                          marginBottom: "0.25rem",
                        }}
                      >
                        {log.eventType.replace(/_/g, " ")}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        {formatTimestamp(log.timestamp)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // Other Tabs - Grouped Lists
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {Object.entries(groupedLogs).map(([eventType, groupLogs]) => {
              const isExpanded = expandedGroups.has(eventType);
              return (
                <div
                  key={eventType}
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.5rem",
                    overflow: "hidden",
                  }}
                >
                  {/* Group Header */}
                  <div
                    onClick={() => toggleGroup(eventType)}
                    style={{
                      padding: "1rem 1.25rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      backgroundColor: "#f8fafc",
                      borderBottom: isExpanded ? "1px solid #e2e8f0" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ fontSize: "1.5rem" }}>{isExpanded ? "▼" : "▶"}</span>
                      <span style={{ fontWeight: 600, fontSize: "1rem" }}>
                        {eventType.replace(/_/g, " ")}
                      </span>
                      <span
                        style={{
                          backgroundColor: "#e2e8f0",
                          color: "#64748b",
                          padding: "0.25rem 0.75rem",
                          borderRadius: "9999px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        {groupLogs.length} {groupLogs.length === 1 ? "time" : "times"}
                      </span>
                    </div>
                  </div>

                  {/* Group Content */}
                  {isExpanded && (
                    <div style={{ padding: "0.75rem" }}>
                      {groupLogs.map((log, index) => {
                        const severityStyle = getSeverityStyle(log.severity);
                        const snapshot = extractSnapshot(log);
                        
                        return (
                          <div
                            key={log._id || index}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "0.75rem",
                              borderBottom:
                                index < groupLogs.length - 1 ? "1px solid #f1f5f9" : "none",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#64748b",
                                  minWidth: "140px",
                                }}
                              >
                                {formatTimestamp(log.timestamp)}
                              </span>
                              {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                                  {Object.entries(log.metadata)
                                    .filter(([key]) => !key.includes("snapshot") && !key.includes("base64") && !key.includes("evidence"))
                                    .map(([key, value]) => (
                                      <span key={key} style={{ marginRight: "0.75rem" }}>
                                        <span style={{ fontWeight: 500 }}>{key}:</span>{" "}
                                        {typeof value === "object"
                                          ? JSON.stringify(value)
                                          : String(value)}
                                      </span>
                                    ))}
                                </div>
                              )}
                            </div>
                            {snapshot && (
                              <button
                                onClick={() => setSelectedImage(log)}
                                style={{
                                  padding: "0.25rem 0.75rem",
                                  fontSize: "0.75rem",
                                  backgroundColor: "#2563eb",
                                  color: "#ffffff",
                                  border: "none",
                                  borderRadius: "0.375rem",
                                  cursor: "pointer",
                                }}
                              >
                                View Snapshot
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "2rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "0.75rem",
              maxWidth: "900px",
              maxHeight: "90vh",
              overflow: "auto",
              position: "relative",
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedImage(null)}
              style={{
                position: "absolute",
                top: "1rem",
                right: "1rem",
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: "1.25rem",
                color: "#64748b",
                zIndex: 10,
              }}
            >
              ×
            </button>

            {/* Image */}
            {extractSnapshot(selectedImage) && (
              <img
                src={extractSnapshot(selectedImage)!}
                alt="Violation evidence"
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  borderTopLeftRadius: "0.75rem",
                  borderTopRightRadius: "0.75rem",
                }}
              />
            )}

            {/* Details */}
            <div style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                <div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                    {selectedImage.eventType.replace(/_/g, " ")}
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#64748b" }}>
                    {formatTimestamp(selectedImage.timestamp)}
                  </div>
                </div>
                {selectedImage.severity && (
                  <span
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: getSeverityStyle(selectedImage.severity).bg,
                      color: getSeverityStyle(selectedImage.severity).color,
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      height: "fit-content",
                    }}
                  >
                    {getSeverityStyle(selectedImage.severity).badge}
                  </span>
                )}
              </div>

              {/* Metadata */}
              {selectedImage.metadata && Object.keys(selectedImage.metadata).length > 0 && (
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    borderRadius: "0.5rem",
                    padding: "1rem",
                    marginTop: "1rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#64748b",
                      marginBottom: "0.5rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Metadata
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    {Object.entries(selectedImage.metadata)
                      .filter(([key]) => !key.includes("snapshot") && !key.includes("base64") && !key.includes("evidence"))
                      .map(([key, value]) => (
                        <div key={key} style={{ fontSize: "0.875rem" }}>
                          <span style={{ color: "#64748b", fontWeight: 500 }}>{key}:</span>{" "}
                          <span style={{ color: "#0f172a" }}>
                            {typeof value === "object" ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProctorLogsReview;
