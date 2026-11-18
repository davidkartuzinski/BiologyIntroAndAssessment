import type { Citation, Unit } from "@/content/schema.ts";
import { formatSyllabusReference, getResource, getSyllabusReference } from "@/lib/content";

/** Source line shown under a block. Resources link out; syllabus references are titles only. */
export function Citations({ citations, unit }: { citations: Citation[]; unit: Unit }) {
  const items = citations.map((citation) => {
    if (citation.kind === "resource") {
      const resource = getResource(unit, citation.refId);
      if (!resource) return null;
      return (
        <a
          key={citation.refId}
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          {resource.creator}, “{resource.title}”<span className="sr-only"> (opens in a new tab)</span>
        </a>
      );
    }
    const reference = getSyllabusReference(citation.refId);
    return reference ? <span key={citation.refId}>{formatSyllabusReference(reference)}</span> : null;
  });

  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium">{citations.length > 1 ? "Sources: " : "Source: "}</span>
      {items.filter(Boolean).flatMap((item, index) => (index === 0 ? [item] : ["; ", item]))}
    </p>
  );
}
