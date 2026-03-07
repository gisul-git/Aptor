import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;
    
    // Skip middleware for MediaPipe assets (static files)
    if (pathname.startsWith('/mediapipe/')) {
      return NextResponse.next();
    }
    
    // Role-based access control
    const userRole = (token as any)?.role;
    
    // Block employees from accessing creation/management pages
    if (userRole === 'employee') {
      // Employees should only access their dashboard
      const employeeAllowedRoutes = [
        '/employee/dashboard',
        '/employee', // Allow /employee but redirect to dashboard if needed
      ];
      
      const isEmployeeRoute = employeeAllowedRoutes.some(route => 
        pathname === route || pathname.startsWith(route + '/')
      );
      
      // Block access to creation pages
      const blockedRoutes = [
        '/assessments/create',
        '/dsa/questions/create',
        '/dsa/questions/',
        '/aiml/create',
        '/aiml/questions/create',
        '/aiml/questions/',
        '/custom-mcq/create',
        '/employee/management', // Org admin only
        '/dashboard', // Main dashboard (org admin/super admin)
      ];
      
      const isBlockedRoute = blockedRoutes.some(route => 
        pathname.startsWith(route)
      );
      
      if (isBlockedRoute) {
        // Redirect employees to their dashboard
        return NextResponse.redirect(new URL('/employee/dashboard', req.url));
      }
      
      // If not an employee route and not blocked, allow (will be handled by auth check)
    }
    
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Protect all routes except public ones
        const { pathname } = req.nextUrl;
        
        // Always allow root route (landing page) - must be first check
        if (pathname === "/") {
          return true;
        }
        
        // DEBUG: Log candidate reference photo routes
        if (pathname.startsWith("/api/v1/candidate/get-reference-photo") ||
            pathname.startsWith("/api/v1/candidate/save-reference-face")) {
          console.log("[Middleware] 🔍 Candidate reference photo route detected:", {
            pathname,
            hasToken: !!token,
            tokenType: token ? typeof token : 'none',
            willAllow: true,
          });
          return true;
        }
        
        // Skip auth for MediaPipe assets
        if (pathname.startsWith('/mediapipe/')) {
          return true;
        }
        
        // Public routes that don't require authentication
        const publicRoutes = [
          "/auth/signin",
          "/auth/signup",
          "/auth/forgot-password",  // Forgot password page
          "/auth/reset-password",  // Reset password page
          "/auth/set-password",  // Employee set password page
          "/auth/employee-login",  // Employee login page
          "/auth/mfa",  // MFA routes - user is in the middle of login flow (setup, verify)
          "/super-admin/mfa",  // Super admin MFA page - user is in the middle of login flow
          "/schedule-demo",  // Schedule demo page - public landing page
          "/thank-you",  // Thank you page after demo submission
          "/api/auth",
          "/api/assessment",
          "/api/schedule-demo",  // Schedule demo API endpoint - public form submission
          "/api/proctor",  // Proctoring API routes (validated server-side)
          "/api/config",  // Runtime configuration API routes (used by candidate pages)
          "/employee",  // Employee routes - handled by component with modal
        ];
        
        // Check if route is public
        const isPublicRoute = publicRoutes.some(route => 
          pathname === route || pathname.startsWith(route + "/")
        );
        
        // Allow public routes
        if (isPublicRoute) {
          return true;
        }
        
        // Candidate assessment routes (use token from URL, not session)
        if (pathname.startsWith("/assessment/")) {
          return true; // These routes have their own token-based auth
        }

        // Candidate precheck routes (use token from URL, not session)
        if (pathname.startsWith("/precheck/")) {
          return true; // These routes have their own token-based auth
        }

        // DSA test routes (use token from URL, not session)
        if (pathname.startsWith("/test/")) {
          return true; // These routes have their own token-based auth
        }

        // AIML test routes (use token from URL, not session)
        if (pathname.startsWith("/aiml/test/")) {
          return true; // These routes have their own token-based auth
        }

        // Custom MCQ assessment routes (use token from URL, not session)
        if (pathname.startsWith("/custom-mcq/entry/") || 
            pathname.startsWith("/custom-mcq/take/") ||
            pathname.startsWith("/custom-mcq/result/")) {
          return true; // These routes have their own token-based auth
        }

        // Candidate-facing API routes should remain public (token validated server-side)
        if (pathname.startsWith("/api/assessment/")) {
          return true;
        }
        
        // Custom MCQ API routes - public (candidates aren't logged in via NextAuth, token validated server-side)
        if (pathname.startsWith("/api/v1/custom-mcq/verify-candidate") ||
            pathname.startsWith("/api/v1/custom-mcq/take/") ||
            pathname.startsWith("/api/v1/custom-mcq/submit") ||
            pathname.startsWith("/api/custom-mcq/take/")) {
          return true;
        }
        
        // Proctoring API routes - public (candidates aren't logged in via NextAuth)
        if (pathname.startsWith("/api/proctor/")) {
          return true;
        }

        // AIML candidate API routes - public (candidates use user_id/token from URL, not NextAuth session)
        // These endpoints are accessed by candidates via test links with just name/email verification
        if (pathname.startsWith("/api/v1/aiml/tests/")) {
          const aimlCandidateEndpoints = [
            "/verify-link",
            "/verify-candidate",
            "/start",
            "/public",
            "/full",
            "/candidate",
            "/submit-answer",
            "/submit"
          ];
          if (aimlCandidateEndpoints.some(endpoint => pathname.endsWith(endpoint))) {
            return true;
          }
        }

        // DSA candidate API routes - public (candidates use user_id/token from URL, not NextAuth session)
        // These endpoints are accessed by candidates via test links with just name/email verification
        if (pathname.startsWith("/api/v1/dsa/tests/")) {
          const dsaCandidateEndpoints = [
            "/verify-link",
            "/verify-candidate",
            "/start",
            "/public",
            "/submission",
            "/final-submit",
            "/full"
          ];
          // Check for /question/{id} pattern
          if (pathname.includes("/question/") || dsaCandidateEndpoints.some(endpoint => pathname.endsWith(endpoint))) {
            return true;
          }
        }

        // AIML/DSA reference photo endpoints - public (candidates aren't logged in via NextAuth)
        if (pathname === "/api/v1/aiml/tests/get-reference-photo" ||
            pathname === "/api/v1/aiml/tests/save-reference-face" ||
            pathname === "/api/v1/dsa/tests/get-reference-photo" ||
            pathname === "/api/v1/dsa/tests/save-reference-face") {
          return true;
        }

        // AIML dataset download endpoint - public (candidates need to download datasets)
        if (pathname.startsWith("/api/v1/aiml/questions/") && pathname.endsWith("/dataset-download")) {
          return true;
        }

  // Custom MCQ assessment routes (use token from URL, not session)
        if (pathname.startsWith("/custom-mcq/entry/") ||
            pathname.startsWith("/custom-mcq/take/") ||
            pathname.startsWith("/custom-mcq/result/")) {
          return true; // These routes have their own token-based auth
        }
 
        // Candidate-facing API routes should remain public (token validated server-side)
        if (pathname.startsWith("/api/assessment/")) {
          return true;
        }
       
        // Custom MCQ API routes - public (candidates aren't logged in via NextAuth, token validated server-side)
        if (pathname.startsWith("/api/v1/custom-mcq/verify-candidate") ||
            pathname.startsWith("/api/v1/custom-mcq/take/") ||
            pathname.startsWith("/api/v1/custom-mcq/submit") ||
            pathname.startsWith("/api/custom-mcq/take/")) {
          return true;
        }

        
        // All other routes require authentication
        return !!token;
      },
    },
    pages: {
      signIn: "/auth/signin",
    },
  }
);

// Configure which routes to protect
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (NextAuth routes)
     * - api/assessment (Candidate assessment API)
     * - api/proctor (Proctoring API - candidates aren't logged in)
     * - api/config (Runtime configuration API)
     * - api/v1 (All API v1 routes - handled by API Gateway with its own auth)
     * - api/v1/candidate (Candidate API routes - reference photo, etc.)
     * - mediapipe (MediaPipe assets)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - _next/data (static generation data files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!api/auth|api/assessment|api/proctor|api/config|api/v1|api/v1/candidate|mediapipe|_next/static|_next/image|_next/data|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|wasm|data|binarypb)$).*)",
  ],
};

