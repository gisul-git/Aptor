import { useState, useCallback, useRef } from "react";
import { KNOWN_EXTENSIONS, type ExtensionSignature } from "../lib/extensionDatabase";
import { EXTENSION_DETECTION_CONFIG } from "../config/precheckConfig";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ExtensionInfo {
  id: string;
  name: string;
  version?: string;
  enabled?: boolean;
}

export interface ExtensionScanResult {
  count: number;
  hasExtensions: boolean;
  confidence: ConfidenceLevel;
  permissionGranted: boolean;
  permissionDenied: boolean;
  details: {
    uniqueExtensionIds: string[];
    extensions: ExtensionInfo[];
    injectedScripts: number;
    injectedStyles: number;
    modifiedElements: number;
    totalIndicators: number;
  };
  scanTime: number;
}

interface UsePrecheckExtensionsReturn {
  isScanning: boolean;
  scanResult: ExtensionScanResult | null;
  error: string | null;
  scan: () => Promise<ExtensionScanResult>;
  requestPermission: () => Promise<boolean>;
  reportWarning: (assessmentId: string, userId: string) => Promise<void>;
}

/**
 * Detect extension by attempting to fetch its web-accessible resource
 * Based on method from: https://github.com/abrahamjuliot/creepjs
 * If the fetch succeeds, the extension is installed.
 */
async function detectExtensionById(extension: ExtensionSignature): Promise<boolean> {
  const url = `${EXTENSION_DETECTION_CONFIG.EXTENSION_PROTOCOLS.CHROME}${extension.id}/${extension.file}`;
  
  return new Promise((resolve) => {
    // Use Image loading as primary method (works for images, CSS, etc.)
    const img = new Image();
    let resolved = false;
    
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        // Fallback: try fetch for non-image resources
        fetch(url, { method: 'HEAD', mode: 'no-cors' })
          .then(() => {
            if (!resolved) {
              resolved = true;
              console.log(`[ExtensionDetection] ✅ Detected via fetch: ${extension.name}`);
              resolve(true);
            }
          })
          .catch(() => {
            if (!resolved) {
              resolved = true;
              console.log(`[ExtensionDetection] ❌ Not detected: ${extension.name} (ID: ${extension.id.substring(0, 8)}...)`);
              resolve(false);
            }
          });
      }
    }, EXTENSION_DETECTION_CONFIG.EXTENSION_CHECK_TIMEOUT_MS);
    
    img.onload = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.log(`[ExtensionDetection] ✅ Detected via image: ${extension.name}`);
        resolve(true);
      }
    };
    
    img.onerror = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        // Try fetch as fallback for non-image resources
        fetch(url, { method: 'HEAD' })
          .then((res) => {
            if (res.ok) {
              if (!resolved) {
                resolved = true;
                console.log(`[ExtensionDetection] ✅ Detected via fetch fallback: ${extension.name}`);
                resolve(true);
              }
            } else {
              if (!resolved) {
                resolved = true;
                console.log(`[ExtensionDetection] ❌ Not detected: ${extension.name} (ID: ${extension.id.substring(0, 8)}...)`);
                resolve(false);
              }
            }
          })
          .catch(() => {
            if (!resolved) {
              resolved = true;
              console.log(`[ExtensionDetection] ❌ Not detected: ${extension.name} (ID: ${extension.id.substring(0, 8)}...)`);
              resolve(false);
            }
          });
      }
    };
    
    // Start detection
    img.src = url;
  });
}

/**
 * Detect all known extensions using the extension database method
 * This is the PRIMARY detection method - works without browser permissions
 */
async function detectAllKnownExtensions(): Promise<{ extensionIds: Set<string>; extensionMap: Map<string, ExtensionInfo>; totalIndicators: number }> {
  const extensionIds = new Set<string>();
  const extensionMap = new Map<string, ExtensionInfo>();
  let totalIndicators = 0;

  const totalExtensions = KNOWN_EXTENSIONS.length;
  console.log('[ExtensionDetection] Scanning', totalExtensions, 'known extensions using extension database method...');

  // Test all known extensions in parallel (with batching to avoid overwhelming)
  const batchSize = EXTENSION_DETECTION_CONFIG.BATCH_SIZE;
  let processedCount = 0;
  
  // Add maximum scan time limit
  const maxScanTime = EXTENSION_DETECTION_CONFIG.MAX_SCAN_TIME_MS;
  const startTime = Date.now();
  
  for (let i = 0; i < totalExtensions; i += batchSize) {
    // Check if we've exceeded max scan time
    if (Date.now() - startTime > maxScanTime) {
      console.log('[ExtensionDetection] ⏱️ Scan time limit reached, stopping early');
      break;
    }
    
    const batch = KNOWN_EXTENSIONS.slice(i, i + batchSize);
    processedCount += batch.length;
    
    console.log(`[ExtensionDetection] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(totalExtensions / batchSize)} (${processedCount}/${totalExtensions} extensions)...`);
    
    const detectionPromises = batch.map(async (ext) => {
      const detected = await detectExtensionById(ext);
      if (detected) {
        console.log('[ExtensionDetection] ✅ Found:', ext.name, `(${ext.id})`);
        extensionIds.add(ext.id);
        extensionMap.set(ext.id, {
          id: ext.id,
          name: ext.name,
          enabled: true,
        });
        totalIndicators += 2;
      }
      return detected;
    });

    await Promise.all(detectionPromises);
    
    // Minimal delay between batches for faster scanning
    if (i + batchSize < totalExtensions) {
      await new Promise(resolve => setTimeout(resolve, EXTENSION_DETECTION_CONFIG.BATCH_DELAY_MS));
    }
  }
  
  console.log(`[ExtensionDetection] Completed scanning ${processedCount} extensions`);

  console.log('[ExtensionDetection] Extension database scan complete. Found:', extensionIds.size, 'extensions');

  return { extensionIds, extensionMap, totalIndicators };
}

// Web-based detection fallback (DOM-based)
function detectExtensionsWebBased(): { extensionIds: Set<string>; extensionMap: Map<string, ExtensionInfo>; totalIndicators: number } {
  const extensionIds = new Set<string>();
  const extensionMap = new Map<string, ExtensionInfo>();
  let totalIndicators = 0;

  try {
    // Check for extension URLs in scripts
    const scripts = document.querySelectorAll("script[src]");
    scripts.forEach((script) => {
      if (script instanceof HTMLScriptElement) {
        const src = script.src;
        const extensionProtocols = [
          EXTENSION_DETECTION_CONFIG.EXTENSION_PROTOCOLS.CHROME,
          EXTENSION_DETECTION_CONFIG.EXTENSION_PROTOCOLS.FIREFOX,
          EXTENSION_DETECTION_CONFIG.EXTENSION_PROTOCOLS.SAFARI,
        ];
        if (extensionProtocols.some(protocol => src.includes(protocol))) {
          totalIndicators++;
          const match = src.match(/(?:chrome-extension|moz-extension|safari-web-extension):\/\/([a-z0-9]+)/i);
          if (match && match[1]) {
            extensionIds.add(match[1]);
            // Try to find name from database
            const knownExt = KNOWN_EXTENSIONS.find(e => e.id === match[1]);
            extensionMap.set(match[1], { 
              id: match[1], 
              name: knownExt ? knownExt.name : `Extension ${match[1].substring(0, 8)}` 
            });
          }
        }
      }
    });

    // Check for extension URLs in stylesheets
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    links.forEach((link) => {
      if (link instanceof HTMLLinkElement) {
        const href = link.href;
        const extensionProtocols = [
          EXTENSION_DETECTION_CONFIG.EXTENSION_PROTOCOLS.CHROME,
          EXTENSION_DETECTION_CONFIG.EXTENSION_PROTOCOLS.FIREFOX,
          EXTENSION_DETECTION_CONFIG.EXTENSION_PROTOCOLS.SAFARI,
        ];
        if (extensionProtocols.some(protocol => href.includes(protocol))) {
          totalIndicators++;
          const protocolPattern = [
            EXTENSION_DETECTION_CONFIG.EXTENSION_PROTOCOLS.CHROME.replace("://", ""),
            EXTENSION_DETECTION_CONFIG.EXTENSION_PROTOCOLS.FIREFOX.replace("://", ""),
            EXTENSION_DETECTION_CONFIG.EXTENSION_PROTOCOLS.SAFARI.replace("://", ""),
          ].join("|");
          const match = href.match(new RegExp(`(?:${protocolPattern}):\\/\\/([a-z0-9]+)`, "i"));
          if (match && match[1]) {
            extensionIds.add(match[1]);
            // Try to find name from database
            const knownExt = KNOWN_EXTENSIONS.find(e => e.id === match[1]);
            extensionMap.set(match[1], { 
              id: match[1], 
              name: knownExt ? knownExt.name : `Extension ${match[1].substring(0, 8)}` 
          });
        }
      }
      }
    });
  } catch (e) {
    console.error('[ExtensionDetection] Web-based detection error:', e);
  }

  return { extensionIds, extensionMap, totalIndicators };
}

async function detectExtensionsWithPermission(): Promise<ExtensionScanResult> {
  const detectionResults = {
    extensionIds: new Set<string>(),
    extensionMap: new Map<string, ExtensionInfo>(),
    totalIndicators: 0,
    permissionGranted: false,
    permissionDenied: false,
  };

  console.log('[ExtensionDetection] Starting comprehensive scan...');

  // METHOD 1: Extension Database Detection (PRIMARY - works without permissions)
  // This is the proven method from creepjs - detects known extensions by fetching their resources
  try {
    console.log('[ExtensionDetection] Method 1: Extension database detection...');
    const knownExtResults = await detectAllKnownExtensions();
    
    // Merge results
    knownExtResults.extensionIds.forEach(id => detectionResults.extensionIds.add(id));
    knownExtResults.extensionMap.forEach((info, id) => {
      detectionResults.extensionMap.set(id, info);
    });
    detectionResults.totalIndicators += knownExtResults.totalIndicators;
    
    console.log('[ExtensionDetection] Extension database method found:', knownExtResults.extensionIds.size, 'extensions');
  } catch (error) {
    console.error('[ExtensionDetection] Extension database detection error:', error);
  }

  // METHOD 2: DOM-based detection (fallback - finds extensions injecting into page)
  try {
    console.log('[ExtensionDetection] Method 2: DOM-based detection...');
    const webResults = detectExtensionsWebBased();
    
    // Merge results (avoid duplicates)
    webResults.extensionIds.forEach(id => {
      if (!detectionResults.extensionIds.has(id)) {
        detectionResults.extensionIds.add(id);
        detectionResults.extensionMap.set(id, webResults.extensionMap.get(id)!);
        detectionResults.totalIndicators += 1;
      }
    });
    
    console.log('[ExtensionDetection] DOM-based method found:', webResults.extensionIds.size, 'additional extensions');
  } catch (error) {
    console.error('[ExtensionDetection] DOM-based detection error:', error);
  }

  // METHOD 3: chrome.management API (only works in extension context, not web pages)
  // Check if we're in an extension context
  const isExtensionContext = typeof (window as any).chrome !== 'undefined' && 
                             (window as any).chrome.runtime && 
                             (window as any).chrome.runtime.id;

  if (isExtensionContext) {
    try {
      if ((window as any).chrome.management) {
        console.log('[ExtensionDetection] Method 3: chrome.management API (extension context only)...');
        
        try {
          const extensions = await new Promise<any[]>((resolve, reject) => {
            (window as any).chrome.management.getAll((exts: any[]) => {
              if ((window as any).chrome.runtime?.lastError) {
                const error = (window as any).chrome.runtime.lastError;
                console.error('[ExtensionDetection] API error:', error);
                reject(error);
              } else {
                resolve(exts || []);
              }
            });
          });

          console.log('[ExtensionDetection] chrome.management found:', extensions.length, 'extensions');
          detectionResults.permissionGranted = true;

          const actualExtensions = extensions.filter(ext => 
            ext.type === 'extension' && 
            ext.enabled === true &&
            !ext.isApp
          );

          actualExtensions.forEach(ext => {
            if (!detectionResults.extensionIds.has(ext.id)) {
              detectionResults.extensionIds.add(ext.id);
              detectionResults.extensionMap.set(ext.id, {
                id: ext.id,
                name: ext.name,
                version: ext.version,
                enabled: ext.enabled,
              });
              detectionResults.totalIndicators += 2;
            }
          });

          console.log('[ExtensionDetection] chrome.management detected:', actualExtensions.length, 'new extensions');
        } catch (error: any) {
          console.error('[ExtensionDetection] Permission error:', error);
          if (error?.message && (error.message.includes('denied') || error.message.includes('not allowed'))) {
            detectionResults.permissionDenied = true;
          }
        }
      }
    } catch (e) {
      console.error('[ExtensionDetection] Extension API error:', e);
    }
  } else {
    console.log('[ExtensionDetection] chrome.management API not available (web page context)');
  }

  const extensions = Array.from(detectionResults.extensionMap.values());
  const uniqueExtensionCount = detectionResults.extensionIds.size;

  // Determine confidence level
  let confidence: ConfidenceLevel = "medium";
  if (detectionResults.permissionGranted) {
    confidence = "high"; // chrome.management API gives high confidence
  } else if (uniqueExtensionCount > 0) {
    confidence = "high"; // Extension database method is also high confidence
  } else {
    confidence = "low"; // No extensions found
  }

  console.log('[ExtensionDetection] Total unique extensions detected:', uniqueExtensionCount);
  console.log('[ExtensionDetection] Confidence level:', confidence);

  return {
    count: uniqueExtensionCount,
    hasExtensions: uniqueExtensionCount > 0,
    confidence,
    permissionGranted: detectionResults.permissionGranted,
    permissionDenied: detectionResults.permissionDenied,
    details: {
      uniqueExtensionIds: Array.from(detectionResults.extensionIds),
      extensions,
      injectedScripts: 0,
      injectedStyles: 0,
      modifiedElements: 0,
      totalIndicators: detectionResults.totalIndicators,
    },
    scanTime: 0, // Will be set by caller
  };
}

export function usePrecheckExtensions(): UsePrecheckExtensionsReturn {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ExtensionScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scanIdRef = useRef(0);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      // Check if we're in an extension context
      const isExtensionContext = typeof (window as any).chrome !== 'undefined' && 
                                 (window as any).chrome.runtime && 
                                 (window as any).chrome.runtime.id;

      if (isExtensionContext && (window as any).chrome.permissions) {
        console.log('[ExtensionDetection] Requesting permission in extension context');
        const granted = await new Promise<boolean>((resolve) => {
          (window as any).chrome.permissions.request(
            { permissions: ['management'] },
            (granted: boolean) => {
              if ((window as any).chrome.runtime?.lastError) {
                console.error('[ExtensionDetection] Permission request error:', (window as any).chrome.runtime.lastError);
            resolve(false);
        } else {
                resolve(granted);
              }
            }
          );
        });
        return granted;
      } else {
        // In web page context, chrome.permissions is not available
        // We'll use web-based detection instead
        console.log('[ExtensionDetection] Permission API not available in web page context - using web-based detection');
        return false;
      }
    } catch (err) {
      console.error('[ExtensionDetection] Permission request failed:', err);
      return false;
    }
  }, []);

  const scan = useCallback(async (): Promise<ExtensionScanResult> => {
    setIsScanning(true);
    setError(null);
    
    const currentScanId = ++scanIdRef.current;
    const startTime = performance.now();
    
    try {
      // Initial delay before starting scan
      await new Promise((resolve) => setTimeout(resolve, EXTENSION_DETECTION_CONFIG.INITIAL_DELAY_MS));
      
      if (currentScanId !== scanIdRef.current) {
        throw new Error("Scan cancelled");
      }
      
      // Add maximum timeout for entire scan
      const scanPromise = detectExtensionsWithPermission();
      const timeoutPromise = new Promise<ExtensionScanResult>((resolve) => {
        setTimeout(() => {
          console.log('[ExtensionDetection] ⏱️ Scan timeout reached, returning partial results');
          resolve({
            hasExtensions: false,
            count: 0,
            details: {
              extensions: [],
              uniqueExtensionIds: [],
              injectedScripts: 0,
              injectedStyles: 0,
              modifiedElements: 0,
              totalIndicators: 0,
            },
            confidence: "low",
            permissionGranted: false,
            permissionDenied: false,
            scanTime: EXTENSION_DETECTION_CONFIG.MAX_SCAN_TIME_MS,
          });
        }, EXTENSION_DETECTION_CONFIG.MAX_SCAN_TIME_MS);
      });
      
      const detectionResult = await Promise.race([scanPromise, timeoutPromise]);

      if (currentScanId !== scanIdRef.current) {
        throw new Error("Scan cancelled");
      }
      
      const scanTime = performance.now() - startTime;
      
      const result: ExtensionScanResult = {
        ...detectionResult,
        scanTime,
      };
      
      setScanResult(result);
      
      console.log('[ExtensionDetection] Complete:', {
        count: result.count,
        permissionGranted: result.permissionGranted,
        permissionDenied: result.permissionDenied,
        extensions: result.details.extensions.map(e => e.name),
      });
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Scan failed";
      if (errorMessage !== "Scan cancelled") {
        setError(errorMessage);
        console.error('[ExtensionDetection] Error:', errorMessage);
      }
      throw err;
    } finally {
      if (currentScanId === scanIdRef.current) {
        setIsScanning(false);
      }
    }
  }, []);

  const reportWarning = useCallback(
    async (assessmentId: string, userId: string): Promise<void> => {
      if (!scanResult || !scanResult.hasExtensions) return;
    
    try {
      await fetch("/api/proctor/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "PRECHECK_WARNING",
          timestamp: new Date().toISOString(),
          assessmentId,
          userId,
          metadata: {
            source: "extension_detection",
              extensionCount: scanResult.count,
              hasExtensions: scanResult.hasExtensions,
              confidence: scanResult.confidence,
              permissionGranted: scanResult.permissionGranted,
              details: scanResult.details,
          },
        }),
      });
        
        console.log("[ExtensionDetection] Warning reported to backend");
    } catch (err) {
      console.error("[ExtensionDetection] Failed to report warning:", err);
    }
    },
    [scanResult]
  );

  return {
    isScanning,
    scanResult,
    error,
    scan,
    requestPermission,
    reportWarning,
  };
}

export default usePrecheckExtensions;
