/**
 * JWT utility functions for token expiration checking
 */

interface JWTPayload {
  exp?: number;
  iat?: number;
  sub?: string;
  role?: string;
  type?: string;
  [key: string]: any;
}

/**
 * Decode JWT token without verification (client-side only)
 * Note: This is for checking expiration only, not for security validation
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded) as JWTPayload;
  } catch (error) {
    console.error("Failed to decode JWT:", error);
    return null;
  }
}

/**
 * Check if token is expired or will expire soon
 * @param token JWT token string
 * @param bufferMinutes Minutes before expiration to consider token as "expiring soon" (default: 5)
 * @returns Object with isExpired, isExpiringSoon, expiresAt
 */
export function checkTokenExpiration(
  token: string | null | undefined,
  bufferMinutes: number = 5
): {
  isExpired: boolean;
  isExpiringSoon: boolean;
  expiresAt: number | null;
  timeUntilExpiry: number | null;
} {
  if (!token) {
    return {
      isExpired: true,
      isExpiringSoon: true,
      expiresAt: null,
      timeUntilExpiry: null,
    };
  }

  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return {
      isExpired: true,
      isExpiringSoon: true,
      expiresAt: null,
      timeUntilExpiry: null,
    };
  }

  const expiresAt = payload.exp * 1000; // Convert to milliseconds
  const now = Date.now();
  const timeUntilExpiry = expiresAt - now;
  const bufferMs = bufferMinutes * 60 * 1000;

  return {
    isExpired: timeUntilExpiry <= 0,
    isExpiringSoon: timeUntilExpiry > 0 && timeUntilExpiry <= bufferMs,
    expiresAt,
    timeUntilExpiry,
  };
}

/**
 * Get time until token expires in minutes
 */
export function getMinutesUntilExpiry(token: string | null | undefined): number | null {
  const { timeUntilExpiry } = checkTokenExpiration(token);
  if (timeUntilExpiry === null || timeUntilExpiry <= 0) {
    return null;
  }
  return Math.floor(timeUntilExpiry / (60 * 1000));
}

