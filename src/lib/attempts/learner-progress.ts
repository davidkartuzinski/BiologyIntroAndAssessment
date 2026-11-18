import "server-only";

import type { Unit } from "@/content/schema.ts";
import type { Viewer } from "@/lib/auth/viewer";
import { latestAttempts, progressSummary, questionProgress } from "@/lib/attempts/progress";
import { unreadReviewIds } from "@/lib/attempts/review-status";
import { StoreError, getDrafts, getSeenReviewIds, listOwnAttempts, reviewerNames, type AttemptSummary } from "@/lib/attempts/store";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export type LatestReview = { id: string; outcome: AttemptSummary["humanReviews"][number]["outcome"]; reviewedAt: string; comments: string | null; reviewerName: string; attemptNumber: number };

export type LearnerProgress =
  | {
      ok: true;
      rows: ReturnType<typeof questionProgress>;
      summary: ReturnType<typeof progressSummary>;
      /** Review on each question's latest attempt, if any. */
      latestReviews: Map<string, LatestReview>;
      /** Unseen review ids, or null when unread tracking (migration 0004) is not set up. */
      unread: string[] | null;
    }
  | { ok: false; message: string };

/** Everything learner pages need about review state, computed once from the latest submitted attempts. */
export async function learnerProgress(viewer: Viewer, unit: Unit): Promise<LearnerProgress> {
  if (viewer.role !== "learner") return { ok: false, message: "Progress is shown for the learner account." };
  if (!isSupabaseConfigured()) return { ok: false, message: "Demo mode: progress is not recorded until saving is connected." };
  try {
    const [attempts, drafts, seen] = await Promise.all([listOwnAttempts(viewer.userId), getDrafts(viewer.userId), getSeenReviewIds(viewer.userId)]);
    const draftIds = new Set(
      [...drafts.values()].filter((draft) => draft.answer.text || Object.values(draft.answer.parts).some(Boolean)).map((draft) => draft.questionId),
    );
    const rows = questionProgress(unit.assessment.questions, attempts, draftIds);
    const latest = latestAttempts(attempts);
    const names = await reviewerNames(latest.flatMap((attempt) => attempt.humanReviews.map((review) => review.reviewerId)));
    const latestReviews = new Map<string, LatestReview>();
    for (const attempt of latest) {
      const review = attempt.humanReviews[0]; // already sorted newest first
      if (review) {
        latestReviews.set(attempt.questionId, {
          id: review.id,
          outcome: review.outcome,
          reviewedAt: review.reviewedAt,
          comments: review.comments,
          reviewerName: names.get(review.reviewerId) ?? "your reviewer",
          attemptNumber: attempt.attemptNumber,
        });
      }
    }
    return { ok: true, rows, summary: progressSummary(rows), latestReviews, unread: seen ? unreadReviewIds(latest, seen) : null };
  } catch (error) {
    return { ok: false, message: error instanceof StoreError ? error.message : "Progress could not be loaded." };
  }
}
