import { useEffect } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { requireAuth } from "../../../lib/auth";

export default function ConfigureTopicsPage() {
  const router = useRouter();
  const { id } = router.query;

  // Redirect to create-new page with the assessment ID as query parameter
  useEffect(() => {
    if (id && typeof id === 'string') {
      router.replace(`/assessments/create-new?id=${id}`);
    }
  }, [id, router]);
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "#f1dcba" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#64748b" }}>Redirecting to assessment editor...</p>
      </div>
    </div>
  );
}

// Server-side authentication check
export const getServerSideProps: GetServerSideProps = requireAuth;

