export const WORKSPACE_SESSION_MS = 24 * 60 * 60 * 1000;

// Supabase preserves the authentication timestamp when it refreshes access tokens.
export function workspaceSession(accessToken: string) {
 try {
  const payload = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  const timestamps = Array.isArray(payload.amr) ? payload.amr.map((entry: { timestamp?: unknown }) => entry?.timestamp).filter((value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0) : [];
  if (typeof payload.session_id !== 'string' || !payload.session_id || !timestamps.length) return null;
  return { id: payload.session_id, expiresAt: Math.min(...timestamps) * 1000 + WORKSPACE_SESSION_MS };
 } catch { return null; }
}
