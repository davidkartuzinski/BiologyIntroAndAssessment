import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth/viewer";
import { statusLabel } from "@/lib/attempts/logic";
import { reviewQueueItems, type QueueItem } from "@/lib/attempts/progress";
import { StoreError, reviewQueue, type AttemptSummary } from "@/lib/attempts/store";
import { findQuestion } from "@/lib/content/questions";

export default async function ReviewQueuePage() {
  const viewer = await requireRole("reviewer");
  let items: QueueItem<AttemptSummary>[] = [];
  let problem: string | null = null;
  try {
    items = reviewQueueItems(await reviewQueue(viewer.userId));
  } catch (error) {
    problem = error instanceof StoreError ? error.message : "The queue could not be loaded.";
  }
  const awaiting = items.filter((item) => item.pending);
  const reviewed = items.filter((item) => !item.pending);

  const list = (rows: QueueItem<AttemptSummary>[]) => (
    <ul className="divide-y rounded-xl border">
      {rows.map(({ latest, attemptCount, outcome }) => {
        const question = findQuestion(latest.questionId)?.question;
        return (
          <li key={latest.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <Link href={`/study/review/${latest.id}`} className="font-medium underline underline-offset-4">
              Q{question?.number}. {question?.title}
            </Link>
            <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              Attempt {latest.attemptNumber} (latest of {attemptCount}) · {new Date(latest.submittedAt).toLocaleString()}
              <Badge variant={outcome ? "default" : "outline"}>{outcome ? `Reviewed: ${statusLabel[outcome]}` : "Awaiting review"}</Badge>
            </span>
          </li>
        );
      })}
    </ul>
  );

  return (
    <PageShell
      title="Review queue"
      intro="One item per question, pointing to Lauren’s latest submission. Earlier attempts are history only and do not need separate review."
    >
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
