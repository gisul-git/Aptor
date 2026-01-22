import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { requireAuth } from "../../../lib/auth";
import { useAssessment } from "@/hooks/api/useAssessments";

export default function AssessmentDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const hasRedirectedRef = useRef(false);
  
  // Use React Query hook to fetch assessment
  const { data: assessment, isLoading, error } = useAssessment(
    typeof id === 'string' ? id : undefined
  );

  useEffect(() => {
    // Prevent multiple redirects
    if (hasRedirectedRef.current) return;
    
    // Wait for data to load
    if (isLoading) return;
    
    // If we have an assessment, redirect based on status
    if (assessment) {
      hasRedirectedRef.current = true;
      const status = assessment.status || 'draft';
      
      // Redirect based on status
      if (status === 'draft') {
        router.replace(`/assessments/create-new?id=${id}`);
      } else {
        // Only redirect to dashboard if not already there
        const currentPath = router.asPath || router.pathname;
        if (currentPath !== '/dashboard') {
          router.replace('/dashboard');
        }
      }
    } else if (error || (!isLoading && !assessment)) {
      // If assessment not found or error, redirect to dashboard
      hasRedirectedRef.current = true;
      const currentPath = router.asPath || router.pathname;
      if (currentPath !== '/dashboard') {
        router.replace('/dashboard');
      }
    }
  }, [assessment, isLoading, error, id, router]);

  return (
    <div className="container">
      <div className="card">
        <p style={{ textAlign: "center", color: "#475569" }}>Redirecting...</p>
      </div>
    </div>
  );
}

// Server-side authentication check
export const getServerSideProps: GetServerSideProps = requireAuth;
