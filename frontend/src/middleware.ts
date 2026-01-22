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
    
    // Block org_admin from accessing employee-specific routes (if they try to access directly)
    if (userRole === 'org_admin' && pathname.startsWith('/employee/dashboard')) {
      // Org admins should use /employee/management, not /employee/dashboard
      return NextResponse.redirect(new URL('/employee/management', req.url));
    }
    
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Protect all routes except public ones
        const { pathname } = req.nextUrl;
        
        // Skip auth for MediaPipe assets
        if (pathname.startsWith('/mediapipe/')) {
          return true;
        }
        
        // Public routes that don't require authentication
        const publicRoutes = [
          "/",
          "/auth/signin",
          "/auth/signup",
          "/auth/set-password",  // Employee set password page
          "/auth/employee-login",  // Employee login page
          "/super-admin/mfa",  // MFA page - user is in the middle of login flow
          "/api/auth",
          "/api/assessment",
          "/api/proctor",  // Proctoring API routes (validated server-side)
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
     * - mediapipe (MediaPipe assets)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!api/auth|api/assessment|api/proctor|mediapipe|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|wasm|data|binarypb)$).*)",
  ],
};

