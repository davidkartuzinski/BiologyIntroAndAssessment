import type { Assistance, ReviewOutcome } from "./logic.ts";

/**
 * One mapping from review state to label and style, used everywhere a status
 * is shown. Colours always come with a text label, so colour is never the only cue.
 */
export type ReviewState = ReviewOutcome | "awaiting_review" | "draft" | "not_started" | "superseded";

export const reviewStateLabel: Record<ReviewState, string> = {
  clear: "Clear",
  developing: "Developing",
  revisit: "Revisit",
  not_assessed: "Not assessed",
  reflection_noted: "Reflection noted",
  awaiting_review: "Submitted — awaiting review",
  draft: "Draft saved, not submitted",
  not_started: "Not started",
  superseded: "Superseded",
};

/** Dark text on light backgrounds with a border; meets WCAG AA contrast in light and dark themes. */
export const reviewStateClass: Record<ReviewState, string> = {
  clear: "border-green-700 bg-green-100 text-green-950 dark:bg-green-200",
  developing: "border-yellow-600 bg-yellow-100 text-yellow-950 dark:bg-yellow-200",
  revisit: "border-orange-600 bg-orange-100 text-orange-950 dark:bg-orange-200",
  not_assessed: "border-gray-400 bg-gray-100 text-gray-900 dark:bg-gray-200",
  reflection_noted: "border-violet-600 bg-violet-100 text-violet-950 dark:bg-violet-200",
  // Awaiting review is deliberately different from "Not assessed" (a recorded outcome).
  awaiting_review: "border-sky-700 border-dashed bg-sky-50 text-sky-950 dark:bg-sky-200",
  draft: "border-gray-400 border-dashed bg-transparent text-foreground",
  not_started: "border-transparent bg-transparent text-muted-foreground",
  superseded: "border-gray-300 bg-transparent text-muted-foreground",
};

export const supportLabel: Record<Assistance, string> = {
  I: "Independent",
  N: "Used notes or dictionary",
  H: "Discussed with someone",
};

export function describeSupport(value: Assistance | null | undefined) {
  return value ? `${supportLabel[value]} (${value})` : "Not recorded";
}

/**
 * Human reviews on the learner's latest attempts that she has not opened yet.
 * Reviews of superseded attempts never count as new.
 */
export function unreadReviewIds(
  latestAttempts: { humanReviews: { id: string; reviewedAt: string }[] }[],
  seen: Set<string>,
): string[] {
  return latestAttempts.flatMap((attempt) => {
    const newest = [...attempt.humanReviews].sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))[0];
    return newest && !seen.has(newest.id) ? [newest.id] : [];
  });
}
