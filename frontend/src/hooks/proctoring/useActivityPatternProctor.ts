import { useEffect, useRef, useCallback } from "react";

// Activity pattern event types
export type ActivityPatternEventType =
  | "RAPID_CLICKING"
  | "COPY_PASTE_DETECTED"
  | "EXCESSIVE_MOUSE_MOVEMENT"
  | "PROLONGED_INACTIVITY"
  | "SUSPICIOUS_KEYBOARD_PATTERN"
  | "EXCESSIVE_SCROLLING";

interface ActivityPatternProctorOptions {
  userId: string;
  assessmentId: string;
  onViolation?: (violation: ActivityPatternViolation) => void;
  // Configuration thresholds
  rapidClickThreshold?: number; // clicks per second (default: 5)
  rapidClickWindowMs?: number; // time window in ms (default: 2000)
  copyPasteThreshold?: number; // characters per second (default: 50)
  copyPasteWindowMs?: number; // time window in ms (default: 1000)
  inactivityThresholdMs?: number; // milliseconds of inactivity (default: 300000 = 5 minutes)
  excessiveMouseDistance?: number; // pixels moved in window (default: 10000)
  excessiveMouseWindowMs?: number; // time window in ms (default: 10000 = 10 seconds)
  excessiveScrollThreshold?: number; // scroll events in window (default: 50)
  excessiveScrollWindowMs?: number; // time window in ms (default: 5000)
  enabled?: boolean; // Enable/disable monitoring (default: true)
}

interface ActivityPatternViolation {
  eventType: ActivityPatternEventType;
  timestamp: string;
  assessmentId: string;
  userId: string;
  metadata?: Record<string, unknown>;
}

interface ActivityEvent {
  type: "click" | "keydown" | "mousemove" | "scroll" | "paste" | "input";
  timestamp: number;
  data?: {
    x?: number;
    y?: number;
    key?: string;
    deltaY?: number;
    textLength?: number;
  };
}

/**
 * Custom hook to detect and record activity pattern violations during an exam session.
 * 
 * Detects:
 * - Rapid clicking (potential automation/cheating)
 * - Copy-paste patterns (rapid text input)
 * - Excessive mouse movement (distraction)
 * - Prolonged inactivity (potential cheating)
 * - Suspicious keyboard patterns
 * - Excessive scrolling (potential searching)
 */
export function useActivityPatternProctor({
  userId,
  assessmentId,
  onViolation,
  rapidClickThreshold = 5, // 5 clicks per second
  rapidClickWindowMs = 2000, // 2 second window
  copyPasteThreshold = 50, // 50 characters per second
  copyPasteWindowMs = 1000, // 1 second window
  inactivityThresholdMs = 300000, // 5 minutes
  excessiveMouseDistance = 10000, // 10,000 pixels
  excessiveMouseWindowMs = 10000, // 10 seconds
  excessiveScrollThreshold = 50, // 50 scroll events
  excessiveScrollWindowMs = 5000, // 5 seconds
  enabled = true,
}: ActivityPatternProctorOptions) {
  // Track violations locally
  const violationsRef = useRef<ActivityPatternViolation[]>([]);
  
  // Event history for pattern analysis
  const eventHistoryRef = useRef<ActivityEvent[]>([]);
  
  // Track last activity timestamp
  const lastActivityRef = useRef<number>(Date.now());
  
  // Track inactivity check interval
  const inactivityCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Track mouse position for distance calculation
  const lastMousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const mouseDistanceRef = useRef<number>(0);
  const mouseDistanceWindowStartRef = useRef<number>(Date.now());

  // Function to record a violation
  const recordViolation = useCallback(async (
    eventType: ActivityPatternEventType,
    metadata?: Record<string, unknown>
  ) => {
    const violation: ActivityPatternViolation = {
      eventType,
      timestamp: new Date().toISOString(),
      assessmentId,
      userId,
      metadata,
    };

    // Log locally
    violationsRef.current.push(violation);
    console.log(`[ActivityPatternProctor] ${eventType} violation recorded:`, violation);

    // Notify callback if provided
    if (onViolation) {
      onViolation(violation);
    }

    // Send to backend
    try {
      const response = await fetch("/api/proctor/record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(violation),
      });

      if (!response.ok) {
        console.error("[ActivityPatternProctor] Failed to record violation on server:", response.statusText);
      }
    } catch (error) {
      console.error("[ActivityPatternProctor] Error sending violation to server:", error);
    }
  }, [assessmentId, userId, onViolation]);

  // Clean up old events from history
  const cleanupEventHistory = useCallback(() => {
    const now = Date.now();
    const maxAge = Math.max(
      rapidClickWindowMs,
      copyPasteWindowMs,
      excessiveMouseWindowMs,
      excessiveScrollWindowMs
    );
    
    eventHistoryRef.current = eventHistoryRef.current.filter(
      (event) => now - event.timestamp < maxAge
    );
  }, [rapidClickWindowMs, copyPasteWindowMs, excessiveMouseWindowMs, excessiveScrollWindowMs]);

  // Analyze patterns and detect violations
  const analyzePatterns = useCallback(() => {
    cleanupEventHistory();
    const now = Date.now();
    const events = eventHistoryRef.current;

    // 1. Check for rapid clicking
    const recentClicks = events.filter(
      (e) => e.type === "click" && now - e.timestamp < rapidClickWindowMs
    );
    if (recentClicks.length >= rapidClickThreshold) {
      recordViolation("RAPID_CLICKING", {
        clickCount: recentClicks.length,
        windowMs: rapidClickWindowMs,
        clicksPerSecond: (recentClicks.length / rapidClickWindowMs) * 1000,
      });
      // Remove detected clicks to avoid duplicate violations
      eventHistoryRef.current = events.filter((e) => !recentClicks.includes(e));
    }

    // 2. Check for copy-paste (rapid text input)
    // Check for paste events first (most reliable)
    const recentPastes = events.filter(
      (e) => e.type === "paste" && now - e.timestamp < copyPasteWindowMs
    );
    if (recentPastes.length > 0) {
      // If paste event detected, check for rapid input events
      const recentInputs = events.filter(
        (e) => e.type === "input" && now - e.timestamp < copyPasteWindowMs
      );
      if (recentInputs.length > 0) {
        const totalChars = recentInputs.reduce((sum, e) => sum + (e.data?.textLength || 0), 0);
        const charsPerSecond = (totalChars / copyPasteWindowMs) * 1000;
        
        if (totalChars >= copyPasteThreshold || charsPerSecond >= copyPasteThreshold) {
          recordViolation("COPY_PASTE_DETECTED", {
            characters: totalChars,
            windowMs: copyPasteWindowMs,
            charsPerSecond,
            pasteEvents: recentPastes.length,
          });
          // Remove detected events to avoid duplicate violations
          eventHistoryRef.current = events.filter((e) => 
            !recentPastes.includes(e) && !recentInputs.includes(e)
          );
        }
      }
    }
    
    // Also check for rapid input events without paste (might be drag-drop or other rapid input)
    const recentInputs = events.filter(
      (e) => e.type === "input" && now - e.timestamp < copyPasteWindowMs
    );
    if (recentInputs.length > 0) {
      const totalChars = recentInputs.reduce((sum, e) => sum + (e.data?.textLength || 0), 0);
      const charsPerSecond = (totalChars / copyPasteWindowMs) * 1000;
      
      // Only trigger if significant amount of text (likely paste, not typing)
      if (totalChars >= copyPasteThreshold && charsPerSecond >= copyPasteThreshold) {
        recordViolation("COPY_PASTE_DETECTED", {
          characters: totalChars,
          windowMs: copyPasteWindowMs,
          charsPerSecond,
          inputEvents: recentInputs.length,
        });
        // Remove detected inputs to avoid duplicate violations
        eventHistoryRef.current = events.filter((e) => !recentInputs.includes(e));
      }
    }

    // 3. Check for excessive scrolling
    const recentScrolls = events.filter(
      (e) => e.type === "scroll" && now - e.timestamp < excessiveScrollWindowMs
    );
    if (recentScrolls.length >= excessiveScrollThreshold) {
      recordViolation("EXCESSIVE_SCROLLING", {
        scrollCount: recentScrolls.length,
        windowMs: excessiveScrollWindowMs,
        scrollsPerSecond: (recentScrolls.length / excessiveScrollWindowMs) * 1000,
      });
      // Remove detected scrolls to avoid duplicate violations
      eventHistoryRef.current = events.filter((e) => !recentScrolls.includes(e));
    }

    // 4. Check for excessive mouse movement (handled in mousemove handler)
    // Reset mouse distance if window expired
    if (now - mouseDistanceWindowStartRef.current > excessiveMouseWindowMs) {
      mouseDistanceRef.current = 0;
      mouseDistanceWindowStartRef.current = now;
    }
  }, [
    rapidClickThreshold,
    rapidClickWindowMs,
    copyPasteThreshold,
    copyPasteWindowMs,
    excessiveScrollThreshold,
    excessiveScrollWindowMs,
    excessiveMouseWindowMs,
    recordViolation,
    cleanupEventHistory,
  ]);

  // Mouse move handler
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!enabled) return;
    
    lastActivityRef.current = Date.now();
    
    const now = Date.now();
    const currentPos = { x: e.clientX, y: e.clientY };
    
    // Calculate distance moved
    if (lastMousePositionRef.current) {
      const dx = currentPos.x - lastMousePositionRef.current.x;
      const dy = currentPos.y - lastMousePositionRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      mouseDistanceRef.current += distance;
      
      // Reset window if expired
      if (now - mouseDistanceWindowStartRef.current > excessiveMouseWindowMs) {
        mouseDistanceRef.current = distance;
        mouseDistanceWindowStartRef.current = now;
      }
      
      // Check for excessive movement
      if (mouseDistanceRef.current >= excessiveMouseDistance) {
        recordViolation("EXCESSIVE_MOUSE_MOVEMENT", {
          distance: Math.round(mouseDistanceRef.current),
          windowMs: excessiveMouseWindowMs,
          pixelsPerSecond: (mouseDistanceRef.current / excessiveMouseWindowMs) * 1000,
        });
        mouseDistanceRef.current = 0;
        mouseDistanceWindowStartRef.current = now;
      }
    }
    
    lastMousePositionRef.current = currentPos;
    
    // Record event
    eventHistoryRef.current.push({
      type: "mousemove",
      timestamp: now,
      data: { x: e.clientX, y: e.clientY },
    });
    
    // Analyze patterns periodically (throttled)
    if (Math.random() < 0.1) { // 10% chance to analyze on each mousemove (throttle)
      analyzePatterns();
    }
  }, [enabled, excessiveMouseDistance, excessiveMouseWindowMs, recordViolation, analyzePatterns]);

  // Click handler
  const handleClick = useCallback((e: MouseEvent) => {
    if (!enabled) return;
    
    lastActivityRef.current = Date.now();
    
    eventHistoryRef.current.push({
      type: "click",
      timestamp: Date.now(),
      data: { x: e.clientX, y: e.clientY },
    });
    
    analyzePatterns();
  }, [enabled, analyzePatterns]);

  // Paste handler - detects actual paste events
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!enabled) return;
    
    lastActivityRef.current = Date.now();
    
    // Get pasted text length from clipboard
    const pastedText = e.clipboardData?.getData('text/plain') || '';
    const textLength = pastedText.length;
    
    console.log('[ActivityPatternProctor] Paste detected:', { textLength, pastedText: pastedText.substring(0, 50) });
    
    if (textLength > 0) {
      eventHistoryRef.current.push({
        type: "paste",
        timestamp: Date.now(),
        data: { textLength },
      });
      
      // If paste is significant, trigger violation immediately
      if (textLength >= copyPasteThreshold) {
        console.log('[ActivityPatternProctor] Large paste detected, recording violation:', textLength);
        recordViolation("COPY_PASTE_DETECTED", {
          characters: textLength,
          windowMs: copyPasteWindowMs,
          charsPerSecond: (textLength / copyPasteWindowMs) * 1000,
          pasteEvents: 1,
          detectedVia: 'paste_event',
        });
        // Remove this paste event to avoid duplicate
        eventHistoryRef.current = eventHistoryRef.current.filter(
          (e) => !(e.type === "paste" && e.data?.textLength === textLength)
        );
      } else {
        // Trigger analysis after paste for smaller pastes
        setTimeout(() => analyzePatterns(), 100);
      }
    }
  }, [enabled, analyzePatterns, copyPasteThreshold, copyPasteWindowMs, recordViolation]);

  // Input handler - detects rapid text insertion (paste, drag-drop, etc.)
  const handleInput = useCallback((e: Event) => {
    if (!enabled) return;
    
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLElement;
    if (!target) return;
    
    // Check if it's an input field or contentEditable
    const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
    const isContentEditable = (target as HTMLElement).isContentEditable;
    
    if (!isInputField && !isContentEditable) {
      return;
    }
    
    lastActivityRef.current = Date.now();
    
    // Calculate text length change
    const currentLength = isInputField 
      ? (target as HTMLInputElement | HTMLTextAreaElement).value?.length || 0
      : target.textContent?.length || 0;
    const previousLength = (target as any).__previousLength || 0;
    const textLength = currentLength - previousLength;
    
    // Store current length for next comparison
    (target as any).__previousLength = currentLength;
    
    // Only record if significant text was added (likely paste, not typing)
    if (textLength > 5) {
      console.log('[ActivityPatternProctor] Input detected:', { textLength, isContentEditable, tagName: target.tagName });
      
      eventHistoryRef.current.push({
        type: "input",
        timestamp: Date.now(),
        data: { textLength },
      });
      
      // If input is significant enough, trigger violation immediately
      if (textLength >= copyPasteThreshold) {
        console.log('[ActivityPatternProctor] Large input detected, recording violation:', textLength);
        recordViolation("COPY_PASTE_DETECTED", {
          characters: textLength,
          windowMs: copyPasteWindowMs,
          charsPerSecond: (textLength / copyPasteWindowMs) * 1000,
          inputEvents: 1,
          detectedVia: 'input_event',
        });
        // Remove this input event to avoid duplicate
        eventHistoryRef.current = eventHistoryRef.current.filter(
          (e) => !(e.type === "input" && e.data?.textLength === textLength)
        );
      } else {
        // Trigger analysis for rapid input
        setTimeout(() => analyzePatterns(), 100);
      }
    }
  }, [enabled, analyzePatterns, copyPasteThreshold, copyPasteWindowMs, recordViolation]);

  // Keyboard handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;
    
    lastActivityRef.current = Date.now();
    
    // Record keydown for other pattern analysis (not for copy-paste)
    eventHistoryRef.current.push({
      type: "keydown",
      timestamp: Date.now(),
      data: { key: e.key, textLength: 1 }, // Approximate: 1 char per keydown
    });
  }, [enabled]);

  // Scroll handler
  const handleScroll = useCallback((e: Event) => {
    if (!enabled) return;
    
    lastActivityRef.current = Date.now();
    
    const deltaY = (e as WheelEvent).deltaY || 0;
    
    eventHistoryRef.current.push({
      type: "scroll",
      timestamp: Date.now(),
      data: { deltaY },
    });
    
    analyzePatterns();
  }, [enabled, analyzePatterns]);

  // Inactivity check
  const checkInactivity = useCallback(() => {
    if (!enabled) return;
    
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;
    
    if (timeSinceLastActivity >= inactivityThresholdMs) {
      recordViolation("PROLONGED_INACTIVITY", {
        inactivityMs: timeSinceLastActivity,
        inactivityMinutes: Math.round(timeSinceLastActivity / 60000),
      });
      // Reset last activity to avoid duplicate violations
      lastActivityRef.current = now;
    }
  }, [enabled, inactivityThresholdMs, recordViolation]);

  // Store callbacks in refs to avoid dependency issues
  const handleMouseMoveRef = useRef(handleMouseMove);
  const handleClickRef = useRef(handleClick);
  const handleKeyDownRef = useRef(handleKeyDown);
  const handlePasteRef = useRef(handlePaste);
  const handleInputRef = useRef(handleInput);
  const handleScrollRef = useRef(handleScroll);
  const checkInactivityRef = useRef(checkInactivity);
  const analyzePatternsRef = useRef(analyzePatterns);

  // Update refs when callbacks change
  useEffect(() => {
    handleMouseMoveRef.current = handleMouseMove;
    handleClickRef.current = handleClick;
    handleKeyDownRef.current = handleKeyDown;
    handlePasteRef.current = handlePaste;
    handleInputRef.current = handleInput;
    handleScrollRef.current = handleScroll;
    checkInactivityRef.current = checkInactivity;
    analyzePatternsRef.current = analyzePatterns;
  }, [handleMouseMove, handleClick, handleKeyDown, handlePaste, handleInput, handleScroll, checkInactivity, analyzePatterns]);

  useEffect(() => {
    // Skip if userId or assessmentId are not provided, or if disabled
    if (!userId || !assessmentId || !enabled) {
      return;
    }

    // Wrapper functions that use refs
    const mouseMoveWrapper = (e: MouseEvent) => handleMouseMoveRef.current(e);
    const clickWrapper = (e: MouseEvent) => handleClickRef.current(e);
    const keyDownWrapper = (e: KeyboardEvent) => handleKeyDownRef.current(e);
    const pasteWrapper = (e: ClipboardEvent) => handlePasteRef.current(e);
    const inputWrapper = (e: Event) => handleInputRef.current(e);
    const scrollWrapper = (e: Event) => handleScrollRef.current(e);
    const inactivityWrapper = () => checkInactivityRef.current();
    const patternsWrapper = () => analyzePatternsRef.current();

    // Attach event listeners
    document.addEventListener("mousemove", mouseMoveWrapper, { passive: true });
    document.addEventListener("click", clickWrapper, { passive: true });
    document.addEventListener("keydown", keyDownWrapper, { passive: true });
    document.addEventListener("paste", pasteWrapper, { passive: true });
    document.addEventListener("input", inputWrapper, { passive: true, capture: true });
    window.addEventListener("scroll", scrollWrapper, { passive: true });
    document.addEventListener("wheel", scrollWrapper, { passive: true });

    // Start inactivity monitoring
    inactivityCheckRef.current = setInterval(inactivityWrapper, 60000); // Check every minute

    // Periodic pattern analysis (every 5 seconds)
    const patternAnalysisInterval = setInterval(patternsWrapper, 5000);

    console.log("[ActivityPatternProctor] Monitoring started for assessment:", assessmentId);

    // Cleanup on unmount
    return () => {
      document.removeEventListener("mousemove", mouseMoveWrapper);
      document.removeEventListener("click", clickWrapper);
      document.removeEventListener("keydown", keyDownWrapper);
      document.removeEventListener("paste", pasteWrapper);
      document.removeEventListener("input", inputWrapper, { capture: true });
      window.removeEventListener("scroll", scrollWrapper);
      document.removeEventListener("wheel", scrollWrapper);

      if (inactivityCheckRef.current) {
        clearInterval(inactivityCheckRef.current);
      }
      clearInterval(patternAnalysisInterval);

      console.log("[ActivityPatternProctor] Monitoring stopped");
    };
  }, [userId, assessmentId, enabled]);

  // Return utilities for the component
  return {
    getViolations: () => [...violationsRef.current],
    getViolationCount: () => violationsRef.current.length,
    recordCustomViolation: recordViolation,
    getActivityStats: () => {
      const now = Date.now();
      const recentEvents = eventHistoryRef.current.filter(
        (e) => now - e.timestamp < 60000 // Last minute
      );
      return {
        totalEvents: recentEvents.length,
        clicks: recentEvents.filter((e) => e.type === "click").length,
        keydowns: recentEvents.filter((e) => e.type === "keydown").length,
        mousemoves: recentEvents.filter((e) => e.type === "mousemove").length,
        scrolls: recentEvents.filter((e) => e.type === "scroll").length,
        timeSinceLastActivity: now - lastActivityRef.current,
      };
    },
  };
}

export type { ActivityPatternViolation, ActivityPatternProctorOptions };
