import type { Question } from "@/content/schema.ts";
import { AnswerText } from "@/components/attempts/attempt-history";
import type { AttemptSummary } from "@/lib/attempts/store";
import { hasChanges, wordDiff, type DiffSegment } from "@/lib/attempts/word-diff";

const addedClass = "rounded-sm bg-green-100 px-0.5 italic text-green-950 no-underline dark:bg-green-200";
const removedClass = "rounded-sm bg-red-100 px-0.5 text-red-950 line-through decoration-2 dark:bg-red-200";

function Marked({ segments }: { segments: DiffSegment[] }) {
  // React escapes the text, so learner input is rendered safely.
  return (
    <span className="whitespace-pre-wrap">
      {segments.map((segment, index) =>
        segment.type === "same" ? (
          <span key={index}>{segment.text}</span>
        ) : segment.type === "added" ? (
          <ins key={index} className={addedClass}>
            <span className="sr-only">[added: </span>
            {segment.text}
            <span className="sr-only">]</span>
          </ins>
        ) : (
          <del key={index} className={removedClass}>
            <span className="sr-only">[deleted: </span>
            {segment.text}
            <span className="sr-only">]</span>
          </del>
        ),
      )}
    </span>
  );
}

/**
 * Reviewer-only rendering of an answer, marking wording changed since the
 * immediately preceding submitted attempt. Display only; stored text is untouched.
 */
export function ChangedAnswerText({ attempt, previous, question }: { attempt: AttemptSummary; previous: AttemptSummary | undefined; question: Question }) {
  if (!previous) return <AnswerText attempt={attempt} question={question} />;

  const fields =
    question.parts.length === 0
      ? [{ id: "text", label: null as string | null, segments: wordDiff(previous.answer.text, attempt.answer.text), empty: !attempt.answer.text }]
      : question.parts.map((part) => ({
          id: part.id,
          label: `${part.label}. ${part.prompt}`,
          segments: wordDiff(previous.answer.parts[part.id] ?? "", attempt.answer.parts[part.id] ?? ""),
          empty: !attempt.answer.parts[part.id] && !previous.answer.parts[part.id],
        }));

  if (!fields.some((field) => hasChanges(field.segments))) return <AnswerText attempt={attempt} question={question} />;

  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-center gap-3 text-sm" aria-label="Legend for changes since the previous attempt">
        <span>Changes since attempt {previous.attemptNumber}:</span>
        <ins className={addedClass}>Added wording</ins>
        <del className={removedClass}>Deleted wording</del>
      </p>
      {question.parts.length === 0 ? (
        <p>{fields[0].empty && !hasChanges(fields[0].segments) ? "(no written answer)" : <Marked segments={fields[0].segments} />}</p>
      ) : (
        <dl className="space-y-2">
          {fields.map((field) => (
            <div key={field.id}>
              <dt className="text-sm font-medium">{field.label}</dt>
              <dd>{field.empty ? "(blank)" : <Marked segments={field.segments} />}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
