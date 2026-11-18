import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentBlocks } from "@/components/content/blocks";
import { Citations } from "@/components/content/citations";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { AnswerForm } from "@/components/attempts/answer-form";
import { AttemptHistory } from "@/components/attempts/attempt-history";
import { MarkFeedbackSeen } from "@/components/attempts/mark-seen";
import { FreshOnShow } from "@/components/fresh-on-show";
import { learnerProgress, type LearnerProgress } from "@/lib/attempts/learner-progress";
import { getViewer } from "@/lib/auth/viewer";
import {
  StoreError,
  getDrafts,
  listOwnAttachments,
  listOwnAttempts,
  maxAttachmentsPerQuestion,
  type Attachment,
  type AttemptSummary,
  type Draft,
} from "@/lib/attempts/store";
import { getUnit, sectionHref } from "@/lib/content";
import { isSupabaseConfigured } from "@/lib/supabase/server";

/** Learner view of the assessment. Uses learner content only; tutor guidance is never loaded here. */
export default async function AssessmentPage({ params }: PageProps<"/study/units/[unitId]/assessment">) {
  const viewer = await getViewer();
  const { unitId } = await params;
  const unit = getUnit(unitId);
  if (!unit) notFound();
  const { assessment } = unit;

  // Learner work is loaded only for the learner's own verified id.
  let work: { drafts: Map<string, Draft>; attempts: AttemptSummary[]; photos: Attachment[]; progress: LearnerProgress } | null = null;
  let notice: string;
  if (viewer.role !== "learner") {
    notice = viewer.role === "reviewer"
      ? "You are signed in as the reviewer. Lauren’s answers are in the review queue."
      : "This account has no learner role, so answers cannot be saved. Ask David to set it up.";
  } else if (!isSupabaseConfigured()) {
    notice = "Demo mode: saving is not connected, so answers cannot be saved here yet.";
  } else {
    try {
      const [drafts, attempts, photos, progress] = await Promise.all([
        getDrafts(viewer.userId),
        listOwnAttempts(viewer.userId),
        listOwnAttachments(viewer.userId),
        learnerProgress(viewer, unit),
      ]);
      work = { drafts, attempts, photos, progress };
      notice = "Drafts save automatically a few seconds after you stop typing. Submitting never replaces an earlier attempt.";
    } catch (error) {
      notice = error instanceof StoreError ? error.message : "Your saved work could not be loaded. Please refresh the page.";
    }
  }

  return (
    <PageShell eyebrow={unit.subtitle} title={assessment.title}>
      <p role="status" className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">{notice}</p>
      {work ? <FreshOnShow /> : null}
      {work?.progress.ok && work.progress.unread?.length ? <MarkFeedbackSeen reviewIds={work.progress.unread} /> : null}
      <ContentBlocks blocks={assessment.introduction} unit={unit} />
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Support labels</h2>
        <ul className="list-disc pl-6">
          {assessment.supportLabels.map((label) => <li key={label.code}><span className="font-semibold">{label.code}:</span> {label.meaning}</li>)}
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Instructions used below</h2>
        <ul className="list-disc pl-6">
          {assessment.commandWords.items.map((item) => <li key={item.word}><span className="font-semibold">{item.word}:</span> {item.meaning}</li>)}
        </ul>
        <p>These meanings are consistent with the syllabus’s command-word guidance.</p>
        <Citations citations={[{ kind: "syllabus", refId: assessment.commandWords.syllabusReferenceId }]} unit={unit} />
      </section>
      <h2 className="text-2xl font-semibold">Questions</h2>
      {assessment.questions.map((question) => (
        <article key={question.id} id={question.id} className="scroll-mt-20 space-y-3 rounded-xl border p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{question.number}. {question.title}</h3>
            {question.isReflection ? <Badge variant="secondary">Not marked right or wrong</Badge> : null}
          </div>
          <ContentBlocks blocks={question.prompt} unit={unit} />
          {question.parts.length > 0 ? (
            <ul className="space-y-1 pl-1">
              {question.parts.map((part) => <li key={part.id}><span className="font-semibold">{part.label}.</span> {part.prompt}</li>)}
            </ul>
          ) : null}
          {question.promptAfterParts.length > 0 ? <ContentBlocks blocks={question.promptAfterParts} unit={unit} /> : null}
          <p className="text-sm text-muted-foreground">
            Taught in:{" "}
            {question.teachingReferences.map((reference, index) => {
              const section = unit.sections.find((candidate) => candidate.id === reference.sectionId);
              return (
                <span key={`${reference.sectionId}-${reference.blockId ?? ""}`}>
                  {index > 0 ? ", " : ""}
                  <Link className="underline underline-offset-2" href={sectionHref(unit.id, reference.sectionId, reference.blockId)}>
                    Section {section?.letter}
                  </Link>
                </span>
              );
            })}
          </p>
          {work ? (
            <>
              <AttemptHistory
                attempts={work.attempts.filter((attempt) => attempt.questionId === question.id)}
                question={question}
                attachments={work.photos}
                latestReview={work.progress.ok ? work.progress.latestReviews.get(question.id) : undefined}
              />
              <AnswerForm
                questionId={question.id}
                questionNumber={question.number}
                parts={question.parts}
                isReflection={question.isReflection}
                hasAttempts={work.attempts.some((attempt) => attempt.questionId === question.id)}
                draft={(() => {
                  const draft = work.drafts.get(question.id);
                  return draft ? { text: draft.answer.text, parts: draft.answer.parts, assistance: draft.assistance, unclearWords: draft.unclearWords, updatedAt: draft.updatedAt } : null;
                })()}
                draftPhotos={work.photos.filter((photo) => photo.questionId === question.id && photo.attemptId === null).map((photo) => ({ id: photo.id, createdAt: photo.createdAt }))}
                maxPhotos={maxAttachmentsPerQuestion()}
              />
            </>
          ) : null}
        </article>
      ))}
      <p className="font-medium">{assessment.closingNote}</p>
    </PageShell>
  );
}
