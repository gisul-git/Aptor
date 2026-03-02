import { useState } from "react";
import { Candidate } from "../../types/custom-mcq";
import { 
  X, 
  Send, 
  Mail, 
  User, 
  Info, 
  CheckCircle2, 
  AlertCircle,
  Type,
  AlignLeft,
  FileText
} from "lucide-react";

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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
      <div 
        className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl border border-white/20 flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Fixed */}
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#C9F4D4] rounded-xl text-[#0A5F38]">
              <Mail size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Send Invitation Email</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Campaign Configuration</p>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            disabled={sending}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body: Scrollable */}
        <div className="p-8 overflow-y-auto grow space-y-6 custom-scrollbar">
          {success && (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 animate-in slide-in-from-top-2">
              <CheckCircle2 size={20} />
              <p className="text-sm font-bold">✓ Invitations sent successfully!</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 animate-in slide-in-from-top-2">
              <AlertCircle size={20} />
              <p className="text-sm font-bold">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            {/* Email Subject */}
            <div className="space-y-2 group">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 group-focus-within:text-[#0A5F38] transition-colors">
                <Type size={14} /> Email Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sending}
                className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-[#0A5F38] focus:bg-white outline-none transition-all font-bold text-slate-700"
                placeholder="Assessment Invitation - {{assessment_title}}"
              />
              <p className="text-[10px] text-slate-400 font-bold italic px-1 flex items-center gap-1">
                <Info size={10}/> Available placeholders: {"{{"}assessment_title{"}}"}
              </p>
            </div>

            {/* Email Message */}
            <div className="space-y-2 group">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 group-focus-within:text-[#0A5F38] transition-colors">
                <AlignLeft size={14} /> Email Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={sending}
                rows={6}
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-[#0A5F38] focus:bg-white outline-none transition-all resize-none font-medium text-slate-700 leading-relaxed shadow-inner"
                placeholder="Dear {{candidate_name}},&#10;&#10;You have been invited..."
              />
              <p className="text-[10px] text-slate-400 font-bold italic px-1 flex items-center gap-1">
                <Info size={10}/> Available placeholders: {"{{"}candidate_name{"}}"}, {"{{"}candidate_email{"}}"}, {"{{"}assessment_title{"}}"}
              </p>
            </div>

            {/* Footer Optional */}
            <div className="space-y-2 group">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 group-focus-within:text-[#0A5F38] transition-colors">
                <FileText size={14} /> Footer (Optional)
              </label>
              <textarea
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
                disabled={sending}
                rows={2}
                className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-[#0A5F38] focus:bg-white outline-none transition-all resize-none font-medium text-slate-600"
                placeholder="Additional footer text..."
              />
            </div>

            {/* Sent By */}
            <div className="space-y-2 group">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 group-focus-within:text-[#0A5F38] transition-colors">
                <User size={14} /> Sent By
              </label>
              <input
                type="text"
                value={sentBy}
                onChange={(e) => setSentBy(e.target.value)}
                disabled={sending}
                className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-[#0A5F38] focus:bg-white outline-none transition-all font-bold text-slate-700"
                placeholder="AI Assessment Platform"
              />
            </div>
          </div>
        </div>

        {/* Footer: Fixed */}
        <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3 shrink-0">
          <button 
            onClick={handleClose} 
            disabled={sending}
            className="px-8 py-4 bg-white border-2 border-slate-200 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all active:scale-95"
          >
            Cancel
          </button>
          <button 
            onClick={handleSend}
            disabled={sending || candidates.length === 0 || (invitationsSent && !hasNewCandidates)}
            className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl shadow-[#0A5F38]/10 active:scale-[0.98] ${
              invitationsSent && !hasNewCandidates 
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed border-2 border-slate-300 shadow-none' 
              : 'bg-[#0A5F38] text-white hover:bg-slate-900 border-2 border-transparent'
            }`}
            title={invitationsSent && !hasNewCandidates ? "Invitations already sent. Add new candidates to enable." : ""}
          >
            {sending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending...
              </>
            ) : invitationsSent && !hasNewCandidates ? (
              <>
                <CheckCircle2 size={16} /> Invitations Already Sent
              </>
            ) : (
              <>
                <Send size={16} /> Send to {candidates.length} Candidate{candidates.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}