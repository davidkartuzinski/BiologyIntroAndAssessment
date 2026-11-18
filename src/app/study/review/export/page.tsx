import Link from "next/link";
import { ExportForm } from "@/components/attempts/export-form";
import { PageShell } from "@/components/page-shell";
import { requireRole } from "@/lib/auth/viewer";
import { learnerDisplayName, reviewableLearners } from "@/lib/attempts/store";

export default async function ExportPage() {
  const viewer = await requireRole("reviewer");
  const learners = await reviewableLearners(viewer.userId).catch(() => [] as string[]);
  const learnerName = learners[0] ? await learnerDisplayName(learners[0]) : null;
  return (
    <PageShell title="Export assessment for course planning" intro="A manual download of the assessment evidence. Nothing is sent anywhere.">
      <Link href="/study/review" className="underline underline-offset-4">← Review queue</Link>
      {learnerName ? (
        <ExportForm learnerName={learnerName} />
      ) : (
        <p>There is no learner you can export. A learner must be assigned to you and have turned on reviewer access.</p>
      )}
    </PageShell>
  );
}
