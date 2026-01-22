/**
 * Precheck Configuration
 * All configurable values for extension and USB device detection
 */

// ============================================================================
// Extension Detection Configuration
// ============================================================================

export const EXTENSION_DETECTION_CONFIG = {
  // Timeouts and delays
  EXTENSION_CHECK_TIMEOUT_MS: 50, // Timeout per extension check
  BATCH_SIZE: 25, // Number of extensions to check in parallel
  BATCH_DELAY_MS: 10, // Delay between batches
  INITIAL_DELAY_MS: 100, // Initial delay before starting scan
  MAX_SCAN_TIME_MS: 3000, // Maximum total scan time

  // Extension URL patterns
  EXTENSION_PROTOCOLS: {
    CHROME: "chrome-extension://",
    FIREFOX: "moz-extension://",
    SAFARI: "safari-web-extension://",
  } as const,

  // Extension management URLs
  EXTENSION_MANAGEMENT_URLS: {
    CHROME: "chrome://extensions",
    EDGE: "edge://extensions",
  } as const,

  // UI Messages
  MESSAGES: {
    SCANNING: "Scanning for browser extensions...",
    SCANNING_DESCRIPTION: (count: number) => 
      `Checking ${count} known extensions (usually completes in 1-2 seconds)`,
    EXTENSIONS_DETECTED: (count: number) => 
      `Extension Indicators Detected (${count})`,
    NO_EXTENSIONS: "No Extension Indicators Found",
    BLOCKING_MESSAGE: "🚫 Cannot proceed: Browser extensions detected. Please remove all extensions before continuing.",
    HOW_TO_DISABLE: "How to disable:",
    DISABLE_INSTRUCTIONS: [
      "Go to {chromeUrl} or {edgeUrl}",
      "Toggle OFF each extension listed above",
      "Click \"Re-scan\" below to verify",
    ],
    MANUAL_CERTIFICATION: "I certify that I have manually disabled ALL browser extensions",
    MANUAL_CERTIFICATION_DETAIL: "by going to {chromeUrl} or {edgeUrl} and toggling them all OFF.",
    REQUIRED_CERTIFICATION: "REQUIRED: I certify that I have manually disabled ALL browser extensions",
    REQUIRED_CERTIFICATION_DETAIL: "I have gone to {chromeUrl} or {edgeUrl} and toggled OFF all extensions. I understand that using extensions during the assessment will result in disqualification.",
  },
} as const;

// ============================================================================
// USB Device Detection Configuration
// ============================================================================

export const USB_DETECTION_CONFIG = {
  // Timing
  DEFAULT_CHECK_INTERVAL_MS: 5000, // 5 seconds
  DEFAULT_SEVERITY_THRESHOLD: "medium" as const,

  // USB Device Class Codes (from USB specification)
  USB_CLASS_CODES: {
    0x08: "storage",      // Mass Storage
    0x03: "keyboard",     // HID (Human Interface Device) - Keyboard
    0x01: "audio",        // Audio
    0x0E: "audio",        // Audio/Video
    0x02: "network",      // Communications and CDC Control
    0xE0: "network",      // Wireless Controller
  } as Record<number, string>,

  // Severity mapping for device types
  DEVICE_SEVERITY: {
    storage: "critical",
    keyboard: "high",
    mouse: "medium",
    audio: "low",
    network: "high",
    unknown: "medium",
  } as Record<string, string>,

  // Known USB vendor IDs for common device manufacturers
  KNOWN_VENDOR_IDS: {
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
  } as Record<number, { name: string; type?: string }>,

  // Device type detection keywords
  STORAGE_KEYWORDS: [
    "storage",
    "drive",
    "disk",
    "flash",
    "pen drive",
    "thumb drive",
    "usb stick",
    "memory stick",
    "usb drive",
    "external drive",
    "portable drive",
    "mass storage",
    "mtp", // Media Transfer Protocol (phones)
  ],

  MOBILE_PHONE_KEYWORDS: [
    "phone",
    "mobile",
    "android",
    "iphone",
    "ipad",
    "tablet",
    "smartphone",
    "galaxy", // Samsung Galaxy
    "pixel", // Google Pixel
  ],

  MOBILE_PHONE_MANUFACTURERS: [
    "samsung",
    "apple",
    "google",
    "huawei",
    "xiaomi",
    "oneplus",
    "motorola",
    "lg",
    "sony",
    "htc",
    "oppo",
    "vivo",
    "realme",
  ],

  KEYBOARD_KEYWORDS: [
    "keyboard",
    "kb",
    "keypad",
  ],

  MOUSE_KEYWORDS: [
    "mouse",
    "trackball",
    "trackpad",
    "touchpad",
    "pointing",
    "optical mouse",
    "wireless mouse",
    "gaming mouse",
    "laser mouse",
  ],

  // UI Messages
  MESSAGES: {
    NO_DEVICES: "No USB devices detected yet. Grant permission to scan for connected devices.",
    GRANT_PERMISSION: "Grant USB Permission",
    RE_SCAN: "🔄 Re-scan USB Devices",
    SCANNING: "Scanning USB devices...",
    DEVICES_FOUND: (count: number) => `${count} device(s) detected`,
    SUSPICIOUS_DEVICES: (count: number) => `${count} suspicious device(s) found`,
  },
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get extension management URL based on browser
 */
export function getExtensionManagementUrl(): string {
  if (typeof window === "undefined") {
    return EXTENSION_DETECTION_CONFIG.EXTENSION_MANAGEMENT_URLS.EDGE;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("edg")) {
    return EXTENSION_DETECTION_CONFIG.EXTENSION_MANAGEMENT_URLS.EDGE;
  }
  if (userAgent.includes("chrome")) {
    return EXTENSION_DETECTION_CONFIG.EXTENSION_MANAGEMENT_URLS.CHROME;
  }
  // Default to Edge
  return EXTENSION_DETECTION_CONFIG.EXTENSION_MANAGEMENT_URLS.EDGE;
}

/**
 * Format extension management URLs in messages
 */
export function formatExtensionUrls(chromeUrl: string, edgeUrl: string): { chromeUrl: string; edgeUrl: string } {
  return {
    chromeUrl: EXTENSION_DETECTION_CONFIG.EXTENSION_MANAGEMENT_URLS.CHROME,
    edgeUrl: EXTENSION_DETECTION_CONFIG.EXTENSION_MANAGEMENT_URLS.EDGE,
  };
}

/**
 * Replace placeholders in messages
 */
export function formatMessage(message: string, replacements: Record<string, string>): string {
  let formatted = message;
  Object.entries(replacements).forEach(([key, value]) => {
    formatted = formatted.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  });
  return formatted;
}

