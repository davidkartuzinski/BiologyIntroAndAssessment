import { reviewStateClass, reviewStateLabel, type ReviewState } from "@/lib/attempts/review-status";
import { cn } from "@/lib/utils";

/** Shared status badge: same colours and labels on every page. */
export function ReviewStatusBadge({ state, prefix, className }: { state: ReviewState; prefix?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-sm font-medium", reviewStateClass[state], className)}>
      {prefix}
      {reviewStateLabel[state]}
    </span>
  );
}

/** Highlights the review result only, never the learner's own answer. */
export function ReviewResultPanel({
  outcome,
  reviewerName,
  reviewedAt,
  comments,
  title = "Review",
  renderComments,
}: {
  outcome: ReviewState;
  reviewerName: string;
  reviewedAt: string;
  comments: string | null;
  title?: string;
  /** Learner pages pass the glossary linker here; text is unchanged. */
  renderComments?: (text: string) => React.ReactNode;
}) {
  return (
    <section className={cn("space-y-1 rounded-lg border-2 p-3", reviewStateClass[outcome])} aria-label={title}>
      <p className="font-semibold">Outcome: {reviewStateLabel[outcome]}</p>
      <p className="text-sm">
        Reviewed by {reviewerName} · <time dateTime={reviewedAt}>{new Date(reviewedAt).toLocaleString()}</time>
      </p>
      {comments ? <p className="whitespace-pre-wrap pt-1">{renderComments ? renderComments(comments) : comments}</p> : null}
    </section>
  );
}
