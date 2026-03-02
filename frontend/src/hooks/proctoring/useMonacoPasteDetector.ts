import { useEffect, useRef, useCallback } from "react";

interface MonacoPasteDetectorOptions {
  userId: string;
  assessmentId: string;
  onViolation?: (violation: MonacoPasteViolation) => void;
  // Configuration
  threshold?: number; // Minimum characters to trigger violation (default: 20)
  enabled?: boolean; // Enable/disable monitoring (default: true)
}

interface MonacoPasteViolation {
  eventType: "COPY_PASTE_CONTENT";
  timestamp: string;
  assessmentId: string;
  userId: string;
  metadata?: {
    pastedContent: string;
    contentLength: number;
    editorType?: string;
    language?: string;
  };
}

/**
 * Hook to detect copy-paste in Monaco Editor and save the actual content
 * 
 * Usage:
 *   const { attachToMonacoEditor } = useMonacoPasteDetector({
 *     userId: '...',
 *     assessmentId: '...',
 *     onViolation: (violation) => { ... }
 *   });
 * 
 *   <MonacoEditor
 *     onMount={(editor) => attachToMonacoEditor(editor)}
 *     ...
 *   />
 */
export function useMonacoPasteDetector({
  userId,
  assessmentId,
  onViolation,
  threshold = 20,
  enabled = true,
}: MonacoPasteDetectorOptions) {
  const violationsRef = useRef<MonacoPasteViolation[]>([]);
  const editorRefs = useRef<Set<any>>(new Set());
  const previousContentRef = useRef<Map<any, string>>(new Map());

  // Function to record a violation
  const recordViolation = useCallback(async (
    pastedContent: string,
    editor: any,
    editorType: string = "monaco"
  ) => {
    const violation: MonacoPasteViolation = {
      eventType: "COPY_PASTE_CONTENT",
      timestamp: new Date().toISOString(),
      assessmentId,
      userId,
      metadata: {
        pastedContent,
        contentLength: pastedContent.length,
        editorType,
        language: editor?.getModel()?.getLanguageId() || undefined,
      },
    };

    // Log locally
    violationsRef.current.push(violation);
    console.log(`[MonacoPasteDetector] COPY_PASTE_CONTENT violation recorded:`, {
      contentLength: pastedContent.length,
      preview: pastedContent.substring(0, 100),
    });

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
        console.error("[MonacoPasteDetector] Failed to record violation on server:", response.statusText);
      } else {
        console.log("[MonacoPasteDetector] Violation sent to server successfully");
      }
    } catch (error) {
      console.error("[MonacoPasteDetector] Error sending violation to server:", error);
    }
  }, [assessmentId, userId, onViolation]);

  // Detect paste by monitoring content changes
  const detectPaste = useCallback((editor: any) => {
    if (!enabled || !editor) return;

    const model = editor.getModel();
    if (!model) return;

    // Get current content
    const currentContent = model.getValue() || "";
    const previousContent = previousContentRef.current.get(editor) || "";

    // Calculate content change
    const contentDiff = currentContent.length - previousContent.length;

    // If significant content was added suddenly (likely paste)
    if (contentDiff >= threshold) {
      // Extract the new content (approximate - get the difference)
      // For more accurate detection, we'll use the paste event handler
      const newContent = currentContent.substring(previousContent.length);
      
      // Only record if it looks like a paste (significant content added at once)
      if (newContent.length >= threshold) {
        recordViolation(newContent, editor, "monaco");
      }
    }

    // Update previous content
    previousContentRef.current.set(editor, currentContent);
  }, [enabled, threshold, recordViolation]);

  // Attach paste detection to Monaco editor
  const attachToMonacoEditor = useCallback((editor: any) => {
    if (!enabled || !editor) return;

    // Skip if already attached
    if (editorRefs.current.has(editor)) {
      return;
    }

    editorRefs.current.add(editor);
    const model = editor.getModel();
    
    if (!model) {
      console.warn("[MonacoPasteDetector] Editor model not available");
      return;
    }

    // Initialize previous content
    previousContentRef.current.set(editor, model.getValue() || "");

    // Method 1: Listen to DOM paste event on editor container (capture phase to catch before Monaco processes it)
    const editorContainer = editor.getContainerDomNode();
    let lastPasteTime = 0;
    let lastPastedText = '';
    
    const pasteHandler = (e: ClipboardEvent) => {
      if (!enabled) return;

      // Only process if paste is happening in the Monaco editor container
      const target = e.target as HTMLElement;
      if (!editorContainer.contains(target) && target !== editorContainer) {
        return; // Paste is not in Monaco editor
      }

      try {
        // Get clipboard content
        const pastedText = e.clipboardData?.getData('text/plain') || '';
        
        console.log('[MonacoPasteDetector] DOM paste event detected in Monaco editor:', {
          length: pastedText.length,
          preview: pastedText.substring(0, 50),
          hasClipboardData: !!e.clipboardData,
          target: target.tagName,
        });
        
        if (pastedText.length >= threshold) {
          lastPasteTime = Date.now();
          lastPastedText = pastedText;
          
          console.log('[MonacoPasteDetector] ✅ Large paste detected, recording violation:', {
            length: pastedText.length,
            preview: pastedText.substring(0, 50),
          });

          // Record violation with actual pasted content
          recordViolation(pastedText, editor, "monaco");

          // Update previous content after paste
          setTimeout(() => {
            const currentContent = model.getValue() || "";
            previousContentRef.current.set(editor, currentContent);
          }, 200);
        } else {
          console.log('[MonacoPasteDetector] Paste too small, ignoring:', pastedText.length, 'chars (threshold:', threshold, ')');
        }
      } catch (err) {
        console.warn('[MonacoPasteDetector] Error reading clipboard:', err);
      }
    };

    // Use capture phase to catch paste before Monaco processes it
    editorContainer.addEventListener('paste', pasteHandler, true);
    // Also listen on window as fallback (but check if target is Monaco editor)
    const windowPasteHandler = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (editorContainer.contains(target) || target === editorContainer) {
        pasteHandler(e);
      }
    };
    window.addEventListener('paste', windowPasteHandler, true);

    // Method 2: Listen to model content changes (fallback - detects rapid content insertion)
    const contentChangeDisposable = model.onDidChangeContent((e: any) => {
      if (!enabled) return;

      // Check if this is a significant change (likely paste)
      const changes = e.changes || [];
      let totalInsertedLength = 0;
      let insertedText = "";

      for (const change of changes) {
        if (change.text) {
          totalInsertedLength += change.text.length;
          insertedText += change.text;
        }
      }

      // If we just detected a paste via DOM event, skip this (avoid duplicate)
      const timeSincePaste = Date.now() - lastPasteTime;
      if (timeSincePaste < 500 && lastPastedText && insertedText.includes(lastPastedText)) {
        console.log('[MonacoPasteDetector] Skipping content change - already detected via paste event');
        return;
      }

      // If significant content was inserted at once (likely paste)
      if (totalInsertedLength >= threshold) {
        console.log('[MonacoPasteDetector] Large content change detected in Monaco editor:', {
          length: totalInsertedLength,
          preview: insertedText.substring(0, 50),
          changes: changes.length,
        });

        // Record violation
        recordViolation(insertedText, editor, "monaco");

        // Update previous content
        const currentContent = model.getValue() || "";
        previousContentRef.current.set(editor, currentContent);
      } else {
        // Update previous content for small changes
        const currentContent = model.getValue() || "";
        previousContentRef.current.set(editor, currentContent);
      }
    });

    console.log("[MonacoPasteDetector] Paste detection attached to Monaco editor", {
      container: !!editorContainer,
      model: !!model,
      enabled,
      threshold,
    });

    // Cleanup function
    return () => {
      editorRefs.current.delete(editor);
      previousContentRef.current.delete(editor);
      contentChangeDisposable.dispose();
      editorContainer.removeEventListener('paste', pasteHandler, true);
      window.removeEventListener('paste', windowPasteHandler, true);
      console.log("[MonacoPasteDetector] Paste detection removed from Monaco editor");
    };
  }, [enabled, threshold, recordViolation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      editorRefs.current.clear();
      previousContentRef.current.clear();
    };
  }, []);

  return {
    attachToMonacoEditor,
    getViolations: () => [...violationsRef.current],
    getViolationCount: () => violationsRef.current.length,
  };
}

export type { MonacoPasteViolation, MonacoPasteDetectorOptions };
