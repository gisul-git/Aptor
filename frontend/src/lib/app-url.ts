/**
 * Frontend base URL from .env (NEXTAUTH_URL).
 * Used for auth redirects and links so deployed domain is used instead of localhost.
 */

export function getFrontendBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const fromEnv = process.env.NEXTAUTH_URL;
    if (fromEnv) return fromEnv.replace(/\/$/, '');
    return window.location.origin;
  }
  return process.env.NEXTAUTH_URL || '';
}
