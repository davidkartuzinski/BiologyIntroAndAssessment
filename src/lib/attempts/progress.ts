import { statusLabel, type DisplayStatus } from "./logic.ts";

type QuestionLike = { id: string; number: number; title: string; isReflection: boolean };
type AttemptLike = { questionId: string; attemptNumber: number; submittedAt: string; humanReviews: unknown[]; status: DisplayStatus };

export type QuestionProgress = {
  questionId: string;
  number: number;
  title: string;
  isReflection: boolean;
  attempts: number;
  state: "not_started" | "awaiting_review" | "reviewed";
  label: string;
  lastSubmittedAt: string | null;
};

/** Progress from actual submissions and recorded human reviews only. */
export function questionProgress(questions: QuestionLike[], attempts: AttemptLike[]): QuestionProgress[] {
  return questions.map((question) => {
    const own = attempts.filter((attempt) => attempt.questionId === question.id).sort((a, b) => b.attemptNumber - a.attemptNumber);
    const latest = own[0];
    if (!latest) {
      return { questionId: question.id, number: question.number, title: question.title, isReflection: question.isReflection, attempts: 0, state: "not_started", label: "Not started", lastSubmittedAt: null };
    }
    const reviewed = latest.humanReviews.length > 0 && latest.status.source === "human";
    return {
      questionId: question.id,
      number: question.number,
      title: question.title,
      isReflection: question.isReflection,
      attempts: own.length,
      state: reviewed ? "reviewed" : "awaiting_review",
      label: reviewed ? `Reviewed: ${statusLabel[latest.status.status]}` : statusLabel.awaiting_feedback,
      lastSubmittedAt: latest.submittedAt,
    };
  });
}

export function progressSummary(rows: QuestionProgress[]) {
  return {
    total: rows.length,
    submitted: rows.filter((row) => row.state !== "not_started").length,
    awaitingReview: rows.filter((row) => row.state === "awaiting_review").length,
    reviewed: rows.filter((row) => row.state === "reviewed").length,
  };
}
