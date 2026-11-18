import Link from "next/link";
import { DemoBanner } from "@/components/demo-banner";
import { PageShell } from "@/components/page-shell";
import { ReviewStatusBadge } from "@/components/attempts/review-status";
import { FreshOnShow } from "@/components/fresh-on-show";
import { Button } from "@/components/ui/button";
import { assessmentHref, getCourse, sectionHref, unitHref } from "@/lib/content";
import { getServiceStatus } from "@/lib/env/services";
import { getViewer } from "@/lib/auth/viewer";
import { learnerProgress } from "@/lib/attempts/learner-progress";
import { reviewQueueItems } from "@/lib/attempts/progress";
import { reviewQueue } from "@/lib/attempts/store";

export default async function DashboardPage() {
  const viewer = await getViewer();
  const course = getCourse();
  const unit = course.units[0];
  const status = getServiceStatus();
  const progress = await learnerProgress(viewer, unit);
  const awaitingReview =
    viewer.role === "reviewer" && status.supabase
      ? await reviewQueue(viewer.userId)
          .then((attempts) => reviewQueueItems(attempts).filter((item) => item.pending).length)
          .catch(() => null)
      : null;

  return (
    <PageShell eyebrow={course.qualification} title="Dashboard">
      <DemoBanner />
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-xl font-semibold">Next study step</h2>
        <p>
          Start with {unit.subtitle.toLowerCase()}, Section {unit.sections[0].letter}: {unit.sections[0].title}
        </p>
        <p className="text-sm text-muted-foreground">
          Lessons can be studied in any order; this suggests the first section.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={sectionHref(unit.id, unit.sections[0].id)}>Open Section {unit.sections[0].letter}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={unitHref(unit.id)}>Unit overview</Link>
          </Button>
        </div>
      </section>
      {viewer.role === "reviewer" ? (
        <section className="space-y-3 rounded-xl border-2 border-sky-700 bg-sky-50 p-5 text-sky-950 dark:bg-sky-200" aria-labelledby="awaiting-heading">
          <h2 id="awaiting-heading" className="text-xl font-semibold">Awaiting review</h2>
          {awaitingReview === null ? (
            <p>The queue count is unavailable right now.</p>
          ) : awaitingReview === 0 ? (
            <p>No submissions awaiting review.</p>
          ) : (
            <p className="text-lg font-semibold">
              {awaitingReview} question{awaitingReview === 1 ? "" : "s"} from Lauren awaiting review
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href="/study/review">Open the review queue</Link>
            </Button>
            <FreshOnShow label="Check for new submissions" />
          </div>
        </section>
      ) : null}
      {progress.ok ? (
        <section className="space-y-3 rounded-xl border p-5">
          <h2 className="text-xl font-semibold">Your progress</h2>
          <p>
            {progress.summary.submitted} of {progress.summary.total} questions submitted
          </p>
          <ul className="flex flex-wrap gap-2" aria-label="Question status counts">
            <li><ReviewStatusBadge state="awaiting_review" prefix={`${progress.summary.awaitingReview} · `} /></li>
            {(["clear", "developing", "revisit", "not_assessed", "reflection_noted"] as const).map((outcome) => {
              const count = progress.rows.filter((row) => row.state === "reviewed" && row.outcome === outcome).length;
              return count ? <li key={outcome}><ReviewStatusBadge state={outcome} prefix={`${count} · Reviewed: `} /></li> : null;
            })}
          </ul>
          {progress.unread?.length ? (
            <p className="font-medium">
              You have {progress.unread.length} new review{progress.unread.length === 1 ? "" : "s"} to read.
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">You can keep studying while answers await review.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/study/progress" className="underline underline-offset-4">See progress and feedback</Link>
            <FreshOnShow />
          </div>
        </section>
      ) : null}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{unit.title}</h2>
        <ol className="space-y-1">
          {unit.sections.map((section) => (
            <li key={section.id}>
              <Link className="underline underline-offset-4" href={sectionHref(unit.id, section.id)}>
                Section {section.letter}: {section.title}
              </Link>
            </li>
          ))}
          <li>
            <Link className="underline underline-offset-4" href={assessmentHref(unit.id)}>
              {unit.assessment.title}
            </Link>
          </li>
        </ol>
      </section>
      <section className="space-y-2 rounded-xl border p-5 text-sm">
        <h2 className="text-base font-semibold">Pilot status</h2>
        <p>Only the introductory unit is loaded. Full-course scheduling is not available yet, and nothing here predicts exam readiness.</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Saving answers: {status.supabase ? "connected" : "not connected"}</li>
          <li>AI tutor and AI feedback: deferred</li>
          <li>Email: off (not built yet)</li>
        </ul>
      </section>
    </PageShell>
  );
}
