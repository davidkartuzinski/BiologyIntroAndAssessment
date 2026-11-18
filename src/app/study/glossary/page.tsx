import { auth } from "@clerk/nextjs/server";
import { PageShell } from "@/components/page-shell";
import { loadGlossary } from "@/lib/glossary/store";

export default async function GlossaryPage() {
  await auth.protect();
  const { entries } = await loadGlossary();
  const active = entries.filter((entry) => entry.active).sort((a, b) => a.term.localeCompare(b.term));
  return (
    <PageShell title="Glossary" intro="Every word defined so far, in alphabetical order. In lessons, tap any dotted-underlined word to see its definition.">
      <dl className="divide-y rounded-xl border">
        {active.map((entry) => (
          <div key={entry.id} id={`term-${entry.id}`} className="scroll-mt-20 space-y-1 px-4 py-3 target:bg-primary/10">
            <dt className="font-semibold">{entry.term}</dt>
            <dd>{entry.definition}</dd>
            {entry.aliases.length ? <dd className="text-sm text-muted-foreground">Also: {entry.aliases.join(", ")}</dd> : null}
          </div>
        ))}
      </dl>
    </PageShell>
  );
}
