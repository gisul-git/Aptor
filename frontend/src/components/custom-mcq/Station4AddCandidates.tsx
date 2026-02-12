import { useState, useRef } from "react";
import { CustomMCQAssessment, Candidate } from "../../types/custom-mcq";
import { customMCQApi } from "../../lib/custom-mcq/api";

interface Station4Props {
  assessmentData: Partial<CustomMCQAssessment>;
  updateAssessmentData: (updates: Partial<CustomMCQAssessment>) => void;
}

export default function Station4AddCandidates({ assessmentData, updateAssessmentData }: Station4Props) {
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const candidates = assessmentData.candidates || [];
  const accessMode = assessmentData.accessMode || "private";

  const handleAddCandidate = () => {
    if (!manualName.trim() || !manualEmail.trim()) {
      alert("Please enter both name and email");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(manualEmail)) {
      alert("Please enter a valid email address");
      return;
    }

    // Check for duplicate email
    if (candidates.some((c) => c.email.toLowerCase() === manualEmail.toLowerCase())) {
      alert("A candidate with this email already exists");
      return;
    }

    const newCandidates = [...candidates, { name: manualName.trim(), email: manualEmail.trim().toLowerCase() }];
    updateAssessmentData({ candidates: newCandidates });
    setManualName("");
    setManualEmail("");
  };

  const handleRemoveCandidate = (email: string) => {
    const newCandidates = candidates.filter((c) => c.email !== email);
    updateAssessmentData({ candidates: newCandidates });
  };

  // Helper function to parse CSV line properly handling quoted fields
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote inside quoted field
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    
    // Add last field
    result.push(current.trim());
    return result;
  };

  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true);

      // Read CSV file
      let text = await file.text();
      
      // Remove BOM (Byte Order Mark) if present (common in Excel exports)
      if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
      }
      
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      
      if (lines.length < 2) {
        alert("CSV file must have at least a header and one data row");
        return;
      }

      // Parse CSV header properly handling quoted fields
      const rawHeaders = parseCSVLine(lines[0]);
      const headers = rawHeaders.map((h) => {
        // Remove surrounding quotes if present and clean up
        let cleaned = h.replace(/^["']|["']$/g, '').trim();
        // Remove any BOM or special characters
        cleaned = cleaned.replace(/^\uFEFF/, '');
        // Handle extra spaces and normalize
        cleaned = cleaned.toLowerCase().replace(/\s+/g, ' ').trim();
        return cleaned;
      });
      
      // Try to find name and email columns (flexible matching)
      const nameIndex = headers.findIndex((h) => {
        const normalized = h.toLowerCase().trim();
        return normalized === "name" || normalized === "candidate name" || normalized === "full name" || normalized === "student name";
      });
      
      const emailIndex = headers.findIndex((h) => {
        const normalized = h.toLowerCase().trim();
        return normalized === "email" || normalized === "email address" || normalized === "e-mail" || normalized === "email id";
      });

      if (nameIndex === -1 || emailIndex === -1) {
        const foundColumns = headers.length > 0 ? headers.join(', ') : 'none detected';
        alert(`CSV must have 'name' and 'email' columns.\n\nFound columns: ${foundColumns}\n\nPlease ensure your CSV has a header row with 'name' and 'email' columns (case-insensitive).`);
        console.error("CSV parsing error - Headers found:", headers);
        console.error("Raw first line:", lines[0]);
        return;
      }

      const newCandidates: Candidate[] = [];
      const existingEmails = new Set(candidates.map((c) => c.email.toLowerCase()));

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]).map((v) => {
          // Remove surrounding quotes if present
          return v.replace(/^"|"$/g, '').trim();
        });
        
        const name = values[nameIndex];
        const email = values[emailIndex]?.toLowerCase();

        if (name && email) {
          // Validate email
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailRegex.test(email) && !existingEmails.has(email)) {
            newCandidates.push({ name, email });
            existingEmails.add(email);
          }
        }
      }

      if (newCandidates.length === 0) {
        alert("No valid candidates found in CSV file");
        return;
      }

      updateAssessmentData({ candidates: [...candidates, ...newCandidates] });
      alert(`Successfully added ${newCandidates.length} candidates`);
    } catch (err: any) {
      alert(err.message || "Failed to upload CSV file");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDownloadSampleCSV = () => {
    // Create sample CSV content
    const sampleData = [
      ["name", "email"],
      ["John Doe", "john.doe@example.com"],
      ["Jane Smith", "jane.smith@example.com"],
      ["Robert Johnson", "robert.johnson@example.com"],
    ];

    // Convert to CSV format
    const csvContent = sampleData.map(row => 
      row.map(cell => `"${cell}"`).join(",")
    ).join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", "sample_candidates.csv");
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (accessMode === "public") {
    return (
      <div>
        <h2 style={{ marginBottom: "1.5rem", color: "#1E5A3B" }}>👥 Add Candidates</h2>
        <p style={{ marginBottom: "2rem", color: "#2D7A52" }}>
          Since you selected <strong>Public</strong> access mode, anyone with the assessment link can take the test.
          You can skip adding candidates manually, or add them for reference.
        </p>
        <div style={{ padding: "1.5rem", backgroundColor: "#E8FAF0", borderRadius: "0.5rem", border: "1px solid #A8E8BC" }}>
          <p style={{ color: "#2D7A52", margin: 0 }}>
            <strong>Note:</strong> In public mode, candidates are not restricted. You can still add candidates below for your reference.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: "1.5rem", color: "#1E5A3B" }}>👥 Add Candidates</h2>
      <p style={{ marginBottom: "2rem", color: "#2D7A52" }}>
        Add candidates who can take this assessment. You can add them manually or upload a CSV file.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        {/* Manual Entry */}
        <div style={{ padding: "1.5rem", border: "1px solid #A8E8BC", borderRadius: "0.5rem" }}>
          <h3 style={{ marginBottom: "1rem", color: "#1E5A3B" }}>Add Candidate Manually</h3>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Candidate Name"
              style={{ flex: 1, minWidth: "200px", padding: "0.75rem", border: "1px solid #A8E8BC", borderRadius: "0.5rem" }}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleAddCandidate();
                }
              }}
            />
            <input
              type="email"
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              placeholder="Candidate Email"
              style={{ flex: 1, minWidth: "200px", padding: "0.75rem", border: "1px solid #A8E8BC", borderRadius: "0.5rem" }}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleAddCandidate();
                }
              }}
            />
            <button type="button" onClick={handleAddCandidate} className="btn-primary">
              Add Candidate
            </button>
          </div>
        </div>

        {/* Bulk Upload */}
        <div style={{ padding: "1.5rem", border: "1px solid #A8E8BC", borderRadius: "0.5rem" }}>
          <h3 style={{ marginBottom: "1rem", color: "#1E5A3B" }}>Bulk Upload from CSV</h3>
          <p style={{ marginBottom: "1rem", color: "#2D7A52", fontSize: "0.875rem" }}>
            Upload a CSV file with columns: <strong>name, email</strong>
            <br />
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
              Note: If you have an Excel file, please export it as CSV format first (File → Save As → CSV)
            </span>
          </p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-primary"
            >
              {uploading ? "Uploading..." : "📤 Upload CSV File"}
            </button>
            <button
              type="button"
              onClick={handleDownloadSampleCSV}
              className="btn-secondary"
              style={{
                padding: "0.75rem 1.5rem",
                border: "1px solid #A8E8BC",
                backgroundColor: "#ffffff",
                color: "#2D7A52",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              📥 Download Sample CSV
            </button>
          </div>
        </div>

        {/* Candidates List */}
        <div>
          <h3 style={{ marginBottom: "1rem", color: "#1E5A3B" }}>
            Candidates ({candidates.length})
          </h3>
          {candidates.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#4A9A6A", backgroundColor: "#E8FAF0", borderRadius: "0.5rem" }}>
              No candidates added yet. Add candidates manually or upload a CSV file.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {candidates.map((candidate, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "1rem",
                    backgroundColor: "#ffffff",
                    border: "1px solid #A8E8BC",
                    borderRadius: "0.5rem",
                  }}
                >
                  <div>
                    <strong style={{ color: "#1E5A3B" }}>{candidate.name}</strong>
                    <span style={{ color: "#2D7A52", marginLeft: "1rem" }}>{candidate.email}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCandidate(candidate.email)}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: "#ef4444",
                      color: "#fff",
                      border: "none",
                      borderRadius: "0.25rem",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

