import Link from "next/link";
import { notFound } from "next/navigation";
import { AnswerText, StatusBadge } from "@/components/attempts/attempt-history";
import { PhotoLinkButton } from "@/components/attempts/photo-link-button";
import { FlagForm, ReviewForm } from "@/components/attempts/review-forms";
import { ContentBlocks } from "@/components/content/blocks";
import { PageShell } from "@/components/page-shell";
import { requireRole } from "@/lib/auth/viewer";
import { attachmentsForAttempt, attemptForReviewer, attemptsForQuestion } from "@/lib/attempts/store";
import { statusLabel } from "@/lib/attempts/logic";
import { supersededBy } from "@/lib/attempts/progress";
import { sectionHref } from "@/lib/content";
import { findQuestion } from "@/lib/content/questions";
import { getMarkingGuidance } from "@/lib/content/tutor-guide";

export default async function ReviewDetailPage({ params }: PageProps<"/study/review/[attemptId]">) {
  const viewer = await requireRole("reviewer");
  const { attemptId } = await params;
  const attempt = await attemptForReviewer(viewer.userId, attemptId);
  if (!attempt) notFound(); // also covers "not assigned to you", so existence is not revealed
  const found = findQuestion(attempt.questionId);
  if (!found) notFound();
  const { unit, question } = found;
  const [photos, history] = await Promise.all([attachmentsForAttempt(attempt.id), attemptsForQuestion(attempt.learnerId, attempt.questionId)]);
  const guidance = getMarkingGuidance(question.id);
  const newer = supersededBy(attempt, history);
  const latest = newer ? history.find((other) => other.attemptNumber === newer) : undefined;
  const previous = history.filter((other) => other.attemptNumber < attempt.attemptNumber).reverse();

  return (
    <PageShell eyebrow={newer ? `Attempt ${attempt.attemptNumber} — superseded by attempt ${newer}` : `Attempt ${attempt.attemptNumber} — latest submission`} title={`Q${question.number}. ${question.title}`}>
      <Link href="/study/review" className="underline underline-offset-4">← Review queue</Link>
      {latest ? (
        <p role="alert" className="rounded-lg border border-amber-500/50 bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
          This is not Lauren’s latest answer. Attempt {latest.attemptNumber} was submitted {new Date(latest.submittedAt).toLocaleString()}.{" "}
          <Link href={`/study/review/${latest.id}`} className="font-medium underline underline-offset-4">Review the latest attempt</Link>
        </p>
      ) : null}
      <section className="space-y-2 rounded-xl border p-5">
        <h2 className="text-lg font-semibold">Question</h2>
        <ContentBlocks blocks={question.prompt} unit={unit} />
        <p className="text-sm">
          Taught in{" "}
          {question.teachingReferences.map((reference) => (
            <Link key={`${reference.sectionId}${reference.blockId}`} className="mr-2 underline" href={sectionHref(unit.id, reference.sectionId, reference.blockId)}>
              Section {unit.sections.find((section) => section.id === reference.sectionId)?.letter}
            </Link>
          ))}
        </p>
      </section>
      <section className="space-y-2 rounded-xl border p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Lauren’s answer — attempt {attempt.attemptNumber}{newer ? "" : " (latest submission)"}</h2>
          <StatusBadge attempt={attempt} />
        </div>
        <p className="text-sm text-muted-foreground">
          Submitted {new Date(attempt.submittedAt).toLocaleString()} · support {attempt.assistance}
          {attempt.unclearWords ? ` · unclear words: ${attempt.unclearWords}` : ""}
        </p>
        <AnswerText attempt={attempt} question={question} />
        {photos.map((photo, index) => <PhotoLinkButton key={photo.id} attachmentId={photo.id} label={`Photo ${index + 1}`} />)}
      </section>
      {previous.length > 0 ? (
        <details className="rounded-xl border p-5">
          <summary className="cursor-pointer font-semibold">Previous attempts — history only ({previous.length})</summary>
          <ol className="mt-3 space-y-4">
            {previous.map((older) => (
              <li key={older.id} className="space-y-1 border-t pt-3">
                <p className="text-sm text-muted-foreground">
                  Attempt {older.attemptNumber} · {new Date(older.submittedAt).toLocaleString()} · superseded by attempt {attempt.attemptNumber}
                  {older.humanReviews[0] ? ` · reviewed then: ${statusLabel[older.humanReviews[0].outcome]}` : ""}
                </p>
                <AnswerText attempt={older} question={question} />
                {older.humanReviews[0]?.comments ? <p className="text-sm">Feedback then: {older.humanReviews[0].comments}</p> : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      {guidance ? (
        <section className="space-y-2 rounded-xl border border-amber-500/50 p-5">
          <h2 className="text-lg font-semibold">Private marking guidance</h2>
          <p>{guidance.evidenceOfUnderstanding}</p>
          {guidance.cautions.length ? <ul className="list-disc pl-6">{guidance.cautions.map((caution) => <li key={caution}>{caution}</li>)}</ul> : null}
        </section>
      ) : null}
      {attempt.aiFeedback.length > 0 ? (
      <section className="space-y-3 rounded-xl border p-5">
        <h2 className="text-lg font-semibold">AI feedback</h2>
        {attempt.aiFeedback.map((entry) => (
          <div key={entry.id} className="space-y-2 border-t pt-2">
            <p className="text-sm">{statusLabel[entry.status]} · {entry.modelId} · {new Date(entry.createdAt).toLocaleString()}</p>
            <pre className="overflow-x-auto whitespace-pre-wrap text-sm">{JSON.stringify(entry.feedback, null, 2)}</pre>
            <FlagForm aiFeedbackId={entry.id} />
          </div>
        ))}
      </section>
      ) : null}
      <section className="space-y-3 rounded-xl border p-5">
        <h2 className="text-lg font-semibold">Human reviews</h2>
        {attempt.humanReviews.map((review) => (
          <p key={review.id} className="text-sm">
            <span className="font-medium">{statusLabel[review.outcome]}</span> · {new Date(review.reviewedAt).toLocaleString()}
            {review.reviewerId === viewer.userId ? " · you" : ""}
            {review.comments ? <><br />{review.comments}</> : null}
          </p>
        ))}
        {latest ? (
          <p className="text-sm">Reviews are recorded on the latest attempt only.</p>
        ) : (
          <ReviewForm attemptId={attempt.id} isReflection={question.isReflection} />
        )}
      </section>
    </PageShell>
  );
}
