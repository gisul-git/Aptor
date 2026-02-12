import { useState } from "react";
import { Candidate } from "../../types/custom-mcq";

interface EmailInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidates: Candidate[];
  assessmentTitle: string;
  assessmentUrl: string;
  onSend: (template: {
    subject: string;
    message: string;
    footer: string;
    sentBy: string;
  }) => Promise<void>;
  invitationsSent?: boolean;
  hasNewCandidates?: boolean;
}

export default function EmailInvitationModal({
  isOpen,
  onClose,
  candidates,
  assessmentTitle,
  assessmentUrl,
  onSend,
  invitationsSent = false,
  hasNewCandidates = false,
}: EmailInvitationModalProps) {
  const [subject, setSubject] = useState(`Assessment Invitation - ${assessmentTitle}`);
  const [message, setMessage] = useState(
    `Dear {{candidate_name}},\n\nYou have been invited to take the assessment: ${assessmentTitle}.\n\nPlease click the button below to start the assessment.`
  );
  const [footer, setFooter] = useState("");
  const [sentBy, setSentBy] = useState("AI Assessment Platform");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSend = async () => {
    try {
      setSending(true);
      setError(null);
      await onSend({
        subject,
        message,
        footer,
        sentBy,
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        // Reset to defaults
        setSubject(`Assessment Invitation - ${assessmentTitle}`);
        setMessage(
          `Dear {{candidate_name}},\n\nYou have been invited to take the assessment: ${assessmentTitle}.\n\nPlease click the button below to start the assessment.`
        );
        setFooter("");
        setSentBy("AI Assessment Platform");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to send invitations");
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (!sending) {
      onClose();
      setError(null);
      setSuccess(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "2rem",
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "0.75rem",
          padding: "2rem",
          maxWidth: "700px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ color: "#1E5A3B", margin: 0 }}>Send Invitation Email</h2>
          <button
            onClick={handleClose}
            disabled={sending}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: sending ? "not-allowed" : "pointer",
              color: "#64748b",
              padding: "0.25rem 0.5rem",
            }}
          >
            ×
          </button>
        </div>

        {success && (
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#dcfce7",
              border: "1px solid #10b981",
              borderRadius: "0.5rem",
              color: "#166534",
              marginBottom: "1.5rem",
            }}
          >
            ✓ Invitations sent successfully!
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#fee2e2",
              border: "1px solid #ef4444",
              borderRadius: "0.5rem",
              color: "#991b1b",
              marginBottom: "1.5rem",
            }}
          >
            {error}
          </div>
        )}


        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1E5A3B" }}>
              Email Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #A8E8BC",
                borderRadius: "0.5rem",
                fontSize: "1rem",
              }}
              placeholder="Assessment Invitation - {{assessment_title}}"
            />
            <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
              Available placeholders: {"{"}
              {"{"}assessment_title{"}"}
              {"}"}
            </p>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1E5A3B" }}>
              Email Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
              rows={8}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #A8E8BC",
                borderRadius: "0.5rem",
                fontSize: "1rem",
                fontFamily: "inherit",
                resize: "vertical",
              }}
              placeholder="Dear {{candidate_name}},&#10;&#10;You have been invited..."
            />
            <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
              Available placeholders: {"{"}
              {"{"}candidate_name{"}"}
              {"}"}, {"{"}
              {"{"}candidate_email{"}"}
              {"}"}, {"{"}
              {"{"}assessment_title{"}"}
              {"}"}
            </p>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1E5A3B" }}>
              Footer (Optional)
            </label>
            <textarea
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              disabled={sending}
              rows={3}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #A8E8BC",
                borderRadius: "0.5rem",
                fontSize: "1rem",
                fontFamily: "inherit",
              }}
              placeholder="Additional footer text..."
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1E5A3B" }}>
              Sent By
            </label>
            <input
              type="text"
              value={sentBy}
              onChange={(e) => setSentBy(e.target.value)}
              disabled={sending}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #A8E8BC",
                borderRadius: "0.5rem",
                fontSize: "1rem",
              }}
              placeholder="AI Assessment Platform"
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={handleClose}
            disabled={sending}
            className="btn-secondary"
            style={{
              padding: "0.75rem 1.5rem",
              opacity: sending ? 0.5 : 1,
              cursor: sending ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || candidates.length === 0 || (invitationsSent && !hasNewCandidates)}
            className="btn-primary"
            style={{
              padding: "0.75rem 1.5rem",
              opacity: sending || candidates.length === 0 || (invitationsSent && !hasNewCandidates) ? 0.5 : 1,
              cursor: sending || candidates.length === 0 || (invitationsSent && !hasNewCandidates) ? "not-allowed" : "pointer",
              backgroundColor: invitationsSent && !hasNewCandidates ? "#94a3b8" : undefined,
            }}
            title={invitationsSent && !hasNewCandidates ? "Invitations already sent. Add new candidates to enable." : ""}
          >
            {sending 
              ? "Sending..." 
              : invitationsSent && !hasNewCandidates 
                ? `✓ Invitations Already Sent` 
                : `Send to ${candidates.length} Candidate(s)`
            }
          </button>
        </div>
      </div>
    </div>
  );
}

