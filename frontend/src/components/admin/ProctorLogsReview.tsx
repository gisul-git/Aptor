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
  } | Array<{
    type: string;
    format?: string;
    data?: string;
  }>; // Can be single object or array for dual snapshots
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

  // New format: evidence field (can be object or array)
  if (log.evidence) {
    // Check if evidence is an array (dual snapshots)
    if (Array.isArray(log.evidence) && log.evidence.length > 0) {
      // Return first snapshot (webcam) for backward compatibility
      const firstEvidence = log.evidence[0];
      if (firstEvidence.data) {
        const format = firstEvidence.format || "jpeg";
        if (firstEvidence.data.startsWith("data:")) {
          return firstEvidence.data;
        }
        return `data:image/${format};base64,${firstEvidence.data}`;
      }
    }
    // Single evidence object (supports type: 'image', 'webcam', 'screen')
    else if (!Array.isArray(log.evidence) && log.evidence.data) {
      const format = log.evidence.format || "jpeg";
      if (log.evidence.data.startsWith("data:")) {
        return log.evidence.data;
      }
      return `data:image/${format};base64,${log.evidence.data}`;
    }
  }

  // Check metadata.evidence (for ADMIN_FLAGGED with dual snapshots stored in metadata)
  if (log.metadata?.evidence && Array.isArray(log.metadata.evidence) && log.metadata.evidence.length > 0) {
    const firstEvidence = log.metadata.evidence[0];
    if (firstEvidence.data) {
      const format = firstEvidence.format || "jpeg";
      if (firstEvidence.data.startsWith("data:")) {
        return firstEvidence.data;
      }
      return `data:image/${format};base64,${firstEvidence.data}`;
    }
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

/**
 * Extract all evidence snapshots from log (for dual display)
 * @param log Proctor log entry
 * @returns Array of evidence items with data URIs
 */
const extractAllEvidence = (log: ProctorLog): Array<{ type: string; data: string }> => {
  if (!log) return [];

  const evidenceList: Array<{ type: string; data: string }> = [];

  // Check metadata.evidence (for ADMIN_FLAGGED with dual snapshots)
  if (log.metadata?.evidence && Array.isArray(log.metadata.evidence)) {
    log.metadata.evidence.forEach((item: any) => {
      if (item.data) {
        const format = item.format || "jpeg";
        let dataUri: string;
        if (item.data.startsWith("data:")) {
          dataUri = item.data;
        } else {
          dataUri = `data:image/${format};base64,${item.data}`;
        }
        evidenceList.push({ type: item.type || 'unknown', data: dataUri });
      }
    });
  }
  // Check top-level evidence field (array format)
  else if (log.evidence && Array.isArray(log.evidence)) {
    log.evidence.forEach((item) => {
      if (item.data) {
        const format = item.format || "jpeg";
        let dataUri: string;
        if (item.data.startsWith("data:")) {
          dataUri = item.data;
        } else {
          dataUri = `data:image/${format};base64,${item.data}`;
        }
        evidenceList.push({ type: item.type || 'unknown', data: dataUri });
      }
    });
  }
  // Single evidence object
  else if (log.evidence && !Array.isArray(log.evidence) && log.evidence.data) {
    const format = log.evidence.format || "jpeg";
    let dataUri: string;
    if (log.evidence.data.startsWith("data:")) {
      dataUri = log.evidence.data;
    } else {
      dataUri = `data:image/${format};base64,${log.evidence.data}`;
    }
    evidenceList.push({ type: log.evidence.type || 'image', data: dataUri });
  }
  // Fallback to legacy snapshotBase64
  else if (log.snapshotBase64) {
    let dataUri: string;
    if (log.snapshotBase64.startsWith("data:")) {
      dataUri = log.snapshotBase64;
    } else {
      dataUri = `data:image/jpeg;base64,${log.snapshotBase64}`;
    }
    evidenceList.push({ type: 'webcam', data: dataUri }); // Assume webcam for legacy
  }

  return evidenceList;
};

type TabType = 
  | "VISUAL_EVIDENCE"
  | "ADMIN_FLAGGED"
  | "FULLSCREEN_EXIT"
  | "TAB_SWITCH"
  | "WINDOW_FOCUS_LOST"
  | "GAZE_AWAY"
  | "NO_FACE"
  | "MULTIPLE_FACE"
  | "FACE_MISMATCH";

const TAB_CONFIG: Record<TabType, { label: string; icon: string; eventTypes: string[] }> = {
  VISUAL_EVIDENCE: {
    label: "📸 Visual Evidence",
    icon: "📸",
    eventTypes: ["GAZE_AWAY", "NO_FACE_DETECTED", "MULTIPLE_FACES_DETECTED", "FACE_MISMATCH"],
  },
  ADMIN_FLAGGED: {
    label: "🚩 Admin Flagged",
    icon: "🚩",
    eventTypes: ["ADMIN_FLAGGED"],
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
      VISUAL_EVIDENCE: 0,
      ADMIN_FLAGGED: 0,
      FULLSCREEN_EXIT: 0,
      TAB_SWITCH: 0,
      WINDOW_FOCUS_LOST: 0,
      GAZE_AWAY: 0,
      NO_FACE: 0,
      MULTIPLE_FACE: 0,
      FACE_MISMATCH: 0,
    };

    logs.forEach((log) => {
      Object.entries(TAB_CONFIG).forEach(([tab, config]) => {
        if (config.eventTypes.includes(log.eventType)) {
          // Special handling for tabs that require snapshots
          if (tab === "VISUAL_EVIDENCE") {
            if (extractSnapshot(log) !== null) {
              categoryCounts[tab as TabType]++;
            }
          } else if (tab === "ADMIN_FLAGGED") {
            // ADMIN_FLAGGED needs to have evidence (webcam or screen)
            if (extractAllEvidence(log).length > 0 || extractSnapshot(log) !== null) {
              categoryCounts[tab as TabType]++;
            }
          } else {
            // Other tabs: count all matching event types
            categoryCounts[tab as TabType]++;
          }
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
        ) : (
          // All Tabs - Visual Grid Layout (consistent across all violation types)
          <div>
            <div style={{ marginBottom: "1rem", color: "#64748b", fontSize: "0.875rem" }}>
              {activeTab === "ADMIN_FLAGGED" 
                ? "Showing admin-flagged violations with webcam and screen snapshots"
                : activeTab === "VISUAL_EVIDENCE"
                ? "Showing snapshots captured at violation trigger"
                : `Showing ${TAB_CONFIG[activeTab].label.toLowerCase()} violations`}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: activeTab === "ADMIN_FLAGGED" 
                  ? "repeat(auto-fill, minmax(350px, 1fr))" 
                  : "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "1rem",
              }}
            >
              {filteredLogs.map((log, index) => {
                const severityStyle = getSeverityStyle(log.severity);
                const allEvidence = extractAllEvidence(log);
                const isAdminFlagged = log.eventType === 'ADMIN_FLAGGED';
                const hasDualEvidence = isAdminFlagged && allEvidence.length >= 2;
                const reason = log.metadata?.reason;
                
                // For ADMIN_FLAGGED with dual evidence, show both; otherwise show single snapshot
                if (hasDualEvidence) {
                  const webcamEvidence = allEvidence.find(e => e.type === 'webcam');
                  const screenEvidence = allEvidence.find(e => e.type === 'screen');
                  
                  return (
                  <div
                    key={log._id || index}
                    onClick={() => {
                      // For dual evidence, clicking the card shows the first image (webcam)
                      // Individual images can be clicked separately
                      if (webcamEvidence) {
                        const base64Data = webcamEvidence.data.startsWith('data:') 
                          ? webcamEvidence.data.split(',')[1] 
                          : webcamEvidence.data;
                        // Clear metadata.evidence to prevent extractSnapshot from using the array
                        const metadataWithoutEvidence = { ...log.metadata };
                        delete metadataWithoutEvidence.evidence;
                        setSelectedImage({
                          ...log,
                          evidence: { type: 'webcam', format: 'jpeg', data: base64Data },
                          snapshotBase64: webcamEvidence.data,
                          metadata: metadataWithoutEvidence
                        });
                      }
                    }}
                    style={{
                      cursor: webcamEvidence ? "pointer" : "default",
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
                      {/* Dual snapshot display: side-by-side */}
                      <div style={{ display: "flex", width: "100%", height: activeTab === "ADMIN_FLAGGED" ? "200px" : "150px" }}>
                        {/* Webcam snapshot - clickable */}
                        <div 
                          style={{ flex: 1, position: "relative", borderRight: "1px solid #e2e8f0", cursor: webcamEvidence ? "pointer" : "default" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (webcamEvidence) {
                              // Extract base64 data from data URI if needed
                              const base64Data = webcamEvidence.data.startsWith('data:') 
                                ? webcamEvidence.data.split(',')[1] 
                                : webcamEvidence.data;
                              // Create a temporary log object with just the webcam image for modal display
                              // Clear metadata.evidence to prevent extractSnapshot from using the array
                              const metadataWithoutEvidence = { ...log.metadata };
                              delete metadataWithoutEvidence.evidence;
                              setSelectedImage({
                                ...log,
                                evidence: { type: 'webcam', format: 'jpeg', data: base64Data },
                                snapshotBase64: webcamEvidence.data,
                                metadata: metadataWithoutEvidence
                              });
                            }
                          }}
                        >
                          {webcamEvidence ? (
                            <>
                              <div style={{ 
                                position: "absolute", 
                                top: "4px", 
                                left: "4px", 
                                backgroundColor: "rgba(0, 0, 0, 0.6)", 
                                color: "#ffffff", 
                                padding: "2px 6px", 
                                borderRadius: "4px", 
                                fontSize: "0.625rem", 
                                fontWeight: 600,
                                zIndex: 1
                              }}>
                                WEBCAM
                              </div>
                              <img
                                src={webcamEvidence.data}
                                alt="Webcam"
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  backgroundColor: "#f1f5f9",
                                }}
                              />
                            </>
                          ) : (
                            <div style={{ width: "100%", height: "100%", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "0.75rem" }}>
                              No Webcam
                            </div>
                          )}
                        </div>
                        {/* Screen snapshot - clickable */}
                        <div 
                          style={{ flex: 1, position: "relative", cursor: screenEvidence ? "pointer" : "default" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (screenEvidence) {
                              // Extract base64 data from data URI if needed
                              const base64Data = screenEvidence.data.startsWith('data:') 
                                ? screenEvidence.data.split(',')[1] 
                                : screenEvidence.data;
                              // Create a temporary log object with just the screen image for modal display
                              // Clear metadata.evidence to prevent extractSnapshot from using the array
                              const metadataWithoutEvidence = { ...log.metadata };
                              delete metadataWithoutEvidence.evidence;
                              setSelectedImage({
                                ...log,
                                evidence: { type: 'screen', format: 'jpeg', data: base64Data },
                                snapshotBase64: screenEvidence.data,
                                metadata: metadataWithoutEvidence
                              });
                            }
                          }}
                        >
                          {screenEvidence ? (
                            <>
                              <div style={{ 
                                position: "absolute", 
                                top: "4px", 
                                left: "4px", 
                                backgroundColor: "rgba(0, 0, 0, 0.6)", 
                                color: "#ffffff", 
                                padding: "2px 6px", 
                                borderRadius: "4px", 
                                fontSize: "0.625rem", 
                                fontWeight: 600,
                                zIndex: 1
                              }}>
                                SCREEN
                              </div>
                              <img
                                src={screenEvidence.data}
                                alt="Screen"
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  backgroundColor: "#f1f5f9",
                                }}
                              />
                            </>
                          ) : (
                            <div style={{ width: "100%", height: "100%", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "0.75rem" }}>
                              No Screen
                            </div>
                          )}
                        </div>
                      </div>
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
                        {/* Show reason for ADMIN_FLAGGED events */}
                        {reason && (
                          <div style={{ 
                            fontSize: "0.75rem", 
                            color: "#475569", 
                            marginBottom: "0.25rem",
                            lineHeight: "1.4",
                            maxHeight: "2.8em",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical"
                          }}>
                            {reason}
                          </div>
                        )}
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          {formatTimestamp(log.timestamp)}
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // Single snapshot display or no snapshot (card layout for all violations)
                const snapshot = extractSnapshot(log);
                
                return (
                  <div
                    key={log._id || index}
                    onClick={() => snapshot ? setSelectedImage(log) : undefined}
                    style={{
                      cursor: snapshot ? "pointer" : "default",
                      border: "1px solid #e2e8f0",
                      borderRadius: "0.5rem",
                      overflow: "hidden",
                      backgroundColor: "#ffffff",
                      transition: "transform 0.2s, box-shadow 0.2s",
                      display: "flex",
                      flexDirection: "column",
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
                    {/* Show snapshot if available, otherwise skip image area */}
                    {snapshot ? (
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
                    ) : null}
                    <div style={{ padding: snapshot ? "0.75rem" : "1rem" }}>
                      {/* Icon and Event Type Header for non-snapshot events */}
                      {!snapshot && (
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.75rem"
                        }}>
                          <span style={{ fontSize: "1.5rem" }}>
                            {TAB_CONFIG[activeTab]?.icon || "📋"}
                          </span>
                          <div
                            style={{
                              fontSize: "0.875rem",
                              fontWeight: 600,
                              color: severityStyle.color,
                            }}
                          >
                            {log.eventType.replace(/_/g, " ")}
                          </div>
                        </div>
                      )}
                      {/* Event Type for snapshot events */}
                      {snapshot && (
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
                      )}
                      {/* Show severity badge */}
                      {log.severity && (
                        <div style={{ 
                          display: "inline-block",
                          fontSize: "0.625rem",
                          fontWeight: 600,
                          padding: "0.125rem 0.5rem",
                          borderRadius: "9999px",
                          backgroundColor: severityStyle.bg,
                          color: severityStyle.color,
                          marginBottom: "0.5rem"
                        }}>
                          {severityStyle.badge}
                        </div>
                      )}
                      {/* Show reason for ADMIN_FLAGGED events */}
                      {isAdminFlagged && reason && (
                        <div style={{ 
                          fontSize: "0.75rem", 
                          color: "#475569", 
                          marginBottom: "0.5rem",
                          lineHeight: "1.4",
                          maxHeight: "2.8em",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical"
                        }}>
                          {reason}
                        </div>
                      )}
                      {/* Show metadata for non-snapshot events - cleaner display */}
                      {!snapshot && log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div style={{ 
                          fontSize: "0.75rem", 
                          color: "#475569",
                          marginBottom: "0.5rem",
                          lineHeight: "1.5"
                        }}>
                          {Object.entries(log.metadata)
                            .filter(([key]) => !key.includes("snapshot") && !key.includes("base64") && !key.includes("evidence") && key !== "reason")
                            .map(([key, value]) => (
                              <div key={key} style={{ marginBottom: "0.25rem" }}>
                                <span style={{ fontWeight: 600, color: "#64748b" }}>{key}:</span>{" "}
                                <span style={{ color: "#0f172a" }}>{String(value)}</span>
                              </div>
                            ))}
                        </div>
                      )}
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: snapshot ? "0.25rem" : "0" }}>
                        {formatTimestamp(log.timestamp)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflow: "hidden",
              position: "relative",
              display: "flex",
              flexDirection: "column",
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
              <div style={{ 
                width: "100%", 
                maxHeight: "70vh", 
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#000000",
                flex: "1 1 auto"
              }}>
                <img
                  src={extractSnapshot(selectedImage)!}
                  alt="Violation evidence"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "70vh",
                    height: "auto",
                    width: "auto",
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              </div>
            )}

            {/* Details */}
            <div style={{ padding: "1.5rem", overflowY: "auto", flex: "0 0 auto" }}>
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

              {/* Reason for ADMIN_FLAGGED events */}
              {selectedImage.eventType === 'ADMIN_FLAGGED' && selectedImage.metadata?.reason && (
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
                    Reason
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#0f172a", lineHeight: "1.5" }}>
                    {selectedImage.metadata.reason}
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
