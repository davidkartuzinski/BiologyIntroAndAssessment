import { MarkFeedbackSeen } from "@/components/attempts/mark-seen";
import { ProgressTable } from "@/components/attempts/progress-table";
import { ReviewResultPanel } from "@/components/attempts/review-status";
import { FreshOnShow } from "@/components/fresh-on-show";
import { PageShell } from "@/components/page-shell";
import { getViewer } from "@/lib/auth/viewer";
import { learnerProgress } from "@/lib/attempts/learner-progress";
import { assessmentHref, getCourse } from "@/lib/content";

export default async function ProgressPage() {
  const viewer = await getViewer();
  const unit = getCourse().units[0];
  const progress = await learnerProgress(viewer, unit);
  return (
    <PageShell
      title="Progress"
      intro="Based on answers you have submitted and reviews David has recorded. Opening a lesson does not count as understanding."
    >
      <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
        This shows the introductory pilot only. It does not estimate readiness for the full IGCSE examination.
      </p>
      {progress.ok ? (
        <>
          <FreshOnShow />
          <p>
            {progress.summary.submitted} of {progress.summary.total} questions submitted · {progress.summary.reviewed} reviewed ·{" "}
            {progress.summary.awaitingReview} awaiting review
            {progress.summary.anotherAttemptSuggested ? ` · ${progress.summary.anotherAttemptSuggested} with another attempt suggested` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            “Reviewed” records David’s outcome; it does not by itself mean mastered. Total attempts submitted: {progress.summary.totalAttempts}.
          </p>
          <ProgressTable
            rows={progress.rows}
            assessmentHref={assessmentHref(unit.id)}
            unread={progress.unread ?? []}
            reviewIdByQuestion={new Map([...progress.latestReviews].map(([questionId, review]) => [questionId, review.id]))}
          />
          {progress.latestReviews.size > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Latest feedback</h2>
              {progress.rows
                .filter((row) => progress.latestReviews.has(row.questionId))
                .map((row) => {
                  const review = progress.latestReviews.get(row.questionId)!;
                  return (
                    <div key={row.questionId} className="space-y-1">
                      <h3 className="font-medium">
                        Question {row.number}: {row.title} (attempt {review.attemptNumber})
                      </h3>
                      <ReviewResultPanel outcome={review.outcome} reviewerName={review.reviewerName} reviewedAt={review.reviewedAt} comments={review.comments} />
                    </div>
                  );
                })}
              <MarkFeedbackSeen reviewIds={progress.unread ?? []} />
            </section>
          ) : null}
        </>
      ) : (
        <p>{progress.message}</p>
      )}
    </PageShell>
  );
}
