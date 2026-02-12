import "next-auth";

declare module "next-auth" {
  interface Session {
    backendToken?: string;
    provider?: string;
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      role?: string;
      organization?: string | null;
      phone?: string | null;
      country?: string | null;
    };
  }

  interface User {
    id: string;
    token?: string;
    role?: string;
    organization?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    backendToken?: string;
    role?: string;
    organization?: string | null;
    phone?: string | null;
    country?: string | null;
    provider?: string;
  }
}
