/**
 * Pure role parsing. The role comes only from Clerk *public* metadata, which
 * users cannot edit themselves (only the dashboard or the backend API can).
 * Anything missing or unrecognised is treated as no role: never reviewer.
 */
export type Role = "learner" | "reviewer";

export function parseRole(publicMetadata: unknown): Role | null {
  if (!publicMetadata || typeof publicMetadata !== "object") return null;
  const role = (publicMetadata as Record<string, unknown>).role;
  return role === "learner" || role === "reviewer" ? role : null;
}
