import React, { useState, useEffect } from "react";
import useUSBDeviceDetection, { USBDeviceSeverity } from "@/hooks/useUSBDeviceDetection";

interface USBDeviceCheckProps {
  assessmentId?: string;
  userId?: string;
  onComplete?: (hasSuspiciousDevices: boolean) => void;
}

const SEVERITY_COLORS: Record<USBDeviceSeverity, string> = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#ef4444",
  critical: "#dc2626",
};

const SEVERITY_LABELS: Record<USBDeviceSeverity, string> = {
  low: "Low Risk",
  medium: "Medium Risk",
  high: "High Risk",
  critical: "Critical Risk",
};

export function USBDeviceCheck({ assessmentId, userId, onComplete }: USBDeviceCheckProps) {
  const {
    isScanning,
    detectionResult,
    error,
    scan,
    requestPermission,
  } = useUSBDeviceDetection({
    assessmentId,
    userId,
    severityThreshold: "medium",
  });

  const [hasScanned, setHasScanned] = useState(false);
  const [permissionRequested, setPermissionRequested] = useState(false);

  // Auto-scan on mount
  useEffect(() => {
    if (!hasScanned && !isScanning) {
      const timer = setTimeout(() => {
        scan().then(() => setHasScanned(true));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasScanned, isScanning, scan]);

  // Notify parent when scan completes
  useEffect(() => {
    if (detectionResult && hasScanned && onComplete) {
      const hasSuspicious = detectionResult.suspiciousDevices.length > 0;
      onComplete(hasSuspicious);
    }
  }, [detectionResult, hasScanned, onComplete]);

  const handleRequestPermission = async () => {
    setPermissionRequested(true);
    try {
      const granted = await requestPermission();
      if (granted) {
        // Wait a bit for permission to be processed
        await new Promise(resolve => setTimeout(resolve, 500));
        await scan();
        setHasScanned(true);
      } else {
        // Permission denied or no device selected
        console.log("[USBDeviceCheck] Permission not granted or no device selected");
      }
    } catch (err) {
      console.error("[USBDeviceCheck] Permission request error:", err);
    }
  };

  if (error && !detectionResult) {
    return (
      <div style={{
        padding: "1.25rem",
        backgroundColor: "#fef2f2",
        border: "2px solid #fecaca",
        borderRadius: "0.75rem",
        marginBottom: "1rem",
      }}>
        <p style={{ margin: 0, color: "#991b1b", fontSize: "0.875rem" }}>
          ⚠️ USB device detection is not available in this browser.
          <br />
          <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
            Please use Chrome or Edge for full USB monitoring support.
          </span>
        </p>
      </div>
    );
  }

  if (isScanning && !hasScanned) {
    return (
      <div style={{
        padding: "1.25rem",
        backgroundColor: "#f8fafc",
        border: "2px solid #e2e8f0",
        borderRadius: "0.75rem",
        marginBottom: "1rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: "24px",
            height: "24px",
            border: "2px solid #e2e8f0",
            borderTopColor: "#10b981",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }} />
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>
            Scanning for USB devices...
          </p>
        </div>
      </div>
    );
  }

  // Always show the component, even if no result yet
  // This ensures the permission request button is always visible
  const devices = detectionResult?.devices || [];
  const suspiciousDevices = detectionResult?.suspiciousDevices || [];
  const isSupported = detectionResult?.isSupported ?? true; // Default to true
  const permissionGranted = detectionResult?.permissionGranted ?? false;

  return (
    <div style={{
      padding: "1.25rem",
      backgroundColor: suspiciousDevices.length > 0 ? "#fef2f2" : "#f0fdf4",
      border: `2px solid ${suspiciousDevices.length > 0 ? "#fecaca" : "#86efac"}`,
      borderRadius: "0.75rem",
      marginBottom: "1rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <span style={{ fontSize: "1.5rem" }}>
          {suspiciousDevices.length > 0 ? "⚠️" : "✅"}
        </span>
        <h3 style={{
          margin: 0,
          fontSize: "1rem",
          fontWeight: 600,
          color: suspiciousDevices.length > 0 ? "#dc2626" : "#065f46",
        }}>
          USB Device Detection
        </h3>
      </div>

      {!isSupported && (
        <div style={{
          padding: "0.75rem",
          backgroundColor: "#fffbeb",
          border: "1px solid #fcd34d",
          borderRadius: "0.5rem",
          marginBottom: "0.75rem",
        }}>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "#92400e" }}>
            ⚠️ WebUSB API not supported. Using fallback detection (limited to audio/video devices).
          </p>
        </div>
      )}

                          {!permissionGranted && isSupported && (
        <div style={{
          padding: "0.75rem",
          backgroundColor: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: "0.5rem",
          marginBottom: "0.75rem",
        }}>
          <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.8125rem", fontWeight: 600, color: "#991b1b" }}>
            🔐 USB Device Permission Required
          </p>
          <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.8125rem", color: "#991b1b" }}>
            To detect USB devices (storage, network adapters, mobile phones), you need to grant permission. 
            Click the button below and select your USB devices from the browser popup.
          </p>
          <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", color: "#64748b", fontStyle: "italic" }}>
            ℹ️ No USB devices detected yet. Grant permission to scan for connected devices.
          </p>
          <div style={{
            padding: "0.5rem",
            backgroundColor: "#ffffff",
            borderRadius: "0.375rem",
            marginBottom: "0.5rem",
            fontSize: "0.75rem",
            color: "#64748b",
          }}>
            <p style={{ margin: "0 0 0.25rem 0", fontWeight: 600 }}>Instructions:</p>
            <ol style={{ margin: "0.25rem 0", paddingLeft: "1.25rem" }}>
              <li>Click "Grant USB Permission" button below</li>
              <li>A browser popup will appear showing connected USB devices</li>
              <li>Select your USB device(s) from the list (e.g., your mobile phone, flash drive)</li>
              <li>Click "Connect" or "Add"</li>
              <li>The scan will automatically run after permission is granted</li>
            </ol>
          </div>
          <div style={{
            padding: "0.5rem",
            backgroundColor: "#ffffff",
            borderRadius: "0.375rem",
            marginBottom: "0.5rem",
            fontSize: "0.75rem",
            color: "#64748b",
          }}>
            <p style={{ margin: "0 0 0.25rem 0", fontWeight: 600 }}>What We CAN Detect:</p>
            <ul style={{ margin: "0.25rem 0", paddingLeft: "1.25rem" }}>
              <li>USB storage devices (flash drives, external drives, mobile phones in file transfer mode)</li>
              <li>USB network adapters</li>
              <li>Uncommon HID devices (Stream Deck, custom keyboards)</li>
            </ul>
            <p style={{ margin: "0.5rem 0 0.25rem 0", fontWeight: 600 }}>What We CANNOT Detect:</p>
            <ul style={{ margin: "0.25rem 0", paddingLeft: "1.25rem" }}>
              <li>Standard USB mice (blocked by Chrome for security)</li>
              <li>Standard USB keyboards (blocked by Chrome for security)</li>
              <li>Devices in charging-only mode (no data connection)</li>
            </ul>
          </div>
          {!permissionRequested ? (
            <button
              onClick={handleRequestPermission}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "#dc2626",
                color: "#ffffff",
                border: "none",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
                width: "100%",
              }}
            >
              🔐 Grant USB Permission
            </button>
          ) : (
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", fontStyle: "italic" }}>
              Waiting for permission... If no popup appeared, check browser settings or try again.
            </p>
          )}
        </div>
      )}

      {detectionResult && (
        <div style={{
          padding: "0.75rem",
          backgroundColor: "#ffffff",
          borderRadius: "0.5rem",
          marginBottom: "0.75rem",
        }}>
          <p style={{
            fontWeight: 600,
            margin: "0 0 0.5rem 0",
            color: suspiciousDevices.length > 0 ? "#dc2626" : "#065f46",
            fontSize: "0.875rem",
          }}>
            {suspiciousDevices.length > 0
              ? `⚠️ ${suspiciousDevices.length} Suspicious Device(s) Detected`
              : devices.length > 0
              ? `✅ ${devices.length} Device(s) Detected (All Safe)`
              : `ℹ️ No USB devices detected`}
          </p>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>
            Total devices: {devices.length} | Suspicious: {suspiciousDevices.length}
          </p>
        </div>
      )}

      {suspiciousDevices.length > 0 && (
        <div style={{
          padding: "0.75rem",
          backgroundColor: "#fef2f2",
          borderRadius: "0.5rem",
          marginBottom: "0.75rem",
        }}>
          <p style={{
            margin: "0 0 0.75rem 0",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#991b1b",
          }}>
            Suspicious Devices:
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.8125rem" }}>
            {suspiciousDevices.map((device) => (
              <li key={device.id} style={{ marginBottom: "0.5rem", color: "#991b1b" }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem",
                  backgroundColor: "#ffffff",
                  borderRadius: "0.375rem",
                  border: `1px solid ${SEVERITY_COLORS[device.severity]}`,
                }}>
                  <span style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: SEVERITY_COLORS[device.severity],
                    backgroundColor: `${SEVERITY_COLORS[device.severity]}20`,
                    padding: "0.25rem 0.5rem",
                    borderRadius: "0.25rem",
                  }}>
                    {SEVERITY_LABELS[device.severity]}
                  </span>
                  <span style={{ flex: 1 }}>
                    <strong>{device.product || "Unknown Device"}</strong>
                    {device.manufacturer && (
                      <span style={{ color: "#64748b", fontSize: "0.75rem" }}>
                        {" "}by {device.manufacturer}
                      </span>
                    )}
                    <br />
                    <span style={{ color: "#64748b", fontSize: "0.75rem" }}>
                      Type: {device.type} | ID: {device.id.substring(0, 20)}...
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {detectionResult && devices.length > 0 && suspiciousDevices.length === 0 && (
        <div style={{
          padding: "0.75rem",
          backgroundColor: "#f0fdf4",
          borderRadius: "0.5rem",
          marginBottom: "0.75rem",
        }}>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "#065f46" }}>
            ✅ All detected USB devices are safe. No suspicious devices found.
          </p>
        </div>
      )}

      {detectionResult && (
        <button
          onClick={() => {
            setHasScanned(false);
            scan().then(() => setHasScanned(true));
          }}
          disabled={isScanning}
          style={{
            width: "100%",
            padding: "0.75rem",
            backgroundColor: "#084A2A",
            color: "#ffffff",
            border: "none",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: isScanning ? "not-allowed" : "pointer",
            opacity: isScanning ? 0.6 : 1,
            marginTop: "0.75rem",
          }}
        >
          {isScanning ? "⏳ Scanning..." : "Re-scan USB Devices"}
        </button>
      )}

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default USBDeviceCheck;

