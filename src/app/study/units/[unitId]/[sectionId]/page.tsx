import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentBlocks } from "@/components/content/blocks";
import { glossaryForPage } from "@/lib/glossary/linker";
import { VocabularyList } from "@/components/content/vocabulary-list";
import { PageShell } from "@/components/page-shell";
import { assessmentHref, getSection, getTerm, getUnit, sectionHref, unitHref } from "@/lib/content";

export default async function SectionPage({ params }: PageProps<"/study/units/[unitId]/[sectionId]">) {
  await auth.protect();
  const { unitId, sectionId } = await params;
  const unit = getUnit(unitId);
  const found = unit ? getSection(unit, sectionId) : undefined;
  if (!unit || !found) notFound();
  const { section, previous, next } = found;

  const glossary = await glossaryForPage();
  const termsHere = section.termsBeforeUse
    .map((id) => getTerm(unit, id))
    .filter((term) => term !== undefined)
    .map(glossary.current);
  const linker = glossary.linker;
  const isLast = !next;

  return (
    <PageShell eyebrow={`${unit.subtitle} · Section ${section.letter}`} title={section.title}>
      {termsHere.length > 0 ? <VocabularyList title="Words to understand first" terms={termsHere} headingLevel="h2" /> : null}
      <ContentBlocks blocks={section.contentBlocks} unit={unit} linker={linker} />
      {section.reflectionPrompts ? (
        <section className="space-y-2 rounded-xl border bg-muted/30 p-5">
          <h2 className="text-lg font-semibold">Pause and connect</h2>
          {section.reflectionPrompts.intro ? <p>{section.reflectionPrompts.intro}</p> : null}
          <ul className="list-disc space-y-1 pl-6">
            {section.reflectionPrompts.prompts.map((prompt) => <li key={prompt}>{prompt}</li>)}
          </ul>
        </section>
      ) : null}
      {isLast ? (
        <section className="space-y-2 rounded-xl border p-5">
          <h2 className="text-lg font-semibold">End-of-unit recap</h2>
          <p>{unit.recap.intro}</p>
          <ul className="list-disc space-y-1 pl-6">
            {unit.recap.points.map((point) => <li key={point}>{point}</li>)}
          </ul>
        </section>
      ) : null}
      <nav aria-label="Section navigation" className="flex flex-wrap justify-between gap-3 border-t pt-6">
        {previous ? (
          <Link className="underline underline-offset-4" href={sectionHref(unit.id, previous.id)}>← Section {previous.letter}: {previous.title}</Link>
        ) : (
          <Link className="underline underline-offset-4" href={unitHref(unit.id)}>← Unit overview</Link>
        )}
        {next ? (
          <Link className="underline underline-offset-4" href={sectionHref(unit.id, next.id)}>Section {next.letter}: {next.title} →</Link>
        ) : (
          <Link className="underline underline-offset-4" href={assessmentHref(unit.id)}>{unit.assessment.title} →</Link>
        )}
      </nav>
    </PageShell>
  );
}
