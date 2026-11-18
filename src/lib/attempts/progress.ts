import { statusLabel, type ReviewOutcome } from "./logic.ts";

/**
 * Question-level review state. The latest *submitted* attempt for a learner
 * and question decides the status. Earlier attempts are history only
 * ("superseded"); they are never deleted and never given artificial reviews.
 */

type QuestionLike = { id: string; number: number; title: string; isReflection: boolean };
export type AttemptLike = {
  id: string;
  learnerId: string;
  questionId: string;
  attemptNumber: number;
  submittedAt: string;
  humanReviews: { outcome: ReviewOutcome; reviewedAt: string }[];
};

/** Outcomes where the reviewer is asking for another attempt. */
const NEEDS_ANOTHER_ATTEMPT: ReviewOutcome[] = ["developing", "revisit", "not_assessed"];

export function latestReview(attempt: AttemptLike) {
  return [...attempt.humanReviews].sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))[0] ?? null;
}

/** Groups attempts by learner and question and returns the latest of each group. */
export function latestAttempts<T extends AttemptLike>(attempts: T[]): T[] {
  const latest = new Map<string, T>();
  for (const attempt of attempts) {
    const key = `${attempt.learnerId}\u0000${attempt.questionId}`;
    const current = latest.get(key);
    if (!current || attempt.attemptNumber > current.attemptNumber) latest.set(key, attempt);
  }
  return [...latest.values()];
}

/** The attempt number that supersedes this one, or null if it is the latest. */
export function supersededBy(attempt: AttemptLike, all: AttemptLike[]): number | null {
  const newest = all
    .filter((other) => other.learnerId === attempt.learnerId && other.questionId === attempt.questionId)
    .reduce((max, other) => Math.max(max, other.attemptNumber), 0);
  return newest > attempt.attemptNumber ? newest : null;
}

export type QueueItem<T extends AttemptLike> = { latest: T; attemptCount: number; pending: boolean; outcome: ReviewOutcome | null };

/** One item per learner and question, pointing at the latest submitted attempt. */
export function reviewQueueItems<T extends AttemptLike>(attempts: T[]): QueueItem<T>[] {
  return latestAttempts(attempts)
    .map((latest) => {
      const review = latestReview(latest);
      return {
        latest,
        attemptCount: attempts.filter((a) => a.learnerId === latest.learnerId && a.questionId === latest.questionId).length,
        pending: review === null,
        outcome: review?.outcome ?? null,
      };
    })
    .sort((a, b) => b.latest.submittedAt.localeCompare(a.latest.submittedAt));
}

export type QuestionState = "not_started" | "draft" | "awaiting_review" | "reviewed";

export type QuestionProgress = {
  questionId: string;
  number: number;
  title: string;
  isReflection: boolean;
  attempts: number;
  latestAttemptNumber: number | null;
  state: QuestionState;
  outcome: ReviewOutcome | null;
  anotherAttemptSuggested: boolean;
  label: string;
  lastSubmittedAt: string | null;
};

export function questionProgress(questions: QuestionLike[], attempts: AttemptLike[], draftQuestionIds: Set<string> = new Set()): QuestionProgress[] {
  return questions.map((question) => {
    const own = attempts.filter((attempt) => attempt.questionId === question.id);
    const latest = own.reduce<AttemptLike | null>((max, attempt) => (!max || attempt.attemptNumber > max.attemptNumber ? attempt : max), null);
    const base = { questionId: question.id, number: question.number, title: question.title, isReflection: question.isReflection, attempts: own.length };
    if (!latest) {
      // A draft never counts as a submission.
      const draft = draftQuestionIds.has(question.id);
      return { ...base, latestAttemptNumber: null, state: draft ? "draft" : "not_started", outcome: null, anotherAttemptSuggested: false, label: draft ? "Draft saved, not submitted" : "Not started", lastSubmittedAt: null };
    }
    const review = latestReview(latest);
    if (!review) {
      return { ...base, latestAttemptNumber: latest.attemptNumber, state: "awaiting_review", outcome: null, anotherAttemptSuggested: false, label: statusLabel.awaiting_feedback, lastSubmittedAt: latest.submittedAt };
    }
    const again = NEEDS_ANOTHER_ATTEMPT.includes(review.outcome);
    return {
      ...base,
      latestAttemptNumber: latest.attemptNumber,
      state: "reviewed",
      outcome: review.outcome,
      anotherAttemptSuggested: again,
      label: `Reviewed: ${statusLabel[review.outcome]}${again ? " — another attempt suggested" : ""}`,
      lastSubmittedAt: latest.submittedAt,
    };
  });
}

export function progressSummary(rows: QuestionProgress[]) {
  return {
    total: rows.length,
    submitted: rows.filter((row) => row.state === "awaiting_review" || row.state === "reviewed").length,
    awaitingReview: rows.filter((row) => row.state === "awaiting_review").length,
    reviewed: rows.filter((row) => row.state === "reviewed").length,
    anotherAttemptSuggested: rows.filter((row) => row.anotherAttemptSuggested).length,
    totalAttempts: rows.reduce((sum, row) => sum + row.attempts, 0),
  };
}

/** Reviews may only be saved against the latest submitted attempt. */
export function canReviewAttempt(attempt: AttemptLike, all: AttemptLike[]): { ok: true } | { ok: false; latestAttemptNumber: number } {
  const newer = supersededBy(attempt, all);
  return newer === null ? { ok: true } : { ok: false, latestAttemptNumber: newer };
}
