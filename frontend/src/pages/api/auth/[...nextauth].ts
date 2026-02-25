import type { NextAuthOptions } from "next-auth";
import NextAuth from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import fastApiClient from "../../../lib/fastapi";
import type { BackendUser } from "../../../types/auth";

export const authOptions: NextAuthOptions = {
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error", // Custom error page for OAuth errors
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days (matches refresh token expiration)
  },
  debug: process.env.NODE_ENV === "development",
  // Only use secure cookies if NEXTAUTH_URL is HTTPS
  useSecureCookies: process.env.NEXTAUTH_URL?.startsWith("https://") ?? false,
  cookies: {
    sessionToken: {
      name: `${process.env.NEXTAUTH_URL?.startsWith("https://") ? "__Secure-" : ""}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax", // Changed from strict to allow OAuth redirects
        path: "/",
        // Only use secure cookies when using HTTPS
        secure: process.env.NEXTAUTH_URL?.startsWith("https://") || process.env.NEXT_PUBLIC_FORCE_SECURE_COOKIES === "true",
      },
    },
  },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Password Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        org_id: { label: "Organization ID", type: "text" }, // For org_admin login
        mfaToken: { label: "MFA Token", type: "text" }, // For post-MFA login
        refreshToken: { label: "Refresh Token", type: "text" }, // For post-MFA login
      },
      async authorize(credentials) {
        // If mfaToken is provided, this is a post-MFA login
        if (credentials?.mfaToken) {
          try {
            // Verify the token is valid by getting user info
            const userResponse = await fastApiClient.get("/api/v1/users/me", {
              headers: {
                Authorization: `Bearer ${credentials.mfaToken}`,
              },
            });
            
            const userData = userResponse.data?.data;
            if (!userData || userData.role !== "super_admin") {
              return null;
            }

            const backendUser: BackendUser = {
              id: userData.id,
              name: userData.name,
              email: userData.email,
              role: userData.role,
              organization: userData.organization,
              phone: userData.phone || undefined,
              country: userData.country || undefined,
              token: credentials.mfaToken,
              refreshToken: (credentials as any).refreshToken || "",
            } as BackendUser;
            return backendUser;
          } catch (err) {
            console.error("MFA token verification failed:", err);
            return null;
          }
        }
        if (!credentials?.email || !credentials?.password) {
          return null; // Return null instead of throwing for invalid credentials
        }

        try {
          const loginPayload: any = {
            email: credentials.email,
            password: credentials.password,
          };
          
          // Add org_id if provided (required for org_admin users)
          if ((credentials as any).org_id) {
            loginPayload.org_id = (credentials as any).org_id.trim().toUpperCase();
          }
          
          const response = await fastApiClient.post("/api/v1/auth/login", loginPayload);

          // Debug: log the raw response to help diagnose 401 issues
          console.log("🔐 [Credentials] /api/v1/auth/login response:", {
            status: response?.status,
            statusText: response?.statusText,
            data: response?.data,
            config: { baseURL: fastApiClient.defaults.baseURL },
          });

          // Support multiple possible response shapes (ApiResponse<T> or direct payload)
          const respData = response?.data;
          const data = respData?.data ?? respData;

          // Debug parsed payload
          console.log("🔐 [Credentials] Parsed login payload:", JSON.stringify(data, null, 2));

          // Check if MFA is required for super_admin (support nested or top-level flags)
          const requireMfa = data?.require_mfa ?? respData?.require_mfa;
          if (requireMfa === true) {
            // Throw a specific error that the frontend can catch and handle
            // This prevents NextAuth from showing a generic "CredentialsSignin" error
            console.log("🔐 [Credentials] MFA required for user, throwing MFARequired error");
            throw new Error("MFA_REQUIRED");
          }
          
          // Accept token either as `token` or `accessToken` and user either as `user` or top-level fields
          const token = data?.token ?? data?.accessToken ?? respData?.token ?? respData?.accessToken;
          const userObj = data?.user ?? respData?.user ?? (data?.userId ? { id: data.userId, email: data.email, name: data.name } : null);

          if (!token || !userObj) {
            console.error("🔴 [Credentials] Invalid response from authentication service. Missing token or user:", {
              responseData: respData,
              parsedData: data,
            });
            return null; // Return null for invalid response so NextAuth returns 401
          }

          // CRITICAL: Ensure user object has an 'id' field (required by NextAuth)
          // Handle both '_id' (MongoDB) and 'id' (serialized) formats
          const userId = userObj.id ?? userObj._id ?? userObj.userId;
          
          if (!userId) {
            console.error("🔴 [Credentials] User object missing 'id' field. Cannot create session:", {
              userObj,
              responseData: respData,
              parsedData: data,
            });
            return null; // Return null if no user ID - NextAuth requires this
          }

          const backendUser: BackendUser = {
            id: String(userId), // Ensure id is always a string
            name: userObj.name,
            email: userObj.email,
            role: userObj.role,
            organization: userObj.organization,
            phone: userObj.phone || undefined,
            country: userObj.country || undefined,
            token: token,
            refreshToken: data?.refreshToken ?? respData?.refreshToken ?? data?.refresh_token ?? respData?.refresh_token, // Store refresh token
          } as BackendUser;

          // Debug the final user object returned by authorize
          console.log("🔐 [Credentials] Returning backend user:", JSON.stringify(backendUser, null, 2));

          return backendUser;
        } catch (error: any) {
          // Check if MFA is required - if so, throw specific error
          const requireMfaFromError = error?.response?.data?.data?.require_mfa || 
                                     error?.response?.data?.require_mfa ||
                                     error?.message === "MFA_REQUIRED";
          if (requireMfaFromError === true || error?.message === "MFA_REQUIRED") {
            console.log("🔐 [Credentials] Error response indicates MFA required, throwing MFARequired error");
            throw new Error("MFA_REQUIRED");
          }

          // Check for connection errors (backend not running)
          if (error?.code === "ECONNREFUSED" || error?.code === "ENOTFOUND" || error?.message?.includes("not found")) {
            console.error("Backend server connection error. Is the backend running?", {
              baseURL: fastApiClient.defaults.baseURL,
              message: error?.message,
              code: error?.code,
              response: error?.response?.data,
            });
            // Return null to prevent NextAuth error - frontend will handle it
            return null;
          }

          // Log the error for debugging
          console.error("Credentials authentication error:", {
            message: error?.message,
            response: error?.response?.data,
            status: error?.response?.status,
            code: error?.code,
            baseURL: fastApiClient.defaults.baseURL,
          });

          // Extract error message from backend response
          const errorMessage = 
            error?.response?.data?.detail || 
            error?.response?.data?.message || 
            error?.message || 
            "Invalid email or password";

          // Throw error with message - NextAuth will catch this and pass it to the frontend
          // The error message will be available in result.error in the signIn callback
          throw new Error(errorMessage);
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID ?? "",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET ?? "",
      tenantId: process.env.AZURE_AD_TENANT_ID ?? "common",
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Prevent the "flash" of landing page by never redirecting to "/"
      // after sign-in. Also restrict redirects to same-origin for safety.
      try {
        // Relative URLs (e.g. "/dashboard")
        if (url.startsWith("/")) {
          return url === "/" ? `${baseUrl}/dashboard` : `${baseUrl}${url}`;
        }

        // Absolute URLs
        const parsed = new URL(url);
        if (parsed.origin !== baseUrl) {
          return `${baseUrl}/dashboard`;
        }
        return parsed.pathname === "/" ? `${baseUrl}/dashboard` : url;
      } catch {
        return `${baseUrl}/dashboard`;
      }
    },
    async signIn({ user, account, profile }) {
      if (!account || account.provider === "credentials") {
        return true;
      }

      if (!user?.email) {
        throw new Error("Email is required for OAuth login");
      }

      try {
        // Server-side: use internal API Gateway URL
        const baseURL = process.env.API_GATEWAY_URL || "http://api-gateway:80";
        
        // Skip health check for OAuth - go directly to login
        // Health check was causing timeouts. OAuth login will fail fast if backend is down.
        console.log("🔵 [OAuth] Starting OAuth login process");
        console.log("🔵 [OAuth] Base URL:", baseURL);
        console.log("🔵 [OAuth] Full URL:", `${baseURL}/api/v1/auth/oauth-login`);
        console.log("🔵 [OAuth] User email:", user.email);
        console.log("🔵 [OAuth] Provider:", account.provider);
        
        const requestPayload = {
          email: user.email,
          name: user.name ?? (profile as any)?.name ?? user.email.split("@")[0],
          provider: account.provider,
        };
        console.log("🔵 [OAuth] Request payload:", JSON.stringify(requestPayload, null, 2));
        
        let response;
        try {
          console.log("🔵 [OAuth] Making POST request to /api/v1/auth/oauth-login");
          // Use a longer timeout for OAuth login (30 seconds)
          response = await fastApiClient.post("/api/v1/auth/oauth-login", requestPayload, {
            timeout: 30000, // 30 seconds for OAuth login
          });
          console.log("🔵 [OAuth] Request successful, response:", response?.data);
        } catch (oauthError: any) {
          console.error("🔴 [OAuth] API call failed - Full error object:", oauthError);
          console.error("🔴 [OAuth] Error code:", oauthError?.code);
          console.error("🔴 [OAuth] Error message:", oauthError?.message);
          console.error("🔴 [OAuth] Response status:", oauthError?.response?.status);
          console.error("🔴 [OAuth] Response data:", oauthError?.response?.data);
          
          // Handle 403 Forbidden - Account not found (requires signup)
          if (oauthError?.response?.status === 403) {
            const errorDetail = oauthError?.response?.data?.detail || 
                               oauthError?.response?.data?.message || 
                               "Account not found. Please sign up first.";
            
            // Check if it's the "Account not found" error
            if (errorDetail.includes("Account not found") || errorDetail.includes("sign up first")) {
              // Store email for signup pre-fill
              const errorMessage = `OAuthSignupRequired:${user.email}:${errorDetail}`;
              throw new Error(errorMessage);
            }
            
            // Other 403 errors (e.g., email not verified)
            throw new Error(`OAuthError:${errorDetail}`);
          }
          
          // Handle connection errors
          if (oauthError?.code === "ECONNREFUSED" || oauthError?.message?.includes("ECONNREFUSED")) {
            throw new Error("Cannot connect to API Gateway. Please ensure the gateway is running on http://localhost:80");
          } else if (oauthError?.code === "ETIMEDOUT" || oauthError?.message?.includes("timeout")) {
            throw new Error("Backend request timed out. Please ensure the backend server is running and MongoDB is connected.");
          } else if (oauthError?.code === "ERR_NETWORK" || oauthError?.message?.includes("Network Error")) {
            throw new Error("Network error. Please check if the API Gateway is running on http://localhost:80");
          }
          
          // Re-throw with original error details
          const errorDetail = oauthError?.response?.data?.detail || 
                             oauthError?.response?.data?.message || 
                             oauthError?.message || 
                             "OAuth sign-in failed";
          throw new Error(errorDetail);
        }

        const data = response.data?.data;
        if (!data?.token || !data?.user) {
          console.error("Invalid OAuth response:", response.data);
          throw new Error("Invalid response from authentication service");
        }

        const backendUser: BackendUser = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          organization: data.user.organization,
          phone: data.user.phone || undefined,
          country: data.user.country || undefined,
          token: data.token,
          refreshToken: data.refreshToken, // Store refresh token
        } as BackendUser;

        Object.assign(user, backendUser);
        console.log("OAuth sign-in successful for:", user.email);
        return true;
      } catch (error: any) {
        console.error("OAuth sign-in failed:", {
          message: error?.message,
          response: error?.response?.data,
          status: error?.response?.status,
          code: error?.code,
          baseURL: process.env.API_GATEWAY_URL || "http://api-gateway:80",
        });
        
        // Check if this is a signup required error
        if (error?.message?.startsWith("OAuthSignupRequired:")) {
          // Format: OAuthSignupRequired:email:errorMessage
          const parts = error.message.split(":");
          const email = parts[1] || user.email;
          const errorMessage = parts.slice(2).join(":") || "Please sign up first before using OAuth login.";
          
          // Throw error that will be caught by NextAuth and redirect to error page
          // The error page will then redirect to signup with email pre-filled
          throw new Error(`OAuthSignupRequired:${email}:${errorMessage}`);
        }
        
        // Check if this is a general OAuth error
        if (error?.message?.startsWith("OAuthError:")) {
          const errorMessage = error.message.replace("OAuthError:", "");
          throw new Error(errorMessage);
        }
        
        // Handle connection errors
        const apiUrl = process.env.API_GATEWAY_URL || "http://api-gateway:80";
        if (error?.code === "ECONNREFUSED" || error?.message?.includes("ECONNREFUSED")) {
          throw new Error(`Cannot connect to API Gateway. Please ensure the gateway is running on ${apiUrl}`);
        } else if (error?.code === "ETIMEDOUT" || error?.message?.includes("timeout")) {
          throw new Error(`API Gateway request timed out. Please ensure the gateway is running. Check ${apiUrl}/health`);
        } else if (error?.code === "ERR_NETWORK" || error?.message?.includes("Network Error")) {
          throw new Error(`Network error. Please check if the API Gateway is running on ${apiUrl}`);
        }
        
        // Default error message
        const errorMessage = error?.response?.data?.detail || 
                           error?.response?.data?.message || 
                           error?.message || 
                           "OAuth sign-in failed";
        throw new Error(errorMessage);
      }
    },
    async jwt({ token, user, account, trigger, session }) {
      // Handle token refresh via update() call
      if (trigger === "update" && session) {
        const updatedSession = session as any;
        if (updatedSession.backendToken) {
          token.backendToken = updatedSession.backendToken;
        }
        if (updatedSession.refreshToken) {
          token.refreshToken = updatedSession.refreshToken;
        }
        return token;
      }

      if (user) {
        token.id = (user as BackendUser).id ?? token.sub;
        token.role = (user as BackendUser).role ?? token.role;
        token.organization = (user as BackendUser).organization ?? token.organization;
        token.phone = ((user as any) as BackendUser).phone ?? token.phone;
        token.country = ((user as any) as BackendUser).country ?? token.country;
        token.backendToken = (user as BackendUser).token ?? token.backendToken;
        token.refreshToken = (user as BackendUser).refreshToken ?? token.refreshToken;
      }

      if (account) {
        token.provider = account.provider;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string | undefined;
        (session.user as any).organization = token.organization as string | undefined;
        (session.user as any).phone = token.phone as string | undefined;
        (session.user as any).country = token.country as string | undefined;
      }

      (session as any).backendToken = token.backendToken as string | undefined;
      (session as any).refreshToken = token.refreshToken as string | undefined;
      (session as any).provider = token.provider as string | undefined;
      return session;
    },
  },
};

export default NextAuth(authOptions);
