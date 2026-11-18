import type { Question } from "@/content/schema.ts";
import { PhotoLinkButton } from "@/components/attempts/photo-link-button";
import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/lib/attempts/logic";
import type { Attachment, AttemptSummary } from "@/lib/attempts/store";

export function StatusBadge({ attempt }: { attempt: AttemptSummary }) {
  const prefix = attempt.status.source === "human" ? "Reviewed: " : attempt.status.source === "ai" ? "AI (provisional): " : "";
  return <Badge variant={attempt.status.source === "human" ? "default" : "outline"}>{prefix}{statusLabel[attempt.status.status]}</Badge>;
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

/** Learner-facing list of earlier attempts and any feedback released to them. */
export function AttemptHistory({ attempts, question, attachments }: { attempts: AttemptSummary[]; question: Question; attachments: Attachment[] }) {
  if (attempts.length === 0) return null;
  return (
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer font-medium">Your submitted attempts ({attempts.length})</summary>
      <ol className="mt-3 space-y-4">
        {attempts.map((attempt) => (
          <li key={attempt.id} className="space-y-2 border-t pt-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">Attempt {attempt.attemptNumber}</span>
              <span className="text-muted-foreground">{new Date(attempt.submittedAt).toLocaleString()} · support {attempt.assistance}</span>
              <StatusBadge attempt={attempt} />
            </div>
            <AnswerText attempt={attempt} question={question} />
            {attachments.filter((photo) => photo.attemptId === attempt.id).map((photo, index) => (
              <PhotoLinkButton key={photo.id} attachmentId={photo.id} label={`Photo ${index + 1}`} />
            ))}
            {attempt.humanReviews[0]?.comments ? (
              <p className="rounded-md bg-muted/50 p-2 text-sm"><span className="font-medium">Reviewer feedback: </span>{attempt.humanReviews[0].comments}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}
