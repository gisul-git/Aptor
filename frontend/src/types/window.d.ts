/**
 * Window object extensions for Live Proctoring
 * 
 * These streams are captured during pre-check and identity verification
 * and reused throughout the assessment to prevent permission re-prompts.
 */

declare global {
  interface Window {
    /**
     * Camera stream captured in pre-check.
     * Reused by AI Proctoring and Live Proctoring.
     * NEVER stop these tracks manually.
     */
    __cameraStream?: MediaStream;

    /**
     * Screen share stream captured in identity verification.
     * Reused by Live Proctoring.
     * NEVER stop these tracks manually.
     */
    __screenStream?: MediaStream;
  }
}

export {};
