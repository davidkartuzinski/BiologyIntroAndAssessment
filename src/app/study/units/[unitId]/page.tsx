import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentBlocks } from "@/components/content/blocks";
import { glossaryForPage } from "@/lib/glossary/linker";
import { PageShell } from "@/components/page-shell";
import { assessmentHref, getUnit, sectionHref } from "@/lib/content";

export default async function UnitPage({ params }: PageProps<"/study/units/[unitId]">) {
  await auth.protect();
  const { unitId } = await params;
  const unit = getUnit(unitId);
  if (!unit) notFound();
  const { linker } = await glossaryForPage();

  return (
    <PageShell eyebrow={unit.subtitle} title={unit.title}>
      <ContentBlocks blocks={unit.overview} unit={unit} linker={linker} />
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">What you should understand by the end</h2>
        <p>You should be able to:</p>
        <ul className="list-disc space-y-1 pl-6">
          {unit.learningObjectives.map((objective) => <li key={objective}>{objective}</li>)}
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Suggested study sequence</h2>
        <p>{unit.studySequence.note}</p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left">
            <thead className="bg-muted/60"><tr><th scope="col" className="px-3 py-2">Session</th><th scope="col" className="px-3 py-2">Study</th></tr></thead>
            <tbody>
              {unit.studySequence.sessions.map((row) => (
                <tr key={row.session} className="border-t"><th scope="row" className="px-3 py-2 font-medium">{row.session}</th><td className="px-3 py-2">{row.study}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>{unit.studySequence.closing}</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Sections</h2>
        <ol className="space-y-3">
          {unit.sections.map((section) => (
            <li key={section.id} className="rounded-xl border p-4">
              <Link href={sectionHref(unit.id, section.id)} className="font-semibold underline underline-offset-4">
                Section {section.letter}: {section.title}
              </Link>
              <p className="text-muted-foreground">{section.summary}</p>
            </li>
          ))}
          <li className="rounded-xl border p-4">
            <Link href={assessmentHref(unit.id)} className="font-semibold underline underline-offset-4">{unit.assessment.title}</Link>
            <p className="text-muted-foreground">Complete this after studying all five sections.</p>
          </li>
        </ol>
      </section>
    </PageShell>
  );
}
