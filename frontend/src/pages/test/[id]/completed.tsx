import { useEffect } from "react";
import { useRouter } from "next/router";

export default function TestCompletedPage() {
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    // Clear any test-related session storage
    // Add any cleanup logic here if needed
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #E8FAF0 0%, #F0FDF4 50%, #ECFDF5 100%)",
      padding: "2rem",
    }}>
      <div style={{
        maxWidth: "600px",
        width: "100%",
        backgroundColor: "#ffffff",
        borderRadius: "1.5rem",
        padding: "3rem",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        textAlign: "center",
        border: "1px solid #A8E8BC",
      }}>
        {/* Success Icon */}
        <div style={{
          width: "100px",
          height: "100px",
          borderRadius: "50%",
          backgroundColor: "#dcfce7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 2rem",
          border: "4px solid #86efac",
          boxShadow: "0 4px 6px rgba(34, 197, 94, 0.2)",
        }}>
          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22c55e"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>

        {/* Title */}
        <h1 style={{
          marginBottom: "1rem",
          fontSize: "2rem",
          color: "#1E5A3B",
          fontWeight: 700,
          lineHeight: 1.2,
        }}>
          Test Submitted Successfully!
        </h1>

        {/* Main Message */}
        <p style={{
          color: "#2D7A52",
          marginBottom: "2rem",
          fontSize: "1.125rem",
          lineHeight: 1.7,
          fontWeight: 500,
        }}>
          Thank you for completing the test. Your responses have been submitted successfully.
        </p>

        {/* Info Card */}
        <div style={{
          backgroundColor: "#f0fdf4",
          border: "2px solid #86efac",
          borderRadius: "1rem",
          padding: "1.5rem",
          marginBottom: "2rem",
          boxShadow: "0 1px 3px rgba(34, 197, 94, 0.1)",
        }}>
          <div style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
            marginBottom: "0.75rem",
          }}>
            <div style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              backgroundColor: "#dcfce7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: "2px",
            }}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{
                color: "#166534",
                fontSize: "0.9375rem",
                margin: 0,
                marginBottom: "0.5rem",
                fontWeight: 600,
              }}>
                Your test is being evaluated in the background.
              </p>
              <p style={{
                color: "#15803d",
                fontSize: "0.875rem",
                margin: 0,
                lineHeight: 1.6,
              }}>
                You will be notified about your results via email once the evaluation is complete.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Message */}
        <p style={{
          color: "#4A9A6A",
          fontSize: "0.9375rem",
          fontWeight: 500,
          margin: 0,
        }}>
          You can now close this window.
        </p>
      </div>
    </div>
  );
}