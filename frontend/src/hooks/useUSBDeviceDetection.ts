import { useState, useCallback, useRef, useEffect } from "react";
import { USB_DETECTION_CONFIG } from "../config/precheckConfig";

// ============================================================================
// Types
// ============================================================================

export type USBDeviceType = 
  | "storage" 
  | "keyboard" 
  | "mouse" 
  | "audio" 
  | "network" 
  | "unknown";

export type USBDeviceSeverity = "low" | "medium" | "high" | "critical";

export interface USBDevice {
  id: string;
  vendorId: number;
  productId: number;
  manufacturer?: string;
  product?: string;
  serialNumber?: string;
  type: USBDeviceType;
  severity: USBDeviceSeverity;
  connectedAt: string;
  lastSeen: string;
}

export interface USBDeviceEvent {
  eventType: "device_connected" | "device_disconnected" | "device_changed";
  device: USBDevice;
  timestamp: string;
  assessmentId?: string;
  userId?: string;
}

export interface USBDeviceDetectionResult {
  devices: USBDevice[];
  baselineDevices: USBDevice[];
  newDevices: USBDevice[];
  disconnectedDevices: USBDevice[];
  suspiciousDevices: USBDevice[];
  isSupported: boolean;
  permissionGranted: boolean;
  error?: string;
}

interface UseUSBDeviceDetectionOptions {
  assessmentId?: string;
  userId?: string;
  onViolation?: (event: USBDeviceEvent) => void;
  enableMonitoring?: boolean;
  checkInterval?: number; // ms
  severityThreshold?: USBDeviceSeverity; // Only flag devices at or above this severity
}

interface UseUSBDeviceDetectionReturn {
  isScanning: boolean;
  isMonitoring: boolean;
  detectionResult: USBDeviceDetectionResult | null;
  error: string | null;
  scan: () => Promise<USBDeviceDetectionResult>;
  startMonitoring: () => Promise<void>;
  stopMonitoring: () => void;
  requestPermission: () => Promise<boolean>;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CHECK_INTERVAL = USB_DETECTION_CONFIG.DEFAULT_CHECK_INTERVAL_MS;
const DEFAULT_SEVERITY_THRESHOLD: USBDeviceSeverity = USB_DETECTION_CONFIG.DEFAULT_SEVERITY_THRESHOLD as USBDeviceSeverity;

// USB Device Class Codes (from USB specification)
const USB_CLASS_CODES: Record<number, USBDeviceType> = USB_DETECTION_CONFIG.USB_CLASS_CODES as Record<number, USBDeviceType>;

// Severity mapping for device types
const DEVICE_SEVERITY: Record<USBDeviceType, USBDeviceSeverity> = USB_DETECTION_CONFIG.DEVICE_SEVERITY as Record<USBDeviceType, USBDeviceSeverity>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if WebUSB API is supported
 */
function isWebUSBSupported(): boolean {
  return typeof navigator !== "undefined" && "usb" in navigator;
}

/**
 * Known USB vendor IDs for common device manufacturers
 * These help identify device types when product name is unclear
 */
const KNOWN_VENDOR_IDS: Record<number, { type?: USBDeviceType; name: string }> = {
  // Logitech (many mice/keyboards)
  0x046d: { name: "Logitech", type: undefined },
  // Microsoft (mice/keyboards)
  0x045e: { name: "Microsoft", type: undefined },
  // Razer (gaming mice/keyboards)
  0x1532: { name: "Razer", type: undefined },
  // Corsair (gaming peripherals)
  0x1b1c: { name: "Corsair", type: undefined },
  // SteelSeries (gaming mice)
  0x1038: { name: "SteelSeries", type: undefined },
  // HP (various devices)
  0x03f0: { name: "HP", type: undefined },
  // Dell (various devices)
  0x413c: { name: "Dell", type: undefined },
  // Mobile phone manufacturers (should be flagged as storage)
  0x04e8: { name: "Samsung", type: "storage" }, // Samsung Electronics
  0x05ac: { name: "Apple", type: "storage" }, // Apple Inc.
  0x18d1: { name: "Google", type: "storage" }, // Google Inc.
  0x0bb4: { name: "HTC", type: "storage" }, // HTC Corporation
  0x12d1: { name: "Huawei", type: "storage" }, // Huawei Technologies
  0x2a47: { name: "OnePlus", type: "storage" }, // OnePlus Technology
  0x2d95: { name: "Xiaomi", type: "storage" }, // Xiaomi Inc.
  0x04c5: { name: "Fujitsu", type: "storage" }, // Fujitsu (some phones)
  0x0e79: { name: "Archos", type: "storage" }, // Archos (mobile devices)
  0x0fce: { name: "Sony", type: "storage" }, // Sony Mobile Communications
  0x22b8: { name: "Motorola", type: "storage" }, // Motorola Mobility
  0x24e3: { name: "LG", type: "storage" }, // LG Electronics
};

/**
 * Determine device type from USB device
 */
function determineDeviceType(device: USBDevice): USBDeviceType {
  const productLower = (device.product || "").toLowerCase();
  const manufacturerLower = (device.manufacturer || "").toLowerCase();
  const combinedText = `${productLower} ${manufacturerLower}`.toLowerCase();
  
  // Check for storage devices (including mobile phones in file transfer mode)
  const storageKeywords = USB_DETECTION_CONFIG.STORAGE_KEYWORDS;
  const mobileKeywords = USB_DETECTION_CONFIG.MOBILE_PHONE_KEYWORDS;
  const mobileManufacturers = USB_DETECTION_CONFIG.MOBILE_PHONE_MANUFACTURERS;
  
  if (storageKeywords.some(keyword => productLower.includes(keyword)) ||
      mobileKeywords.some(keyword => productLower.includes(keyword)) ||
      // Check if manufacturer is a known phone manufacturer
      (KNOWN_VENDOR_IDS[device.vendorId]?.type === "storage") ||
      (mobileManufacturers.some(manufacturer => manufacturerLower.includes(manufacturer)) && 
       !productLower.includes("monitor") && !productLower.includes("printer") && 
       !productLower.includes("keyboard") && !productLower.includes("mouse") &&
       !productLower.includes("chromecast")) ||
      (productLower.includes("usb") && (productLower.includes("flash") || productLower.includes("drive")))) {
    return "storage";
  }
  
  // Check for keyboard devices
  const keyboardKeywords = USB_DETECTION_CONFIG.KEYBOARD_KEYWORDS;
  if (keyboardKeywords.some(keyword => productLower.includes(keyword)) ||
      combinedText.includes("keyboard")) {
    return "keyboard";
  }
  
  // Check for mouse devices - expanded patterns
  const mouseKeywords = USB_DETECTION_CONFIG.MOUSE_KEYWORDS;
  if (mouseKeywords.some(keyword => productLower.includes(keyword)) ||
      combinedText.includes("mouse") ||
      // Check vendor IDs for known mouse manufacturers
      (KNOWN_VENDOR_IDS[device.vendorId] && 
       (productLower.includes("mx") || 
        productLower.includes("g") || 
        productLower.includes("deathadder") ||
        productLower.includes("viper") ||
        productLower.includes("g502") ||
        productLower.includes("g703") ||
        productLower.includes("g903"))) ||
      // Generic HID device from mouse manufacturer
      (device.vendorId === 0x046d && productLower.length < 20)) { // Logitech short names often are mice
    return "mouse";
  }
  
  // Check for audio devices
  if (productLower.includes("audio") || 
      productLower.includes("headset") || 
      productLower.includes("microphone") ||
      productLower.includes("speaker") ||
      productLower.includes("headphone") ||
      productLower.includes("earphone") ||
      productLower.includes("sound") ||
      combinedText.includes("audio")) {
    return "audio";
  }
  
  // Check for network devices
  if (productLower.includes("network") || 
      productLower.includes("ethernet") || 
      productLower.includes("wifi") ||
      productLower.includes("wireless adapter") ||
      productLower.includes("lan adapter") ||
      productLower.includes("usb to ethernet") ||
      combinedText.includes("network")) {
    return "network";
  }
  
  // If we have vendor ID but no clear product name, check if it's from a known peripheral manufacturer
  // This is a heuristic - many Logitech/Microsoft devices are mice/keyboards
  if (device.vendorId && KNOWN_VENDOR_IDS[device.vendorId]) {
    const vendor = KNOWN_VENDOR_IDS[device.vendorId];
    // If product name is short or generic, likely a mouse/keyboard
    if (!device.product || device.product.length < 15) {
      // Default to mouse for unknown devices from peripheral manufacturers
      return "mouse";
    }
  }
  
  return "unknown";
}

/**
 * Create USB device object from WebUSB device
 */
async function createUSBDevice(device: USBDevice): Promise<USBDevice> {
  const deviceType = determineDeviceType(device);
  const severity = DEVICE_SEVERITY[deviceType];
  
  return {
    ...device,
    type: deviceType,
    severity,
    connectedAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  };
}

/**
 * Scan USB devices using WebUSB API
 * Note: getDevices() only returns devices that have been previously granted permission.
 * If no permission has been granted, this will return an empty array.
 * Use requestDevice() to prompt the user to select and grant permission for devices.
 */
async function scanUSBDevicesWebUSB(): Promise<USBDevice[]> {
  if (!isWebUSBSupported()) {
    throw new Error("WebUSB API not supported in this browser");
  }

  try {
    // getDevices() only returns devices that have been previously granted permission
    const devices = await (navigator as any).usb.getDevices();
    
    console.log("[USBDetection] WebUSB getDevices() returned:", devices.length, "devices (only previously granted devices)");
    
    if (devices.length === 0) {
      console.log("[USBDetection] No devices found. User needs to grant permission first using requestDevice()");
      console.log("[USBDetection] Tip: Call requestPermission() to prompt user to select USB devices");
    }
    
    const usbDevices: USBDevice[] = [];
    
    for (const device of devices) {
      try {
        const usbDevice: USBDevice = {
          id: `${device.vendorId}-${device.productId}-${device.serialNumber || "unknown"}`,
          vendorId: device.vendorId,
          productId: device.productId,
          manufacturer: device.manufacturerName,
          product: device.productName,
          serialNumber: device.serialNumber,
          type: "unknown",
          severity: "medium",
          connectedAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
        };
        
        const typedDevice = await createUSBDevice(usbDevice);
        usbDevices.push(typedDevice);
        console.log("[USBDetection] Processed device:", device.productName || "Unknown", `(Vendor: ${device.vendorId}, Product: ${device.productId})`);
      } catch (err) {
        console.error("[USBDetection] Error processing device:", err);
      }
    }
    
    return usbDevices;
  } catch (error) {
    console.error("[USBDetection] Error scanning USB devices:", error);
    throw error;
  }
}

/**
 * Scan HID devices using HID API
 * 
 * IMPORTANT LIMITATION: Chrome blocks access to standard mice and keyboards for security.
 * According to Chrome docs: "Chrome inspects the usage of each top-level collection and 
 * if a top-level collection has a protected usage (e.g. generic keyboard, mouse), then a 
 * website won't be able to send and receive any reports defined in that collection."
 * 
 * This means we can ONLY detect "uncommon" HID devices like:
 * - Alternative keyboards (e.g. Elgato Stream Deck, X-keys)
 * - Exotic gamepads
 * - Custom HID devices
 * 
 * Standard USB mice and keyboards are PROTECTED and cannot be detected via WebHID.
 * Reference: https://developer.chrome.com/docs/capabilities/hid
 */
async function scanHIDDevices(): Promise<USBDevice[]> {
  const devices: USBDevice[] = [];
  
  if (typeof (navigator as any).hid === "undefined") {
    console.log("[USBDetection] HID API not supported");
    return devices;
  }
  
  try {
    const hidDevices = await (navigator as any).hid.getDevices();
    console.log("[USBDetection] Found HID devices (uncommon only - standard mice/keyboards are blocked):", hidDevices.length);
    
    // Note: Standard mice/keyboards won't appear here due to Chrome's security restrictions
    for (const hidDevice of hidDevices) {
      try {
        const productName = hidDevice.productName || "HID Device";
        const productLower = productName.toLowerCase();
        const manufacturer = hidDevice.manufacturerName || "";
        const combinedText = `${productLower} ${manufacturer.toLowerCase()}`;
        
        // These are uncommon HID devices that Chrome allows access to
        let deviceType: USBDeviceType = "unknown";
        if (productLower.includes("stream deck") ||
            productLower.includes("x-keys") ||
            productLower.includes("gamepad") ||
            productLower.includes("controller")) {
          // Uncommon alternative keyboards or gamepads
          deviceType = "keyboard"; // Treat as keyboard for proctoring purposes
        }
        
        const usbDevice: USBDevice = {
          id: `hid-${hidDevice.vendorId}-${hidDevice.productId}-${hidDevice.serialNumber || "unknown"}`,
          vendorId: hidDevice.vendorId,
          productId: hidDevice.productId,
          manufacturer: manufacturer,
          product: productName,
          serialNumber: hidDevice.serialNumber,
          type: deviceType,
          severity: deviceType === "keyboard" ? "high" : "medium",
          connectedAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
        };
        
        devices.push(usbDevice);
        console.log("[USBDetection] Uncommon HID device detected:", productName, "Type:", deviceType);
      } catch (err) {
        console.error("[USBDetection] Error processing HID device:", err);
      }
    }
  } catch (error: any) {
    // HID API requires permission - this is expected if user hasn't granted it
    if (error.name === "SecurityError" || error.message?.includes("permission")) {
      console.log("[USBDetection] HID permission required - user needs to grant access");
    } else {
      console.log("[USBDetection] HID scan error:", error);
    }
  }
  
  return devices;
}

/**
 * Fallback: Detect USB devices using MediaDevices API (audio/video only)
 */
async function scanUSBDevicesFallback(): Promise<USBDevice[]> {
  const devices: USBDevice[] = [];
  
  try {
    // Get media devices (cameras, microphones)
    const mediaDevices = await navigator.mediaDevices.enumerateDevices();
    
    for (const device of mediaDevices) {
      // Only include USB devices (they often have "USB" in the label)
      if (device.label && device.label.toLowerCase().includes("usb")) {
        const usbDevice: USBDevice = {
          id: device.deviceId,
          vendorId: 0,
          productId: 0,
          product: device.label,
          type: device.kind === "audioinput" || device.kind === "audiooutput" ? "audio" : "unknown",
          severity: "low",
          connectedAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
        };
        
        devices.push(usbDevice);
      }
    }
  } catch (error) {
    console.error("[USBDetection] Error in fallback scan:", error);
  }
  
  return devices;
}

/**
 * Main scan function
 */
async function scanUSBDevices(): Promise<USBDevice[]> {
  const allDevices: USBDevice[] = [];
  
  // Try WebUSB API first
  if (isWebUSBSupported()) {
    try {
      const webUSBDevices = await scanUSBDevicesWebUSB();
      allDevices.push(...webUSBDevices);
      console.log("[USBDetection] WebUSB devices found:", webUSBDevices.length);
    } catch (error) {
      console.warn("[USBDetection] WebUSB scan failed:", error);
    }
  }
  
  // Try HID API for uncommon HID devices (standard mice/keyboards are blocked by Chrome)
  // Note: Standard USB mice and keyboards cannot be detected due to Chrome security restrictions
  try {
    const hidDevices = await scanHIDDevices();
    // Merge HID devices, avoiding duplicates
    for (const hidDevice of hidDevices) {
      const isDuplicate = allDevices.some(device => 
        device.vendorId === hidDevice.vendorId && 
        device.productId === hidDevice.productId &&
        device.serialNumber === hidDevice.serialNumber
      );
      if (!isDuplicate) {
        allDevices.push(hidDevice);
      }
    }
    console.log("[USBDetection] Uncommon HID devices found:", hidDevices.length);
  } catch (error) {
    console.warn("[USBDetection] HID scan failed:", error);
  }
  
  // Fallback to MediaDevices API
  try {
    const fallbackDevices = await scanUSBDevicesFallback();
    // Only add devices not already found
    for (const fallbackDevice of fallbackDevices) {
      const isDuplicate = allDevices.some(device => device.id === fallbackDevice.id);
      if (!isDuplicate) {
        allDevices.push(fallbackDevice);
      }
    }
    console.log("[USBDetection] Fallback devices found:", fallbackDevices.length);
  } catch (error) {
    console.warn("[USBDetection] Fallback scan failed:", error);
  }
  
  console.log("[USBDetection] Total devices detected:", allDevices.length);
  return allDevices;
}

// ============================================================================
// Main Hook
// ============================================================================

export function useUSBDeviceDetection({
  assessmentId,
  userId,
  onViolation,
  enableMonitoring = false,
  checkInterval = DEFAULT_CHECK_INTERVAL,
  severityThreshold = DEFAULT_SEVERITY_THRESHOLD,
}: UseUSBDeviceDetectionOptions = {}): UseUSBDeviceDetectionReturn {
  const [isScanning, setIsScanning] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [detectionResult, setDetectionResult] = useState<USBDeviceDetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const baselineDevicesRef = useRef<USBDevice[]>([]);
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastScanTimeRef = useRef<number>(0);

  /**
   * Request permission to access USB devices
   * This will show a browser popup where the user can select USB devices to grant access to.
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    let permissionGranted = false;
    
    console.log("[USBDetection] Requesting USB device permission...");
    
    // Try WebUSB API first (for storage devices, network adapters, etc.)
    if (isWebUSBSupported()) {
      try {
        console.log("[USBDetection] Requesting WebUSB permission - browser popup will appear");
        // Request access to a USB device (user will see browser prompt)
        // Empty filter matches any device, but user must select from the list
        const device = await (navigator as any).usb.requestDevice({
          filters: [{}], // Empty filter matches any device
        });
        
        // If we got here, permission was granted
        if (device) {
          permissionGranted = true;
          console.log("[USBDetection] ✅ WebUSB permission granted for device:", device.productName || "Unknown");
        }
      } catch (err: any) {
        if (err.name === "NotFoundError") {
          // User closed the device picker without selecting
          console.log("[USBDetection] ⚠️ User closed device picker without selecting a device");
        } else if (err.name === "SecurityError") {
          // Permission denied
          console.log("[USBDetection] ❌ WebUSB permission denied by user");
        } else {
          console.error("[USBDetection] WebUSB permission request error:", err);
        }
      }
    } else {
      console.log("[USBDetection] WebUSB API not supported in this browser");
    }
    
    // Also try HID API for uncommon HID devices
    // Note: Standard mice/keyboards are blocked by Chrome and won't appear
    if (typeof (navigator as any).hid !== "undefined") {
      try {
        console.log("[USBDetection] Requesting HID permission - browser popup will appear");
        // Request HID device access (only uncommon devices will be shown)
        const hidDevices = await (navigator as any).hid.requestDevice({
          filters: [{}], // Empty filter matches any HID device
        });
        
        if (hidDevices && hidDevices.length > 0) {
          permissionGranted = true;
          console.log("[USBDetection] ✅ HID permission granted, uncommon devices:", hidDevices.length);
          hidDevices.forEach((dev: any) => {
            console.log("[USBDetection]   -", dev.productName || "Unknown HID device");
          });
        }
      } catch (err: any) {
        if (err.name === "NotFoundError") {
          console.log("[USBDetection] ⚠️ User closed HID device picker without selecting");
        } else if (err.name === "SecurityError") {
          console.log("[USBDetection] ❌ HID permission denied by user");
        } else {
          console.error("[USBDetection] HID permission request error:", err);
        }
      }
    } else {
      console.log("[USBDetection] HID API not supported in this browser");
    }
    
    if (permissionGranted) {
      console.log("[USBDetection] ✅ Permission granted! You can now scan for devices.");
    } else {
      console.log("[USBDetection] ⚠️ No permission granted. User needs to select devices from the browser popup.");
    }
    
    return permissionGranted;
  }, []);

  /**
   * Scan for USB devices
   */
  const scan = useCallback(async (): Promise<USBDeviceDetectionResult> => {
    setIsScanning(true);
    setError(null);
    
    try {
      const devices = await scanUSBDevices();
      
      const baselineDevices = baselineDevicesRef.current.length === 0 
        ? devices 
        : baselineDevicesRef.current;
      
      // If this is the first scan, set baseline
      if (baselineDevicesRef.current.length === 0) {
        baselineDevicesRef.current = devices;
      }
      
      // Find new devices
      const newDevices = devices.filter(
        device => !baselineDevices.some(baseline => baseline.id === device.id)
      );
      
      // Find disconnected devices
      const disconnectedDevices = baselineDevices.filter(
        baseline => !devices.some(device => device.id === baseline.id)
      );
      
      // Filter suspicious devices based on severity threshold
      const severityOrder: USBDeviceSeverity[] = ["low", "medium", "high", "critical"];
      const thresholdIndex = severityOrder.indexOf(severityThreshold);
      const suspiciousDevices = devices.filter(device => {
        const deviceSeverityIndex = severityOrder.indexOf(device.severity);
        return deviceSeverityIndex >= thresholdIndex;
      });
      
      const result: USBDeviceDetectionResult = {
        devices,
        baselineDevices,
        newDevices,
        disconnectedDevices,
        suspiciousDevices,
        isSupported: isWebUSBSupported(),
        permissionGranted: isWebUSBSupported(),
      };
      
      setDetectionResult(result);
      lastScanTimeRef.current = Date.now();
      
      // Report violations for new suspicious devices
      if (onViolation && newDevices.length > 0) {
        for (const device of newDevices) {
          if (suspiciousDevices.includes(device)) {
            const event: USBDeviceEvent = {
              eventType: "device_connected",
              device,
              timestamp: new Date().toISOString(),
              assessmentId,
              userId,
            };
            onViolation(event);
          }
        }
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "USB scan failed";
      setError(errorMessage);
      console.error("[USBDetection] Scan error:", errorMessage);
      
      // Return empty result on error
      return {
        devices: [],
        baselineDevices: baselineDevicesRef.current,
        newDevices: [],
        disconnectedDevices: [],
        suspiciousDevices: [],
        isSupported: isWebUSBSupported(),
        permissionGranted: false,
        error: errorMessage,
      };
    } finally {
      setIsScanning(false);
    }
  }, [assessmentId, userId, onViolation, severityThreshold]);

  /**
   * Start monitoring for USB device changes
   */
  const startMonitoring = useCallback(async () => {
    if (isMonitoring) {
      return;
    }
    
    // Set baseline on first scan
    if (baselineDevicesRef.current.length === 0) {
      await scan();
    }
    
    setIsMonitoring(true);
    
    // Set up periodic scanning
    monitoringIntervalRef.current = setInterval(async () => {
      try {
        await scan();
      } catch (err) {
        console.error("[USBDetection] Monitoring scan error:", err);
      }
    }, checkInterval);
    
    console.log("[USBDetection] Monitoring started");
  }, [isMonitoring, scan, checkInterval]);

  /**
   * Stop monitoring
   */
  const stopMonitoring = useCallback(() => {
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }
    setIsMonitoring(false);
    console.log("[USBDetection] Monitoring stopped");
  }, []);

  // Auto-start monitoring if enabled
  useEffect(() => {
    if (enableMonitoring && !isMonitoring) {
      startMonitoring();
    }
    
    return () => {
      stopMonitoring();
    };
  }, [enableMonitoring, isMonitoring, startMonitoring, stopMonitoring]);

  return {
    isScanning,
    isMonitoring,
    detectionResult,
    error,
    scan,
    startMonitoring,
    stopMonitoring,
    requestPermission,
  };
}

export default useUSBDeviceDetection;

