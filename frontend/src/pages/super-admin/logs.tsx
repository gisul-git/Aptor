import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { GetServerSideProps } from "next";
import Link from "next/link";
import fastApiClient from "../../lib/fastapi";

interface LogEntry {
  id: string;
  superAdminId: string;
  name: string;
  email: string;
  loginTime: string | null;
  logoutTime: string | null;
}

export default function SuperAdminLogsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session && (session as any).user?.role !== "super_admin") {
      router.push("/dashboard");
      return;
    }

    loadLogs();
  }, [session, router]);

  const loadLogs = async () => {
    try {
      const token = (session as any)?.backendToken;
      if (!token) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      const response = await fastApiClient.get("/api/v1/super-admin/logins", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setLogs(response.data?.data?.logs || []);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  if (!session || (session as any).user?.role !== "super_admin") {
    return null;
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
      <header
        style={{
          backgroundColor: "#fff",
          borderBottom: "1px solid #e5e7eb",
          padding: "1rem 2rem",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600 }}>Super Admin Logs</h1>
      </header>

      <div style={{ display: "flex", minHeight: "calc(100vh - 80px)" }}>
        <aside
          style={{
            width: "250px",
            backgroundColor: "#fff",
            borderRight: "1px solid #e5e7eb",
            padding: "1.5rem",
          }}
        >
          <nav style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Link href="/super-admin/dashboard" style={{ padding: "0.75rem", textDecoration: "none", color: "#1f2937" }}>
              Dashboard
            </Link>
            <Link href="/dashboard" style={{ padding: "0.75rem", textDecoration: "none", color: "#1f2937" }}>
              Create Assessment
            </Link>
            <Link
              href="/super-admin/logs"
              style={{
                padding: "0.75rem",
                textDecoration: "none",
                color: "#1f2937",
                backgroundColor: "#f3f4f6",
                borderRadius: "0.375rem",
                fontWeight: 500,
              }}
            >
              Super Admin Logs
            </Link>
            <Link href="/super-admin/super-admin-list" style={{ padding: "0.75rem", textDecoration: "none", color: "#1f2937" }}>
              Super Admin List
            </Link>
            <Link href="/super-admin/org-admin-logs" style={{ padding: "0.75rem", textDecoration: "none", color: "#1f2937" }}>
              Org Admin Logs
            </Link>
          </nav>
        </aside>

        <main style={{ flex: 1, padding: "2rem" }}>
          {loading ? (
            <div>Loading...</div>
          ) : error ? (
            <div style={{ color: "#ef4444" }}>{error}</div>
          ) : (
            <div>
              <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>Login/Logout Logs</h2>
              <div style={{ backgroundColor: "#fff", borderRadius: "0.5rem", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Name</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Email</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Login Time</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Logout Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
                          No logs found
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                          <td style={{ padding: "0.75rem" }}>{log.name}</td>
                          <td style={{ padding: "0.75rem" }}>{log.email}</td>
                          <td style={{ padding: "0.75rem" }}>{formatDate(log.loginTime)}</td>
                          <td style={{ padding: "0.75rem" }}>{formatDate(log.logoutTime)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { getServerSession } = await import("next-auth");
  const { authOptions } = await import("../api/auth/[...nextauth]");

  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session || (session as any).user?.role !== "super_admin") {
    return {
      redirect: {
        destination: "/dashboard",
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};

