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
        
        // Skip auth for MediaPipe assets
        if (pathname.startsWith('/mediapipe/')) {
          return true;
        }
        
        // Public routes that don't require authentication
        const publicRoutes = [
          "/auth/signin",
          "/auth/signup",
          "/auth/forgot-password",
          "/auth/reset-password",
          "/auth/set-password",
          "/auth/employee-login",
          "/super-admin/mfa",
          "/schedule-demo",
          "/thank-you",
          "/api/auth",
          "/api/assessment",
          "/api/schedule-demo",
          "/api/proctor",
          "/api/config",
          "/employee",
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
          return true;
        }

        // Candidate precheck routes (use token from URL, not session)
        if (pathname.startsWith("/precheck/")) {
          return true;
        }

        // DSA test routes (use token from URL, not session)
        if (pathname.startsWith("/test/")) {
          return true;
        }

        // AIML test routes (use token from URL, not session)
        if (pathname.startsWith("/aiml/test/")) {
          return true;
        }

        // Custom MCQ assessment routes (use token from URL, not session)
        if (pathname.startsWith("/custom-mcq/entry/") || 
            pathname.startsWith("/custom-mcq/take/") ||
            pathname.startsWith("/custom-mcq/result/")) {
          return true;
        }

        // Candidate-facing API routes should remain public (token validated server-side)
        if (pathname.startsWith("/api/assessment/")) {
          return true;
        }
        
        // Custom MCQ API routes - public
        if (pathname.startsWith("/api/v1/custom-mcq/verify-candidate") ||
            pathname.startsWith("/api/v1/custom-mcq/take/") ||
            pathname.startsWith("/api/v1/custom-mcq/submit") ||
            pathname.startsWith("/api/custom-mcq/take/")) {
          return true;
        }
        
        // Proctoring API routes - public
        if (pathname.startsWith("/api/proctor/")) {
          return true;
        }

        // AIML candidate API routes - public
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

        // DSA candidate API routes - public
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
          if (pathname.includes("/question/") || dsaCandidateEndpoints.some(endpoint => pathname.endsWith(endpoint))) {
            return true;
          }
        }

        // AIML/DSA reference photo endpoints - public
        if (pathname === "/api/v1/aiml/tests/get-reference-photo" ||
            pathname === "/api/v1/aiml/tests/save-reference-face" ||
            pathname === "/api/v1/dsa/tests/get-reference-photo" ||
            pathname === "/api/v1/dsa/tests/save-reference-face" ||
            pathname === "/api/v1/candidate/get-reference-photo" ||
            pathname === "/api/v1/candidate/save-reference-face") {
          return true;
        }

        // AIML dataset download endpoint - public
        if (pathname.startsWith("/api/v1/aiml/questions/") && pathname.endsWith("/dataset-download")) {
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

// Configure which routes the middleware should run on
// Exclude data-engineering routes completely
export const config = {
  matcher: [
    /*
     * Match all routes EXCEPT:
     * - API routes (handled separately)
     * - Static files (_next/static, _next/image, favicon.ico)
     * - Public assets
     * - data-engineering routes (completely excluded)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|data-engineering).*)',
  ],
};
