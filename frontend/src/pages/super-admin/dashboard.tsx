import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession, signOut } from "next-auth/react";
import { GetServerSideProps } from "next";
import Link from "next/link";
import fastApiClient from "../../lib/fastapi";

interface DashboardPageProps {
  session: any;
}

export default function SuperAdminDashboardPage({ session: serverSession }: DashboardPageProps) {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  const activeSession = serverSession || session;
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is super_admin
    if (activeSession && (activeSession as any).user?.role !== "super_admin") {
      router.push("/dashboard");
      return;
    }

    // Load overview data
    loadOverview();
  }, [activeSession, router]);

  const loadOverview = async () => {
    try {
      const token = (activeSession as any)?.backendToken;
      if (!token) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      const response = await fastApiClient.get("/api/v1/super-admin/overview", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setOverview(response.data?.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Failed to load overview");
    } finally {
      setLoading(false);
    }
  };

  if (!activeSession || (activeSession as any).user?.role !== "super_admin") {
    return null; // Will redirect
  }

  const userName = (activeSession as any).user?.name || "Super Admin";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: "#fff",
          borderBottom: "1px solid #e5e7eb",
          padding: "1rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600 }}>Super Admin Dashboard</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ color: "#6b7280" }}>Signed in as Super Admin: {userName}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#ef4444",
              color: "#fff",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      <div style={{ display: "flex", minHeight: "calc(100vh - 80px)" }}>
        {/* Sidebar */}
        <aside
          style={{
            width: "250px",
            backgroundColor: "#fff",
            borderRight: "1px solid #e5e7eb",
            padding: "1.5rem",
          }}
        >
          <nav style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Link
              href="/super-admin/dashboard"
              style={{
                padding: "0.75rem",
                borderRadius: "0.375rem",
                textDecoration: "none",
                color: "#1f2937",
                backgroundColor: "#f3f4f6",
                fontWeight: 500,
              }}
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard?from=super-admin"
              style={{
                padding: "0.75rem",
                borderRadius: "0.375rem",
                textDecoration: "none",
                color: "#1f2937",
              }}
            >
              Create Assessment
            </Link>
            <Link
              href="/super-admin/logs"
              style={{
                padding: "0.75rem",
                borderRadius: "0.375rem",
                textDecoration: "none",
                color: "#1f2937",
              }}
            >
              Super Admin Logs
            </Link>
            <Link
              href="/super-admin/super-admin-list"
              style={{
                padding: "0.75rem",
                borderRadius: "0.375rem",
                textDecoration: "none",
                color: "#1f2937",
              }}
            >
              Super Admin List
            </Link>
            <Link
              href="/super-admin/org-admin-logs"
              style={{
                padding: "0.75rem",
                borderRadius: "0.375rem",
                textDecoration: "none",
                color: "#1f2937",
              }}
            >
              Org Admin Logs
            </Link>
            <Link
              href="/super-admin/request-demos"
              style={{
                padding: "0.75rem",
                borderRadius: "0.375rem",
                textDecoration: "none",
                color: "#1f2937",
              }}
            >
              Request Demos
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main style={{ flex: 1, padding: "2rem" }}>
          {loading ? (
            <div>Loading...</div>
          ) : error ? (
            <div style={{ color: "#ef4444" }}>{error}</div>
          ) : overview ? (
            <div>
              <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>Overview</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "1rem",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#fff",
                    padding: "1.5rem",
                    borderRadius: "0.5rem",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                >
                  <div style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Total Super Admins</div>
                  <div style={{ fontSize: "2rem", fontWeight: 600 }}>{overview.totalSuperAdmins || 0}</div>
                </div>
                <div
                  style={{
                    backgroundColor: "#fff",
                    padding: "1.5rem",
                    borderRadius: "0.5rem",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                >
                  <div style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Total Org Admins</div>
                  <div style={{ fontSize: "2rem", fontWeight: 600 }}>{overview.totalOrgAdmins || 0}</div>
                </div>
                <div
                  style={{
                    backgroundColor: "#fff",
                    padding: "1.5rem",
                    borderRadius: "0.5rem",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                >
                  <div style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Total Assessments</div>
                  <div style={{ fontSize: "2rem", fontWeight: 600 }}>{overview.totalAssessments || 0}</div>
                </div>
                <div
                  style={{
                    backgroundColor: "#fff",
                    padding: "1.5rem",
                    borderRadius: "0.5rem",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                >
                  <div style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Total Users</div>
                  <div style={{ fontSize: "2rem", fontWeight: 600 }}>{overview.totalUsers || 0}</div>
                </div>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { getServerSession } = await import("next-auth");
  const { authOptions } = await import("../api/auth/[...nextauth]");

  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return {
      redirect: {
        destination: "/auth/signin",
        permanent: false,
      },
    };
  }

  if ((session as any).user?.role !== "super_admin") {
    return {
      redirect: {
        destination: "/dashboard",
        permanent: false,
      },
    };
  }

  return {
    props: {
      session: JSON.parse(JSON.stringify(session)),
    },
  };
};

