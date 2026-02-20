export interface ActivityLog {
  id: string
  type: "candidate" | "admin" | "system" | "security"
  action: string
  description: string
  userId?: string
  userName?: string
  candidateId?: string
  candidateName?: string
  assessmentId?: string
  assessmentName?: string
  timestamp: string
  metadata?: Record<string, unknown>
  severity?: "info" | "warning" | "error" | "success"
}

