import { auth, currentUser } from "@clerk/nextjs/server";
import { BookA, ChartNoAxesColumn, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { parseRole } from "@/lib/auth/roles";
import { reviewQueueItems } from "@/lib/attempts/progress";
import { unreadReviewIds } from "@/lib/attempts/review-status";
import { getSeenReviewIds, listOwnAttempts, reviewQueue } from "@/lib/attempts/store";
import { latestAttempts } from "@/lib/attempts/progress";
import { isSupabaseConfigured } from "@/lib/supabase/server";

function CountBadge({ count, description }: { count: number; description: string }) {
  if (count <= 0) return null;
  return (
    <SidebarMenuBadge className="rounded-full bg-primary px-1.5 text-primary-foreground">
      <span aria-hidden>{count}</span>
      <span className="sr-only">{description}</span>
    </SidebarMenuBadge>
  );
}

/**
 * Role-dependent navigation with live counts. Convenience only: the pages
 * themselves enforce access. Counts follow the latest-attempt rules.
 */
export async function RoleNavLinks() {
  const { userId } = await auth();
  if (!userId) return null;
  const role = parseRole((await currentUser())?.publicMetadata);
  const configured = isSupabaseConfigured();

  let pending = 0;
  let unread = 0;
  if (configured && role === "reviewer") {
    pending = await reviewQueue(userId).then((attempts) => reviewQueueItems(attempts).filter((item) => item.pending).length).catch(() => 0);
  }
  if (configured && role === "learner") {
    unread = await Promise.all([listOwnAttempts(userId), getSeenReviewIds(userId)])
      .then(([attempts, seen]) => (seen ? unreadReviewIds(latestAttempts(attempts), seen).length : 0))
      .catch(() => 0);
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip="Progress">
          <Link href="/study/progress">
            <ChartNoAxesColumn />
            <span>Progress</span>
          </Link>
        </SidebarMenuButton>
        <CountBadge count={unread} description={`${unread} new review${unread === 1 ? "" : "s"} to read`} />
      </SidebarMenuItem>
      {role === "reviewer" ? (
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip="Review queue">
            <Link href="/study/review">
              <ClipboardCheck />
              <span>Review queue</span>
            </Link>
          </SidebarMenuButton>
          <CountBadge count={pending} description={`${pending} question${pending === 1 ? "" : "s"} awaiting review`} />
        </SidebarMenuItem>
      ) : null}
      {role === "reviewer" ? (
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip="Manage the glossary">
            <Link href="/study/review/glossary">
              <BookA />
              <span>Glossary</span>
              <span className="sr-only"> (manage definitions)</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ) : null}
    </SidebarMenu>
  );
}
