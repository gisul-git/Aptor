import { useState, useEffect } from "react";
import { CustomMCQAssessment } from "../../types/custom-mcq";

interface Station1Props {
  assessmentData: Partial<CustomMCQAssessment>;
  updateAssessmentData: (updates: Partial<CustomMCQAssessment>) => void;
}

export default function Station1AssessmentInfo({ assessmentData, updateAssessmentData }: Station1Props) {
  const [title, setTitle] = useState(assessmentData.title || "");
  const [description, setDescription] = useState(assessmentData.description || "");

  useEffect(() => {
    if (title !== assessmentData.title || description !== assessmentData.description) {
      updateAssessmentData({ title, description });
    }
  }, [title, description]);

  return (
    <div>
      <h2 style={{ marginBottom: "1.5rem", color: "#1E5A3B" }}>📋 Assessment Information</h2>
      <p style={{ marginBottom: "2rem", color: "#2D7A52" }}>
        Provide basic information about your assessment.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <label
            htmlFor="title"
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontWeight: 600,
              color: "#1E5A3B",
            }}
          >
            Assessment Title <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter assessment title"
            required
            style={{
              width: "100%",
              padding: "0.75rem",
              border: "1px solid #A8E8BC",
              borderRadius: "0.5rem",
              fontSize: "1rem",
              fontFamily: "inherit",
            }}
          />
        </div>

        <div>
          <label
            htmlFor="description"
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontWeight: 600,
              color: "#1E5A3B",
            }}
          >
            Description (Optional)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter assessment description"
            rows={4}
            style={{
              width: "100%",
              padding: "0.75rem",
              border: "1px solid #A8E8BC",
              borderRadius: "0.5rem",
              fontSize: "1rem",
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
        </div>
      </div>
    </div>
  );
}

