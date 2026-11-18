import Link from "next/link";
import type { QuestionProgress } from "@/lib/attempts/progress";

export function ProgressTable({ rows, assessmentHref }: { rows: QuestionProgress[]; assessmentHref: string }) {
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
          {rows.map((row) => (
            <tr key={row.questionId} className="border-t">
              <th scope="row" className="px-3 py-2 font-medium">
                <Link href={`${assessmentHref}#${row.questionId}`} className="underline underline-offset-4">
                  {row.number}. {row.title}
                </Link>
              </th>
              <td className="px-3 py-2">{row.label}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.attempts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
