/**
 * Assessments List Component
 * Displays the grid of assessment cards
 */

import DashboardCard from './DashboardCard';
import type { Assessment } from '@/hooks/useDashboardAssessments';
import type { AssessmentType } from '@/utils/cardConfig';

interface AssessmentsListProps {
  assessments: Assessment[];
  openMenuId: string | null;
  onMenuToggle: (id: string) => void;
  onPause: (id: string, e: React.MouseEvent) => void;
  onResume: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, title: string, type?: AssessmentType) => void;
  onClone: (id: string, title: string) => void;
}

export default function AssessmentsList({
  assessments,
  openMenuId,
  onMenuToggle,
  onPause,
  onResume,
  onDelete,
  onClone,
}: AssessmentsListProps) {
  if (assessments.length === 0) {
    return (
      <div className="card">
        <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
          <div
            style={{
              width: "80px",
              height: "80px",
              margin: "0 auto 1.5rem",
              backgroundColor: "#E8FAF0",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2.5rem",
            }}
          >
            📋
          </div>
          <h2 style={{ color: "#1a1625", marginBottom: "1rem", fontSize: "1.5rem" }}>
            No assessments yet
          </h2>
          <p style={{ color: "#2D7A52", marginBottom: "2rem", maxWidth: "500px", margin: "0 auto 2rem" }}>
            Create your first assessment to get started with AI-powered topic and question
            generation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.5rem", color: "#1a1625", fontWeight: 700 }}>
          Your Assessments
        </h2>
        <span
          className="badge badge-mint"
          style={{ fontSize: "0.875rem", padding: "0.5rem 1rem" }}
        >
          {assessments.length} Total
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
          gap: "1rem",
        }}
      >
        {assessments.map((assessment) => {
          return (
            <DashboardCard
              key={assessment.id}
              {...assessment}
              type={assessment.type || 'assessment'}
              isMenuOpen={openMenuId === assessment.id}
              onMenuToggle={() => onMenuToggle(assessment.id)}
              onPause={onPause}
              onResume={onResume}
              onDelete={onDelete}
              onClone={onClone}
            />
          );
        })}
      </div>
    </div>
  );
}

