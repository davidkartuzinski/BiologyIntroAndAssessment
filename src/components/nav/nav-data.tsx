import { auth, currentUser } from "@clerk/nextjs/server";
import { StudyNav } from "@/components/nav/study-nav";
import { parseRole } from "@/lib/auth/roles";
import { latestAttempts, reviewQueueItems } from "@/lib/attempts/progress";
import { unreadReviewIds } from "@/lib/attempts/review-status";
import { getSeenReviewIds, listOwnAttempts, reviewQueue } from "@/lib/attempts/store";
import { isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Server side of the sidebar: the verified role and live counts.
 * Visibility only mirrors page permissions; the pages enforce access.
 */
export async function NavData() {
  const { userId } = await auth();
  const role = userId ? parseRole((await currentUser())?.publicMetadata) : null;
  const configured = isSupabaseConfigured();
  let pending = 0;
  let unread = 0;
  if (userId && configured && role === "reviewer") {
    pending = await reviewQueue(userId).then((attempts) => reviewQueueItems(attempts).filter((item) => item.pending).length).catch(() => 0);
  }
  if (userId && configured && role === "learner") {
    unread = await Promise.all([listOwnAttempts(userId), getSeenReviewIds(userId)])
      .then(([attempts, seen]) => (seen ? unreadReviewIds(latestAttempts(attempts), seen).length : 0))
      .catch(() => 0);
  }
  return <StudyNav role={role} counts={{ "pending-review": pending, "unread-feedback": unread }} />;
}
