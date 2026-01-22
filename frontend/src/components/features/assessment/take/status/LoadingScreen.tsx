/**
 * LoadingScreen Component
 * 
 * Displays loading state while assessment is being initialized
 */

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = "Loading assessment..." }: LoadingScreenProps) {
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
        maxWidth: "400px",
        textAlign: "center",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
      }}>
        <div style={{
          width: "40px",
          height: "40px",
          border: "4px solid #3b82f6",
          borderTop: "4px solid transparent",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
          margin: "0 auto 1.5rem",
        }} />
        <p style={{ fontSize: "1rem", color: "#64748b" }}>
          {message}
        </p>
      </div>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}




