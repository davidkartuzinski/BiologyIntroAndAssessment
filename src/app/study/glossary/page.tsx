import { auth } from "@clerk/nextjs/server";
import { PageShell } from "@/components/page-shell";
import { getGlossary } from "@/lib/content";

export default async function GlossaryPage() {
  await auth.protect();
  const glossary = getGlossary();
  return (
    <PageShell title="Glossary" intro="Every word defined so far, in alphabetical order.">
      <dl className="divide-y rounded-xl border">
        {glossary.map((entry) => (
          <div key={entry.id} id={`term-${entry.id}`} className="scroll-mt-20 space-y-1 px-4 py-3 target:bg-primary/10">
            <dt className="font-semibold">{entry.term}</dt>
            <dd>{entry.definition}</dd>
            <dd className="text-sm text-muted-foreground">Introduced in {entry.introducedInLabel}</dd>
          </div>
        ))}
      </dl>
    </PageShell>
  );
}
