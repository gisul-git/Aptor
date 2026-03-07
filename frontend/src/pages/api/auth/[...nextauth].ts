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
        mfaCode: { label: "MFA Code", type: "text" }, // For MFA verification
        mfaMethod: { label: "MFA Method", type: "text" }, // totp, email, backup
        tempToken: { label: "Temp Token", type: "text" }, // Temporary token from initial login
        mfaSetupComplete: { label: "MFA Setup Complete", type: "text" }, // For MFA setup completion
        mfaSetupToken: { label: "MFA Setup Token", type: "text" }, // For MFA setup completion
        encryptedSecret: { label: "Encrypted Secret", type: "text" }, // For MFA setup completion
        hashedBackupCodes: { label: "Hashed Backup Codes", type: "text" }, // For MFA setup completion
        mfaToken: { label: "MFA Token", type: "text" }, // For post-MFA login (super admin)
        refreshToken: { label: "Refresh Token", type: "text" }, // For post-MFA login
      },
      async authorize(credentials) {
        // CASE 1: Post-MFA login for super admin (existing flow)
        if (credentials?.mfaToken) {
          console.log("🔐 [Credentials] MFA token provided, verifying token");
          try {
            const userResponse = await fastApiClient.get("/api/v1/super-admin/me", {
              headers: {
                Authorization: `Bearer ${credentials.mfaToken}`,
              },
            });
            
            console.log("🔐 [Credentials] MFA token verification response:", {
              status: userResponse?.status,
              data: userResponse?.data,
            });
            
            const userData = userResponse.data?.data ?? userResponse.data;
            if (!userData || userData.role !== "super_admin") {
              console.error("🔴 [Credentials] MFA token verification failed");
              return null;
            }

            const backendUser: BackendUser = {
              id: userData.id || userData._id,
              name: userData.name,
              email: userData.email,
              role: userData.role,
              organization: userData.organization,
              phone: userData.phone || undefined,
              country: userData.country || undefined,
              token: credentials.mfaToken,
              refreshToken: (credentials as any).refreshToken || "",
            } as BackendUser;
            
            console.log("🔐 [Credentials] MFA token verified successfully");
            return backendUser;
          } catch (err: any) {
            console.error("🔴 [Credentials] MFA token verification failed:", err?.message);
            return null;
          }
        }

        // CASE 2: MFA Setup Completion
        if (credentials?.mfaSetupComplete === "true" && credentials?.mfaSetupToken) {
          console.log("🔐 [Credentials] MFA setup completion");
          try {
            const response = await fastApiClient.post(
              "/api/v1/auth/mfa/complete-setup",
              {
                email: credentials.email,
                encrypted_secret: credentials.encryptedSecret,
                hashed_backup_codes: JSON.parse(credentials.hashedBackupCodes || "[]"),
              },
              {
                headers: {
                  Authorization: `Bearer ${credentials.mfaSetupToken}`,
                },
              }
            );

            const data = response.data?.data;

            if (!data?.accessToken || !data?.user) {
              console.error("🔴 [Credentials] Invalid MFA setup completion response");
              return null;
            }

            const backendUser: BackendUser = {
              id: data.user.id,
              name: data.user.name,
              email: data.user.email,
              role: data.user.role,
              organization: data.user.organization,
              phone: data.user.phone || undefined,
              country: data.user.country || undefined,
              token: data.accessToken,
              refreshToken: data.refreshToken,
            } as BackendUser;

            console.log("✅ [Credentials] MFA setup completed successfully");
            return backendUser;
          } catch (err: any) {
            console.error("🔴 [Credentials] MFA setup completion failed:", err?.response?.data?.detail || err?.message);
            throw new Error(err?.response?.data?.detail || "Failed to complete MFA setup");
          }
        }

        // CASE 3: MFA verification (TOTP, Email OTP, or Backup Code)
        if (credentials?.mfaCode && credentials?.tempToken && credentials?.mfaMethod) {
          console.log("🔐 [Credentials] MFA verification attempt:", credentials.mfaMethod);
          console.log("🔐 [Credentials] MFA credentials:", {
            email: credentials.email,
            mfaCode: credentials.mfaCode?.substring(0, 2) + "****",
            tempToken: credentials.tempToken?.substring(0, 20) + "...",
            mfaMethod: credentials.mfaMethod,
          });
          try {
            let endpoint = "";
            const payload: any = {
              email: credentials.email,
              code: credentials.mfaCode,
              temp_token: credentials.tempToken,
            };

            // Determine endpoint based on method
            if (credentials.mfaMethod === "totp") {
              endpoint = "/api/v1/auth/mfa/verify-totp";
            } else if (credentials.mfaMethod === "email") {
              endpoint = "/api/v1/auth/mfa/verify-email-otp";
            } else if (credentials.mfaMethod === "backup") {
              endpoint = "/api/v1/auth/mfa/verify-backup-code";
            } else {
              console.error("🔴 [Credentials] Invalid MFA method:", credentials.mfaMethod);
              throw new Error("Invalid MFA method");
            }

            console.log("🔐 [Credentials] Calling MFA endpoint:", endpoint);
            console.log("🔐 [Credentials] Payload:", {
              email: payload.email,
              code: payload.code?.substring(0, 2) + "****",
              temp_token: payload.temp_token?.substring(0, 20) + "...",
            });

            const response = await fastApiClient.post(endpoint, payload);
            
            console.log("🔐 [Credentials] MFA verification response:", {
              status: response.status,
              data: response.data,
            });
            
            const data = response.data?.data;

            if (!data?.accessToken || !data?.user) {
              console.error("🔴 [Credentials] Invalid MFA verification response");
              console.error("🔴 [Credentials] Response data:", data);
              return null;
            }

            const backendUser: BackendUser = {
              id: data.user.id,
              name: data.user.name,
              email: data.user.email,
              role: data.user.role,
              organization: data.user.organization,
              phone: data.user.phone || undefined,
              country: data.user.country || undefined,
              token: data.accessToken,
              refreshToken: data.refreshToken,
            } as BackendUser;

            console.log("✅ [Credentials] MFA verification successful");
            return backendUser;
          } catch (err: any) {
            console.error("🔴 [Credentials] MFA verification failed:", err?.response?.data?.detail || err?.message);
            console.error("🔴 [Credentials] Full error:", {
              message: err?.message,
              response: err?.response?.data,
              status: err?.response?.status,
              code: err?.code,
            });
            throw new Error(err?.response?.data?.detail || "Invalid MFA code");
          }
        }

        // CASE 4: Initial login (email + password)
        if (!credentials?.email || !credentials?.password) {
          return null;
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

          console.log("🔐 [Credentials] /api/v1/auth/login response:", {
            status: response?.status,
            data: response?.data,
          });

          const respData = response?.data;
          const data = respData?.data ?? respData;

          // Check if MFA setup is required (org_admin first login)
          const requireMFASetup = data?.requireMFASetup || respData?.requireMFASetup;
          if (requireMFASetup === true) {
            console.log("🔐 [Credentials] MFA setup required");
            const mfaSetupToken = data?.mfaSetupToken || respData?.mfaSetupToken;
            const email = data?.email || respData?.email || credentials.email;
            throw new Error(`MFA_SETUP_REQUIRED:${email}:${mfaSetupToken}`);
          }

          // Check if MFA verification is required (org_admin with MFA enabled)
          const requireMFA = data?.requireMFA || respData?.requireMFA;
          if (requireMFA === true) {
            console.log("🔐 [Credentials] MFA verification required");
            const tempToken = data?.tempToken || respData?.tempToken;
            const email = data?.email || respData?.email || credentials.email;
            throw new Error(`MFA_REQUIRED:${email}:${tempToken}`);
          }

          // Check if MFA is required for super_admin
          const requireMfa = data?.require_mfa ?? respData?.require_mfa;
          if (requireMfa === true) {
            console.log("🔐 [Credentials] MFA required for super admin");
            throw new Error("MFA_REQUIRED");
          }

          // Check if password reset is required
          const requirePasswordReset = data?.requirePasswordReset || respData?.requirePasswordReset;
          if (requirePasswordReset === true) {
            const resetToken = data?.resetToken || respData?.resetToken;
            throw new Error(`PASSWORD_RESET_REQUIRED:${resetToken}`);
          }
          
          // Normal login success
          const token = data?.token ?? data?.accessToken ?? respData?.token ?? respData?.accessToken;
          const userObj = data?.user ?? respData?.user ?? (data?.userId ? { id: data.userId, email: data.email, name: data.name } : null);

          if (!token || !userObj) {
            console.error("🔴 [Credentials] Invalid response from authentication service");
            return null;
          }

          const userId = userObj.id ?? userObj._id ?? userObj.userId;
          
          if (!userId) {
            console.error("🔴 [Credentials] User object missing 'id' field");
            return null;
          }

          const backendUser: BackendUser = {
            id: String(userId),
            name: userObj.name,
            email: userObj.email,
            role: userObj.role,
            organization: userObj.organization,
            phone: userObj.phone || undefined,
            country: userObj.country || undefined,
            token: token,
            refreshToken: data?.refreshToken ?? respData?.refreshToken ?? data?.refresh_token ?? respData?.refresh_token,
          } as BackendUser;

          console.log("✅ [Credentials] Login successful");
          return backendUser;
        } catch (error: any) {
          // Pass through our custom errors
          if (error?.message?.startsWith("MFA_SETUP_REQUIRED:") ||
              error?.message?.startsWith("MFA_REQUIRED:") ||
              error?.message?.startsWith("PASSWORD_RESET_REQUIRED:") ||
              error?.message === "MFA_REQUIRED") {
            throw error;
          }

          // Check for connection errors
          if (error?.code === "ECONNREFUSED" || error?.code === "ENOTFOUND" || error?.message?.includes("not found")) {
            console.error("Backend server connection error");
            return null;
          }

          console.error("Credentials authentication error:", {
            message: error?.message,
            response: error?.response?.data,
          });

          const errorMessage = 
            error?.response?.data?.detail || 
            error?.response?.data?.message || 
            error?.message || 
            "Invalid email or password";

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
