import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { forbidden } from "next/navigation";
import { parseRole, type Role } from "@/lib/auth/roles";

export type Viewer = { userId: string; role: Role | null };

/**
 * Server-side identity. The user id comes from the verified Clerk session;
 * the role is read fresh from Clerk's backend (currentUser), so a role change
 * in the dashboard applies on the next request with no token configuration.
 */
export async function getViewer(): Promise<Viewer> {
  const { userId } = await auth.protect();
  const user = await currentUser();
  return { userId, role: user ? parseRole(user.publicMetadata) : null };
}

export async function requireRole(role: Role): Promise<Viewer> {
  const viewer = await getViewer();
  if (viewer.role !== role) forbidden();
  return viewer;
}
