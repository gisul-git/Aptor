/**
 * Employee Dashboard Page
 *
 * Dashboard for employees to view their information and assessments
 * Accessed after employee login
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/dsa/ui/card";
import { Button } from "../../components/dsa/ui/button";
import MetricCard from "@/components/employee-dashboard/ui/MetricCard";
import {
  User,
  Mail,
  Calendar,
  LogOut,
  FileText,
  FileCheck,
  TrendingUp,
  Clock,
  Award,
} from "lucide-react";

// Import  modular components for Upcoming Assessment Section
import SkillDistribution, {
  SkillData,
} from "@/components/employee-dashboard/ui/SkillDistribution";
import RecentActivity, {
  ActivityItem,
} from "@/components/employee-dashboard/ui/RecentActivity";
import UpcomingAssessments, {
  AssessmentItem,
} from "@/components/employee-dashboard/ui/UpcomingAssessments";
import CurrentLearningPath, {
  LearningPathItem,
} from "@/components/employee-dashboard/ui/CurrentLearningPath";
import TopSkills, {
  TopSkillItem,
} from "@/components/employee-dashboard/ui/TopSkills"; 
import CapabilityGauge from '@/components/employee-dashboard/ui/CapabilityGauge';
import WelcomeSection from '@/components/employee-dashboard/ui/WelcomeSection';

interface EmployeeTestSummary {
  assessmentId: string;
  title: string;
  type: string;
  status?: string | null;
  inviteSentAt?: string | null;
}

// --- Dummy Data  ---

const DUMMY_TOP_SKILLS: TopSkillItem[] = [
  { name: "React", percentage: 92, level: "Expert" },
  { name: "TypeScript", percentage: 88, level: "Advanced" },
  { name: "Node.js", percentage: 85, level: "Advanced" },
  { name: "Python", percentage: 78, level: "Intermediate" },
  { name: "AWS", percentage: 72, level: "Intermediate" },
];

const DUMMY_SKILLS: SkillData[] = [
  { category: "General", score: 82 },
  { category: "DSA", score: 75 },
  { category: "AI/ML", score: 68 },
  { category: "Cloud", score: 72 },
  { category: "DevOps", score: 65 },
  { category: "Data Eng", score: 70 },
  { category: "Design", score: 60 },
];

const DUMMY_ACTIVITIES: ActivityItem[] = [
  {
    id: 1,
    type: "assessment",
    title: "Completed Full Stack Developer Assessment",
    time: "32 min ago",
  },
  {
    id: 2,
    type: "learning",
    title: "Completed module: React Hooks Advanced",
    time: "2 hours ago",
  },
  {
    id: 3,
    type: "certification",
    title: "Earned certification: TypeScript Fundamentals",
    time: "1 days ago",
  },
  {
    id: 4,
    type: "github",
    title: "Pushed 5 commits to project repository",
    time: "2 days ago",
  },
  {
    id: 5,
    type: "learning",
    title: "Started course: AWS Solutions Architect",
    time: "3 days ago",
  },
];

const DUMMY_ASSESSMENTS: AssessmentItem[] = [
  {
    id: 1,
    category: "General",
    title: "Full Stack Developer Assessment",
    isOverdue: true,
    questions: 15,
    status: "not_started",
  },
  {
    id: 2,
    category: "DSA",
    title: "Data Structures & Algorithms",
    isOverdue: true,
    questions: 15,
    status: "in_progress",
    progress: 45,
  },
  {
    id: 3,
    category: "Cloud",
    title: "AWS Cloud Architecture",
    isOverdue: true,
    questions: 15,
    status: "not_started",
  },
];

const DUMMY_PATHS: LearningPathItem[] = [
  {
    id: 1,
    title: "Advanced React Patterns",
    provider: "Udemy",
    duration: "12h",
    progress: 65,
  },
  {
    id: 2,
    title: "System Design Masterclass",
    provider: "LinkedIn",
    duration: "8h",
    progress: 45,
  },
  {
    id: 3,
    title: "AWS Solutions Architect",
    provider: "Udemy",
    duration: "20h",
    progress: 0,
  },
  {
    id: 4,
    title: "Unlock Reassessment",
    provider: "",
    duration: "",
    progress: 65,
    isLocked: true,
  },
];
export default function EmployeeDashboardPage() {
  const router = useRouter();
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<EmployeeTestSummary[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [testsError, setTestsError] = useState<string | null>(null);

 

  useEffect(() => {
    // IMPORTANT: Employee dashboard should ONLY use employee tokens, not NextAuth tokens
    // Get employee data from storage - ONLY from employee_token key
    // Do NOT use NextAuth tokens or any other tokens
    const token =
      localStorage.getItem("employee_token") ||
      sessionStorage.getItem("employee_token");
    const storedData =
      localStorage.getItem("employee_data") ||
      sessionStorage.getItem("employee_data");

    console.log("🔵 [Employee Dashboard] Checking for employee token:", {
      hasToken: !!token,
      hasStoredData: !!storedData,
      tokenLength: token?.length || 0,
      tokenPreview: token ? token.substring(0, 20) + "..." : "none",
    });

    if (!token || !storedData) {
      // Not logged in as employee, redirect to employee login
      console.warn(
        "⚠️ [Employee Dashboard] No employee token found, redirecting to employee login",
      );
      router.push("/auth/employee-login");
      return;
    }

    try {
      const data = JSON.parse(storedData);

      // Validate that we have employee data (not org_admin data)
      if (!data.aaptorId || !data.organizationId) {
        console.error(
          "Invalid employee data - missing aaptorId or organizationId:",
          data,
        );
        // Clear invalid data and redirect
        localStorage.removeItem("employee_token");
        localStorage.removeItem("employee_data");
        sessionStorage.removeItem("employee_token");
        sessionStorage.removeItem("employee_data");
        router.push("/auth/employee-login");
        return;
      }

      setEmployeeData(data);

      // After we have employee data, load tests invited to this email from all competencies
      const fetchTests = async () => {
        try {
          setLoadingTests(true);
          setTestsError(null);

          // Re-fetch token to ensure we have the latest
          const token =
            localStorage.getItem("employee_token") ||
            sessionStorage.getItem("employee_token");

          if (!token) {
            setTestsError("Authentication required");
            return;
          }

          // Validate token is not empty and looks like a JWT
          if (token.length < 50) {
            console.error(
              "Token appears invalid (too short):",
              token.substring(0, 20) + "...",
            );
            setTestsError("Invalid employee token. Please log in again.");
            // Clear invalid token
            localStorage.removeItem("employee_token");
            sessionStorage.removeItem("employee_token");
            router.push("/auth/employee-login");
            return;
          }

          // Decode token to verify it's an employee token (client-side check)
          try {
            const tokenParts = token.split(".");
            if (tokenParts.length === 3) {
              const payload = JSON.parse(atob(tokenParts[1]));
              console.log("🔵 [Employee Dashboard] Token payload:", {
                type: payload.type,
                employeeId: payload.employeeId,
                aaptorId: payload.aaptorId,
                organizationId: payload.organizationId,
                allKeys: Object.keys(payload),
              });

              // Verify it's an employee token
              if (payload.type !== "employee") {
                console.error(
                  "❌ [Employee Dashboard] Token is not an employee token! Type:",
                  payload.type,
                );
                setTestsError(
                  "Invalid employee token type. Please log in again.",
                );
                localStorage.removeItem("employee_token");
                sessionStorage.removeItem("employee_token");
                router.push("/auth/employee-login");
                return;
              }
            }
          } catch (decodeError) {
            console.warn(
              "⚠️ [Employee Dashboard] Could not decode token (non-fatal):",
              decodeError,
            );
          }

          console.log(
            "🔵 [Employee Dashboard] Using employee token (length:",
            token.length,
            ", preview:",
            token.substring(0, 30) + "...",
            ")",
          );

          const baseURL =
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:80";

          // IMPORTANT: Use a fresh axios instance to avoid any global interceptors
          // Create a new axios instance for this request to ensure no interceptors interfere
          const employeeAxios = axios.create();

          // Call new aggregation endpoint that fetches from all services
          const response = await employeeAxios.get(
            `${baseURL}/api/v1/employee/all-tests`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            },
          );

          console.log(
            "✅ [Employee Dashboard] Request sent with token:",
            token.substring(0, 30) + "...",
          );

          const testsData = response.data?.data?.tests || [];
          setTests(testsData);

          // Log service status for debugging
          if (response.data?.data?.meta?.serviceStatus) {
            console.log(
              "Service status:",
              response.data.data.meta.serviceStatus,
            );
          }
        } catch (err: any) {
          console.error("Error fetching employee tests:", err);

          // If token error, clear and redirect
          if (
            err?.response?.status === 403 &&
            err?.response?.data?.detail?.includes("token type")
          ) {
            console.error("Invalid token type - clearing employee session");
            localStorage.removeItem("employee_token");
            localStorage.removeItem("employee_data");
            sessionStorage.removeItem("employee_token");
            sessionStorage.removeItem("employee_data");
            setTestsError("Invalid employee token. Please log in again.");
            setTimeout(() => {
              router.push("/auth/employee-login");
            }, 2000);
            return;
          }

          setTestsError(
            err?.response?.data?.detail ||
              err?.response?.data?.error ||
              err?.response?.data?.message ||
              err?.message ||
              "Failed to load assigned tests",
          );
        } finally {
          setLoadingTests(false);
        }
      };

      fetchTests();
    } catch (error) {
      console.error("Error parsing employee data:", error);
      // Clear invalid data
      localStorage.removeItem("employee_token");
      localStorage.removeItem("employee_data");
      sessionStorage.removeItem("employee_token");
      sessionStorage.removeItem("employee_data");
      router.push("/auth/employee-login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("employee_token");
    localStorage.removeItem("employee_data");
    sessionStorage.removeItem("employee_token");
    sessionStorage.removeItem("employee_data");
    router.push("/auth/employee-login");
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#f1dcba",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p>Loading...</p>
      </div>
    );
  }

  if (!employeeData) {
    return null;
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC" }}>
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "2rem 1rem",
        }}
      >
        {/* Header */}
        <div
          style={{
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ marginBottom: "2rem" }}>
            <h1
              style={{
                margin: 0,
                marginBottom: "0.5rem",
                fontSize: "2.25rem",
                fontWeight: 800,
                color: "#1E5A3B", 
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              Employee Dashboard
            </h1>
          </div>

          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              backgroundColor: "#ffffff",
              border: "1px solid #C9F4D4",
              borderRadius: "0.5rem",
              color: "#1E5A3B",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
              outline: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#E8FAF0";
              e.currentTarget.style.borderColor = "#1E5A3B";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#ffffff";
              e.currentTarget.style.borderColor = "#C9F4D4";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <LogOut size={16} strokeWidth={2.5} />
            Logout
          </button>
        </div>

        {/* Hero Section (Main Section) */}
        <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: "5rem",
        marginBottom: "3rem",
        padding: "1rem",
        position: "relative",
      }}
    >
      {/* Background Blob - Positioned relative to the container */}
      <div
        style={{
          position: "absolute",
          top: "-50px",
          left: "50px", 
          width: "250px",
          height: "250px",
          backgroundColor: "#D1FAE5",
          opacity: "0.4",
          borderRadius: "50%",
          filter: "blur(80px)",
          zIndex: 0,
        }}
      />

      {/* 1. The Gauge Component */}
      <CapabilityGauge score={78} increase={12} />

      {/* 2. The Welcome Text Component */}
      <WelcomeSection 
        userName={employeeData.name}
        companyName="Accenture" 
        certCount={5} 
        assessmentCount={12} 
      />
    </div>
        {/* Employee Information Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          {/* Aaptor ID Card */}
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #E2E8F0",
              borderRadius: "1rem",
              overflow: "hidden",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              padding: "1.5rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "1rem",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow =
                "0 10px 15px -3px rgba(0, 0, 0, 0.05)";
              e.currentTarget.style.borderColor = "#C9F4D4"; 
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow =
                "0 4px 6px -1px rgba(0, 0, 0, 0.02)";
              e.currentTarget.style.borderColor = "#E2E8F0";
            }}
          >
            <div
              style={{
                padding: "0.75rem",
                backgroundColor: "#E8FAF0",
                borderRadius: "0.75rem",
                color: "#1E5A3B", 
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <User size={24} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#2D7A52", 
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.5rem",
                }}
              >
                Aaptor ID
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "1.25rem",
                  fontFamily: "'Courier New', monospace",
                  fontWeight: 700,
                  color: "#1E5A3B",
                }}
              >
                {employeeData.aaptorId}
              </p>
            </div>
          </div>

          {/* Email Card */}
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #E2E8F0",
              borderRadius: "1rem",
              overflow: "hidden",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              padding: "1.5rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "1rem",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow =
                "0 10px 15px -3px rgba(0, 0, 0, 0.05)";
              e.currentTarget.style.borderColor = "#C9F4D4";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow =
                "0 4px 6px -1px rgba(0, 0, 0, 0.02)";
              e.currentTarget.style.borderColor = "#E2E8F0";
            }}
          >
            <div
              style={{
                padding: "0.75rem",
                backgroundColor: "#E8FAF0",
                borderRadius: "0.75rem",
                color: "#1E5A3B",
              }}
            >
              <Mail size={24} />
            </div>
            <div style={{ overflow: "hidden", flex: 1 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#2D7A52",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.5rem",
                }}
              >
                Email Address
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "#1E5A3B",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={employeeData.email}
              >
                {employeeData.email}
              </p>
            </div>
          </div>

          {/* Status Card */}
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #E2E8F0",
              borderRadius: "1rem",
              overflow: "hidden",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              padding: "1.5rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "1rem",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow =
                "0 10px 15px -3px rgba(0, 0, 0, 0.05)";
              e.currentTarget.style.borderColor = "#C9F4D4";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow =
                "0 4px 6px -1px rgba(0, 0, 0, 0.02)";
              e.currentTarget.style.borderColor = "#E2E8F0";
            }}
          >
            <div
              style={{
                padding: "0.75rem",
                backgroundColor: "#E8FAF0",
                borderRadius: "0.75rem",
                color: "#1E5A3B",
              }}
            >
              <FileText size={24} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#2D7A52",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.5rem",
                }}
              >
                Current Status
              </h3>
              <span
                style={{
                  display: "inline-block",
                  padding: "0.25rem 0.75rem",
                  borderRadius: "9999px",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  backgroundColor:
                    employeeData.status === "Active" ? "#E8FAF0" : "#F3F4F6",
                  color:
                    employeeData.status === "Active" ? "#1E5A3B" : "#6B7280",
                  border:
                    employeeData.status === "Active"
                      ? "1px solid #C9F4D4"
                      : "1px solid #E5E7EB",
                }}
              >
                {employeeData.status}
              </span>
            </div>
          </div>
        </div>

        {/* Card Section */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1.5rem",
            marginBottom: "3rem",
          }}
        >
          {/* 1. Assessments Taken Card (Green Theme) */}
          <MetricCard
            icon={<FileCheck size={24} />}
            iconColor="#15803d" // Green-700
            iconBg="#dcfce7" // Green-100
            value="12"
            label="Assessments Taken"
            badgeText="↗ +3 this month"
            badgeColor="#166534"
            badgeBg="#f0fdf4"
          />

          {/* 2. Average Score Card (Blue Theme) */}
          <MetricCard
            icon={<TrendingUp size={24} />}
            iconColor="#1d4ed8" // Blue-700
            iconBg="#dbeafe" // Blue-100
            value="82%"
            label="Average Score"
            badgeText="↗ +5% from last month"
            badgeColor="#1e40af"
            badgeBg="#eff6ff"
          />

          {/* 3. Learning Hours Card (Emerald Theme) */}
          <MetricCard
            icon={<Clock size={24} />}
            iconColor="#047857" // Emerald-700
            iconBg="#d1fae5" // Emerald-100
            value="47h"
            label="Learning Hours"
            badgeText="28h this month"
            badgeColor="#065f46"
            badgeBg="#ecfdf5"
          />

          {/* 4. Certifications Card (Purple Theme) */}
          <MetricCard
            icon={<Award size={24} />}
            iconColor="#7e22ce" // Purple-700
            iconBg="#f3e8ff" // Purple-100
            value="5"
            label="Certifications"
            badgeText="2 pending"
            badgeColor="#6b21a8"
            badgeBg="#faf5ff"
          />
        </div>

        {/* Invited Tests Section */}
        <Card>
          <CardHeader>
            <CardTitle style={{ margin: 0 }}>Your Invited Tests</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTests ? (
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "#6b6678",
                  margin: 0,
                }}
              >
                Loading your tests...
              </p>
            ) : testsError ? (
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "#DC2626",
                  margin: 0,
                }}
              >
                {testsError}
              </p>
            ) : tests.length === 0 ? (
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "#6b6678",
                  margin: 0,
                }}
              >
                You don't have any tests assigned yet. Please check back later
                or contact your administrator.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {tests.map((test) => (
                  <div
                    key={test.assessmentId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderRadius: "0.5rem",
                      border: "1px solid #E8E0D0",
                      padding: "0.75rem",
                      fontSize: "0.875rem",
                    }}
                  >
                    <div>
                      <p
                        style={{
                          margin: 0,
                          marginBottom: "0.25rem",
                          fontWeight: 500,
                        }}
                      >
                        {test.title}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.75rem",
                          color: "#6b6678",
                        }}
                      >
                        Type: {test.type.toUpperCase()} • Status:{" "}
                        {test.status || "unknown"}
                      </p>
                      {test.inviteSentAt && (
                        <p
                          style={{
                            margin: "0.25rem 0 0 0",
                            fontSize: "0.75rem",
                            color: "#6b6678",
                          }}
                        >
                          Invited:{" "}
                          {new Date(test.inviteSentAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <FileText
                        style={{
                          width: "16px",
                          height: "16px",
                          color: "#6b6678",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Assessment Section(Parent Section) */}
        <div
          style={{
            padding: "2rem",
            maxWidth: "2000px",
            margin: "0 auto",
            backgroundColor: "#F8FAFC",
            minHeight: "100vh",
            boxSizing: "border-box",
          }}
        >
        
          <div
            style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
          >
            {/* MAIN GRID */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.8fr 1fr",
                gap: "2.5rem",
                alignItems: "start",
              }}
            >
              {/* Left Column: Assessments + Skill Distribution */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2.5rem",
                }}
              >
                <UpcomingAssessments assessments={DUMMY_ASSESSMENTS} />

                {/* Added Skill Distribution Here */}
                <SkillDistribution data={DUMMY_SKILLS} />
              </div>

              {/* Right Column: Sidebar */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2rem",
                }}
              >
                <TopSkills skills={DUMMY_TOP_SKILLS} />
                <CurrentLearningPath paths={DUMMY_PATHS} />
              </div>
            </div>

            {/* --- BOTTOM SECTION --- */}
            <div style={{ width: "100%" }}>
              <RecentActivity activities={DUMMY_ACTIVITIES} />
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        {employeeData.lastLogin && (
          <Card style={{ marginTop: "1.5rem" }}>
            <CardHeader>
              <CardTitle
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  margin: 0,
                }}
              >
                <Calendar style={{ width: "20px", height: "20px" }} />
                Last Login
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                style={{
                  margin: 0,
                  color: "#6b6678",
                  fontSize: "0.875rem",
                }}
              >
                {new Date(employeeData.lastLogin).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
