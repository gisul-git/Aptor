import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { GetServerSideProps } from "next";
import Link from "next/link";
import fastApiClient from "../../lib/fastapi";

interface Assessment {
  id: string;
  title: string;
  status: string;
  createdAt?: string;
}

interface OrgAdmin {
  id: string;
  name: string;
  email: string;
  assessmentCount: number;
  assessments: Assessment[];
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  adminName: string;
  adminEmail: string;
}

function ConfirmationModal({ isOpen, onClose, onConfirm, adminName, adminEmail }: ConfirmationModalProps) {
  if (!isOpen) return null;

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
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#fff",
          padding: "2rem",
          borderRadius: "0.5rem",
          maxWidth: "500px",
          width: "90%",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.25rem", fontWeight: 600 }}>
          Delete Organization Admin
        </h3>
        <p style={{ margin: "0 0 1.5rem 0", color: "#6b7280" }}>
          Are you sure you want to delete the organization admin account for:
        </p>
        <div
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            padding: "1rem",
            borderRadius: "0.375rem",
            marginBottom: "1.5rem",
          }}
        >
          <p style={{ margin: "0 0 0.5rem 0", fontWeight: 600 }}>{adminName}</p>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.875rem" }}>{adminEmail}</p>
        </div>
        <p style={{ margin: "0 0 1.5rem 0", color: "#ef4444", fontSize: "0.875rem", fontWeight: 500 }}>
          ⚠️ This action cannot be undone. The user account will be permanently deleted.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#f3f4f6",
              color: "#1f2937",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#ef4444",
              color: "#fff",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Delete Admin
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrgAdminLogsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [orgAdmins, setOrgAdmins] = useState<OrgAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState<OrgAdmin | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (session && (session as any).user?.role !== "super_admin") {
      router.push("/dashboard");
      return;
    }

    loadOrgAdminLogs();
  }, [session, router]);

  const loadOrgAdminLogs = async () => {
    try {
      const token = (session as any)?.backendToken;
      if (!token) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      const response = await fastApiClient.get("/api/v1/super-admin/org-admin-logs", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setOrgAdmins(response.data?.data?.orgAdmins || []);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Failed to load org admin logs");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (admin: OrgAdmin) => {
    setAdminToDelete(admin);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!adminToDelete) return;

    setDeleting(true);
    try {
      const token = (session as any)?.backendToken;
      if (!token) {
        alert("Not authenticated");
        return;
      }

      await fastApiClient.delete(`/api/v1/super-admin/org-admins/${adminToDelete.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Remove the deleted admin from the list
      setOrgAdmins((prev) => prev.filter((admin) => admin.id !== adminToDelete.id));
      
      setDeleteModalOpen(false);
      setAdminToDelete(null);
      alert(`Organization admin '${adminToDelete.name}' deleted successfully`);
    } catch (err: any) {
      alert(err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Failed to delete org admin");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setAdminToDelete(null);
  };

  if (!session || (session as any).user?.role !== "super_admin") {
    return null;
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        adminName={adminToDelete?.name || ""}
        adminEmail={adminToDelete?.email || ""}
      />
      
      <header
        style={{
          backgroundColor: "#fff",
          borderBottom: "1px solid #e5e7eb",
          padding: "1rem 2rem",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600 }}>Org Admin Logs</h1>
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
            <Link href="/super-admin/logs" style={{ padding: "0.75rem", textDecoration: "none", color: "#1f2937" }}>
              Super Admin Logs
            </Link>
            <Link href="/super-admin/super-admin-list" style={{ padding: "0.75rem", textDecoration: "none", color: "#1f2937" }}>
              Super Admin List
            </Link>
            <Link
              href="/super-admin/org-admin-logs"
              style={{
                padding: "0.75rem",
                textDecoration: "none",
                color: "#1f2937",
                backgroundColor: "#f3f4f6",
                borderRadius: "0.375rem",
                fontWeight: 500,
              }}
            >
              Org Admin Logs
            </Link>
            <Link href="/super-admin/request-demos" style={{ padding: "0.75rem", textDecoration: "none", color: "#1f2937" }}>
              Request Demos
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
              <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>Organization Admin Activity</h2>
              {orgAdmins.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>No org admins found</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  {orgAdmins.map((admin) => (
                    <div
                      key={admin.id}
                      style={{
                        backgroundColor: "#fff",
                        padding: "1.5rem",
                        borderRadius: "0.5rem",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>{admin.name}</h3>
                          <p style={{ margin: "0.25rem 0 0 0", color: "#6b7280", fontSize: "0.875rem" }}>{admin.email}</p>
                          <p style={{ margin: "0.5rem 0 0 0", color: "#6b7280", fontSize: "0.875rem" }}>
                            Assessment Count: <strong>{admin.assessmentCount}</strong>
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteClick(admin)}
                          disabled={deleting}
                          style={{
                            padding: "0.5rem 1rem",
                            backgroundColor: "#ef4444",
                            color: "#fff",
                            border: "none",
                            borderRadius: "0.375rem",
                            cursor: deleting ? "not-allowed" : "pointer",
                            fontWeight: 500,
                            fontSize: "0.875rem",
                            opacity: deleting ? 0.6 : 1,
                          }}
                        >
                          Delete Admin
                        </button>
                      </div>
                      {admin.assessments.length > 0 && (
                        <div>
                          <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "1rem", fontWeight: 600 }}>Assessments:</h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            {admin.assessments.map((assessment) => (
                              <div
                                key={assessment.id}
                                style={{
                                  padding: "0.75rem",
                                  backgroundColor: "#f9fafb",
                                  borderRadius: "0.375rem",
                                  borderLeft: "3px solid #3b82f6",
                                }}
                              >
                                <div style={{ fontWeight: 500, marginBottom: "0.25rem" }}>{assessment.title}</div>
                                <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                                  Status: {assessment.status} | Created:{" "}
                                  {assessment.createdAt ? new Date(assessment.createdAt).toLocaleString() : "N/A"}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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

