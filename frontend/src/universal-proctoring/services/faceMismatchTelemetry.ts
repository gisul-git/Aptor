/**
 * Face Mismatch Telemetry Service
 * Logs face verification checks and batches them for analytics to measure accuracy improvement.
 */

export interface FaceVerificationLog {
  timestamp: number;
  similarityScore: number;
  threshold: number;
  frameQuality: number;
  referenceQuality: number;
  violationTriggered: boolean;
  candidateId: string;
  assessmentId: string;
}

class FaceMismatchTelemetry {
  private logs: FaceVerificationLog[] = [];
  private batchSize = 10;

  logVerification(data: FaceVerificationLog): void {
    this.logs.push(data);

    if (this.logs.length >= this.batchSize) {
      this.sendBatch();
    }
  }

  async sendBatch(): Promise<void> {
    if (this.logs.length === 0) return;

    const batch = [...this.logs];
    this.logs = [];

    try {
      await fetch("/api/analytics/face-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logs: batch }),
      });
    } catch (error) {
      console.error("[Face Verification Telemetry] Failed to send batch:", error);
      this.logs.unshift(...batch);
    }
  }

  getSessionStats(): {
    mean: number;
    min: number;
    max: number;
    violations: number;
    totalChecks: number;
  } | null {
    if (this.logs.length === 0) return null;

    const scores = this.logs.map((l) => l.similarityScore);
    return {
      mean: scores.reduce((a, b) => a + b, 0) / scores.length,
      min: Math.min(...scores),
      max: Math.max(...scores),
      violations: this.logs.filter((l) => l.violationTriggered).length,
      totalChecks: this.logs.length,
    };
  }

  async flush(): Promise<void> {
    if (this.logs.length > 0) {
      await this.sendBatch();
    }
  }
}

export const faceMismatchTelemetry = new FaceMismatchTelemetry();
