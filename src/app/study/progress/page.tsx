import { ProgressTable } from "@/components/attempts/progress-table";
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
          <p>
            {progress.summary.submitted} of {progress.summary.total} questions submitted · {progress.summary.reviewed} reviewed ·{" "}
            {progress.summary.awaitingReview} awaiting review
            {progress.summary.anotherAttemptSuggested ? ` · ${progress.summary.anotherAttemptSuggested} with another attempt suggested` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            “Reviewed” records David’s outcome; it does not by itself mean mastered. Total attempts submitted: {progress.summary.totalAttempts}.
          </p>
          <ProgressTable rows={progress.rows} assessmentHref={assessmentHref(unit.id)} />
        </>
      ) : (
        <p>{progress.message}</p>
      )}
    </PageShell>
  );
}
