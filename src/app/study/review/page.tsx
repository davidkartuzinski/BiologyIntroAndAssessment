import Link from "next/link";
import { StatusBadge } from "@/components/attempts/attempt-history";
import { PageShell } from "@/components/page-shell";
import { requireRole } from "@/lib/auth/viewer";
import { StoreError, reviewQueue } from "@/lib/attempts/store";
import { findQuestion } from "@/lib/content/questions";

export default async function ReviewQueuePage() {
  const viewer = await requireRole("reviewer");
  let attempts: Awaited<ReturnType<typeof reviewQueue>> = [];
  let problem: string | null = null;
  try {
    attempts = await reviewQueue(viewer.userId);
  } catch (error) {
    problem = error instanceof StoreError ? error.message : "The queue could not be loaded.";
  }
  const awaiting = attempts.filter((attempt) => attempt.humanReviews.length === 0);
  const reviewed = attempts.filter((attempt) => attempt.humanReviews.length > 0);

  const list = (items: typeof attempts) => (
    <ul className="divide-y rounded-xl border">
      {items.map((attempt) => {
        const question = findQuestion(attempt.questionId)?.question;
        return (
          <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <Link href={`/study/review/${attempt.id}`} className="font-medium underline underline-offset-4">
              Q{question?.number}. {question?.title} — attempt {attempt.attemptNumber}
            </Link>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              {new Date(attempt.submittedAt).toLocaleString()} <StatusBadge attempt={attempt} />
            </span>
          </li>
        );
      })}
    </ul>
  );

  return (
    <PageShell title="Review queue" intro="Submissions from learners assigned to you who have agreed to reviewer access.">
      {problem ? <p role="alert">{problem}</p> : null}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Awaiting review ({awaiting.length})</h2>
        {awaiting.length ? list(awaiting) : <p>Nothing is waiting.</p>}
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Reviewed ({reviewed.length})</h2>
        {reviewed.length ? list(reviewed) : <p>No reviews yet.</p>}
      </section>
    </PageShell>
  );
}
