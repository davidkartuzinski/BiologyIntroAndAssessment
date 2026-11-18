import Link from "next/link";
import { ReviewStatusBadge } from "@/components/attempts/review-status";
import type { QuestionProgress } from "@/lib/attempts/progress";
import type { ReviewState } from "@/lib/attempts/review-status";

export function rowState(row: QuestionProgress): ReviewState {
  if (row.state === "reviewed") return row.outcome ?? "not_assessed";
  return row.state;
}

export function ProgressTable({ rows, assessmentHref, unread = [], reviewIdByQuestion }: {
  rows: QuestionProgress[];
  assessmentHref: string;
  unread?: string[];
  reviewIdByQuestion: Map<string, string>;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left">
        <thead className="bg-muted/60">
          <tr>
            <th scope="col" className="px-3 py-2">Question</th>
            <th scope="col" className="px-3 py-2">Status</th>
            <th scope="col" className="px-3 py-2 text-right">Attempts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const reviewId = reviewIdByQuestion.get(row.questionId);
            const isNew = reviewId ? unread.includes(reviewId) : false;
            return (
              <tr key={row.questionId} className="border-t align-top">
                <th scope="row" className="px-3 py-2 font-medium">
                  <Link href={`${assessmentHref}#${row.questionId}`} className="underline underline-offset-4">
                    {row.number}. {row.title}
                  </Link>
                </th>
                <td className="space-y-1 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <ReviewStatusBadge state={rowState(row)} prefix={row.state === "reviewed" ? "Reviewed: " : undefined} />
                    {isNew ? <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">New feedback</span> : null}
                  </div>
                  {row.anotherAttemptSuggested ? <p className="text-sm font-medium">Another attempt suggested</p> : null}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{row.attempts}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
