/**
 * WaitingScreen Component
 * 
 * Displays waiting screen when assessment hasn't started yet (strict mode)
 */

interface WaitingScreenProps {
  startTime: Date;
  timeUntilStart: number; // seconds
}

export function WaitingScreen({ startTime, timeUntilStart }: WaitingScreenProps) {
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ 
      backgroundColor: "#f1dcba", 
      minHeight: "100vh", 
      padding: "2rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        backgroundColor: "#ffffff",
        borderRadius: "0.75rem",
        padding: "3rem",
        maxWidth: "600px",
        textAlign: "center",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
      }}>
        <h1 style={{ fontSize: "2rem", color: "#1a1625", marginBottom: "1rem", fontWeight: 700 }}>
          Assessment Will Start Soon
        </h1>
        <p style={{ fontSize: "1.125rem", color: "#64748b", marginBottom: "2rem" }}>
          The assessment will begin at:
        </p>
        <div style={{
          fontSize: "1.5rem",
          color: "#6953a3",
          fontWeight: 700,
          marginBottom: "2rem",
          padding: "1rem",
          backgroundColor: "#f8fafc",
          borderRadius: "0.5rem",
        }}>
          {startTime.toLocaleString()}
        </div>
        <div style={{
          fontSize: "1.25rem",
          color: "#1e293b",
          marginBottom: "1rem",
        }}>
          Time remaining:
        </div>
        <div style={{
          fontSize: "2rem",
          color: "#3b82f6",
          fontWeight: 700,
          marginBottom: "2rem",
        }}>
          {formatTime(timeUntilStart)}
        </div>
        <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
          Please wait. The assessment will start automatically when the time arrives.
        </p>
      </div>
    </div>
  );
}




