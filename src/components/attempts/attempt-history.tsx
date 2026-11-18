import type { Question } from "@/content/schema.ts";
import { PhotoLinkButton } from "@/components/attempts/photo-link-button";
import { ReviewResultPanel, ReviewStatusBadge } from "@/components/attempts/review-status";
import { Badge } from "@/components/ui/badge";
import type { LatestReview } from "@/lib/attempts/learner-progress";
import { statusLabel } from "@/lib/attempts/logic";
import type { Attachment, AttemptSummary } from "@/lib/attempts/store";

/** Status of one attempt: its latest human review outcome, or awaiting review. */
export function StatusBadge({ attempt }: { attempt: AttemptSummary }) {
  const review = attempt.humanReviews[0];
  return review ? <ReviewStatusBadge state={review.outcome} prefix="Reviewed: " /> : <ReviewStatusBadge state="awaiting_review" />;
}

export function AnswerText({ attempt, question }: { attempt: AttemptSummary; question: Question }) {
  if (question.parts.length === 0) return <p className="whitespace-pre-wrap">{attempt.answer.text || "(no written answer)"}</p>;
  return (
    <dl className="space-y-2">
      {question.parts.map((part) => (
        <div key={part.id}>
          <dt className="text-sm font-medium">{part.label}. {part.prompt}</dt>
          <dd className="whitespace-pre-wrap">{attempt.answer.parts[part.id] || "(blank)"}</dd>
        </div>
      ))}
    </dl>
  );
}

function AttemptBlock({ attempt, question, attachments, label, showComments = true }: { attempt: AttemptSummary; question: Question; attachments: Attachment[]; label: React.ReactNode; showComments?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Attempt {attempt.attemptNumber}</span>
        <span className="text-muted-foreground">{new Date(attempt.submittedAt).toLocaleString()} · support {attempt.assistance}</span>
        {label}
      </div>
      <AnswerText attempt={attempt} question={question} />
      {attachments.filter((photo) => photo.attemptId === attempt.id).map((photo, index) => (
        <PhotoLinkButton key={photo.id} attachmentId={photo.id} label={`Photo ${index + 1}`} />
      ))}
      {showComments && attempt.humanReviews[0]?.comments ? (
        <p className="rounded-md border p-2 text-sm"><span className="font-medium">Reviewer feedback then: </span>{attempt.humanReviews[0].comments}</p>
      ) : null}
    </div>
  );
}

/** Learner view: the latest submission first; earlier attempts collapsed as history. */
export function AttemptHistory({ attempts, question, attachments, latestReview }: { attempts: AttemptSummary[]; question: Question; attachments: Attachment[]; latestReview?: LatestReview }) {
  if (attempts.length === 0) return null;
  const ordered = [...attempts].sort((a, b) => b.attemptNumber - a.attemptNumber);
  const [latest, ...earlier] = ordered;
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-semibold">Latest submission</p>
      <AttemptBlock attempt={latest} question={question} attachments={attachments} label={<StatusBadge attempt={latest} />} showComments={false} />
      {latestReview && latestReview.attemptNumber === latest.attemptNumber ? (
        <ReviewResultPanel outcome={latestReview.outcome} reviewerName={latestReview.reviewerName} reviewedAt={latestReview.reviewedAt} comments={latestReview.comments} />
      ) : null}
      {earlier.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm font-medium">Earlier attempts — history ({earlier.length})</summary>
          <ol className="mt-3 space-y-4">
            {earlier.map((attempt) => (
              <li key={attempt.id} className="border-t pt-3">
                <AttemptBlock
                  attempt={attempt}
                  question={question}
                  attachments={attachments}
                  label={
                    <Badge variant="outline">
                      Superseded by attempt {latest.attemptNumber}
                      {attempt.humanReviews[0] ? ` · reviewed then: ${statusLabel[attempt.humanReviews[0].outcome]}` : ""}
                    </Badge>
                  }
                />
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
