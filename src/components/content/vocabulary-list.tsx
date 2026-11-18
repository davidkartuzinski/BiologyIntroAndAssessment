import type { VocabularyTerm } from "@/content/schema.ts";

export function VocabularyList({
  title,
  terms,
  headingLevel = "h3",
}: {
  title: string;
  terms: VocabularyTerm[];
  headingLevel?: "h2" | "h3" | "h4";
}) {
  const Heading = headingLevel;
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5" aria-label={title}>
      <Heading className="mb-3 text-base font-semibold">{title}</Heading>
      <dl className="divide-y">
        {terms.map((term) => (
          <div key={term.id} id={`define-${term.id}`} className="grid gap-1 py-2 sm:grid-cols-[12rem_1fr] sm:gap-4">
            <dt className="font-semibold">{term.term}</dt>
            <dd>{term.definition}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
