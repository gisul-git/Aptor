import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { GetServerSideProps } from "next";
import Link from "next/link";
import fastApiClient from "../../lib/fastapi";

interface DemoRequest {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  phone: string;
  country: string;
  jobTitle: string;
  companySize: string;
  competencies: string[];
  whatsapp: boolean;
  privacyAgreed: boolean;
  marketingConsent: boolean;
  status: "pending" | "contacted" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

export default function RequestDemosPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [demoRequests, setDemoRequests] = useState<DemoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (session && (session as any).user?.role !== "super_admin") {
      router.push("/dashboard");
      return;
    }

    loadDemoRequests();
  }, [session, router]);

  const loadDemoRequests = async () => {
    try {
      const token = (session as any)?.backendToken;
      if (!token) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      const response = await fastApiClient.get("/api/v1/super-admin/demo-requests", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setDemoRequests(response.data?.data?.requests || []);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Failed to load demo requests");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId: string) => {
    try {
      setProcessingId(requestId);
      const token = (session as any)?.backendToken;
      if (!token) {
        setError("Not authenticated");
        return;
      }

      await fastApiClient.post(
        `/api/v1/super-admin/demo-requests/${requestId}/accept`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Reload requests
      await loadDemoRequests();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Failed to accept demo request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeny = async (requestId: string) => {
    try {
      setProcessingId(requestId);
      const token = (session as any)?.backendToken;
      if (!token) {
        setError("Not authenticated");
        return;
      }

      await fastApiClient.post(
        `/api/v1/super-admin/demo-requests/${requestId}/deny`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Reload requests
      await loadDemoRequests();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Failed to deny demo request");
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#f59e0b";
      case "contacted":
        return "#3b82f6";
      case "completed":
        return "#10b981";
      case "cancelled":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const formatDate = (dateString: string) => {
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
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600 }}>Request Demos</h1>
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
            <Link href="/super-admin/logs" style={{ padding: "0.75rem", textDecoration: "none", color: "#1f2937" }}>
              Super Admin Logs
            </Link>
            <Link href="/super-admin/super-admin-list" style={{ padding: "0.75rem", textDecoration: "none", color: "#1f2937" }}>
              Super Admin List
            </Link>
            <Link href="/super-admin/org-admin-logs" style={{ padding: "0.75rem", textDecoration: "none", color: "#1f2937" }}>
              Org Admin Logs
            </Link>
            <Link
              href="/super-admin/request-demos"
              style={{
                padding: "0.75rem",
                textDecoration: "none",
                color: "#1f2937",
                backgroundColor: "#f3f4f6",
                borderRadius: "0.375rem",
                fontWeight: 500,
              }}
            >
              Request Demos
            </Link>
          </nav>
        </aside>

        <main style={{ flex: 1, padding: "2rem" }}>
          {loading ? (
            <div>Loading...</div>
          ) : error ? (
            <div style={{ color: "#ef4444", marginBottom: "1rem" }}>{error}</div>
          ) : (
            <div>
              <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>All Demo Requests</h2>
              {demoRequests.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280", backgroundColor: "#fff", borderRadius: "0.5rem" }}>
                  No demo requests found
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  {demoRequests.map((request) => (
                    <div
                      key={request._id}
                      style={{
                        backgroundColor: "#fff",
                        padding: "1.5rem",
                        borderRadius: "0.5rem",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1rem" }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>
                            {request.firstName} {request.lastName}
                          </h3>
                          <p style={{ margin: "0.25rem 0", color: "#6b7280", fontSize: "0.875rem" }}>{request.email}</p>
                          <p style={{ margin: "0.25rem 0", color: "#6b7280", fontSize: "0.875rem" }}>{request.phone}</p>
                        </div>
                        <div
                          style={{
                            padding: "0.25rem 0.75rem",
                            borderRadius: "0.375rem",
                            backgroundColor: getStatusColor(request.status) + "20",
                            color: getStatusColor(request.status),
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            textTransform: "capitalize",
                          }}
                        >
                          {request.status}
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
                        <div>
                          <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>Company</div>
                          <div style={{ fontWeight: 500 }}>{request.company}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>Job Title</div>
                          <div style={{ fontWeight: 500 }}>{request.jobTitle}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>Company Size</div>
                          <div style={{ fontWeight: 500 }}>{request.companySize}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>Country</div>
                          <div style={{ fontWeight: 500 }}>{request.country}</div>
                        </div>
                      </div>

                      {request.competencies && request.competencies.length > 0 && (
                        <div style={{ marginBottom: "1rem" }}>
                          <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.5rem" }}>Competencies</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                            {request.competencies.map((comp, idx) => (
                              <span
                                key={idx}
                                style={{
                                  padding: "0.25rem 0.75rem",
                                  backgroundColor: "#f3f4f6",
                                  borderRadius: "0.375rem",
                                  fontSize: "0.875rem",
                                }}
                              >
                                {comp}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #e5e7eb" }}>
                        <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                          Requested: {formatDate(request.createdAt)}
                        </div>
                        {request.status === "pending" && (
                          <div style={{ display: "flex", gap: "0.75rem" }}>
                            <button
                              onClick={() => handleAccept(request._id)}
                              disabled={processingId === request._id}
                              style={{
                                padding: "0.5rem 1rem",
                                backgroundColor: "#10b981",
                                color: "#fff",
                                border: "none",
                                borderRadius: "0.375rem",
                                cursor: processingId === request._id ? "not-allowed" : "pointer",
                                opacity: processingId === request._id ? 0.6 : 1,
                                fontWeight: 500,
                              }}
                            >
                              {processingId === request._id ? "Processing..." : "Accept"}
                            </button>
                            <button
                              onClick={() => handleDeny(request._id)}
                              disabled={processingId === request._id}
                              style={{
                                padding: "0.5rem 1rem",
                                backgroundColor: "#ef4444",
                                color: "#fff",
                                border: "none",
                                borderRadius: "0.375rem",
                                cursor: processingId === request._id ? "not-allowed" : "pointer",
                                opacity: processingId === request._id ? 0.6 : 1,
                                fontWeight: 500,
                              }}
                            >
                              {processingId === request._id ? "Processing..." : "Deny"}
                            </button>
                          </div>
                        )}
                        {request.status !== "pending" && (
                          <div style={{ fontSize: "0.875rem", color: "#6b7280", fontStyle: "italic" }}>
                            {request.status === "completed" ? "Accepted" : request.status === "cancelled" ? "Denied" : "Contacted"}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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


