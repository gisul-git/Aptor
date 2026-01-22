// ============================================================================
// Universal Proctoring System - User ID Resolution
// ============================================================================
//
// Provides consistent userId resolution for proctoring logs across all take pages.
// Priority: session.user.id > urlParam > "email:<email>" > "public:<token>" > "anonymous"
//
// Email is preferred over token to ensure consistent userId format for analytics.
// This ensures proctoring logs are written with identifiers that analytics pages
// can query using MongoDB ObjectId or predictable fallback formats.
//
// ============================================================================

/**
 * Resolve userId for proctoring session with consistent priority order.
 * 
 * @param session - Next-auth session object (may be null/undefined)
 * @param fallbacks - Fallback identifiers (email, token, etc.)
 * @returns Resolved userId string for proctoring logs
 * 
 * @example
 * ```typescript
 * import { resolveUserIdForProctoring } from '@/universal-proctoring/utils/resolveUserId'
 * 
 * const userId = resolveUserIdForProctoring(session, {
 *   email: candidateEmail,
 *   token: assessmentToken,
 *   urlParam: router.query.userId as string,
 * })
 * 
 * startProctoring({
 *   session: { userId, assessmentId },
 *   // ...
 * })
 * ```
 */
export function resolveUserIdForProctoring(
  session: { user?: { id?: string } } | null | undefined,
  fallbacks: {
    email?: string | null;
    token?: string | null;
    urlParam?: string | null;
  } = {}
): string {
  // Priority 1: Authenticated user (MongoDB ObjectId)
  if (session?.user?.id) {
    console.log('[Proctoring] Using session.user.id:', session.user.id);
    return session.user.id;
  }

  // Priority 2: URL parameter (admin-provided userId)
  if (fallbacks.urlParam && fallbacks.urlParam.trim()) {
    console.log('[Proctoring] Using URL param userId:', fallbacks.urlParam);
    return fallbacks.urlParam.trim();
  }

  // Priority 3: Email-based identifier (preferred over token for analytics consistency)
  if (fallbacks.email && fallbacks.email.trim()) {
    const emailUserId = `email:${fallbacks.email.trim()}`;
    console.log('[Proctoring] Using email identifier:', emailUserId);
    return emailUserId;
  }

  // Priority 4: Public token-based access (fallback when email not available)
  if (fallbacks.token && fallbacks.token.trim()) {
    const tokenUserId = `public:${fallbacks.token.trim()}`;
    console.log('[Proctoring] Using public token:', tokenUserId);
    return tokenUserId;
  }

  // Fallback: Anonymous
  console.warn('[Proctoring] No valid userId found, using anonymous');
  return 'anonymous';
}
