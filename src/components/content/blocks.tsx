import { Fragment, type ReactNode } from "react";
import type { ContentBlock, Unit } from "@/content/schema.ts";
import { GlossaryTerm } from "@/components/glossary/glossary-term";
import { buildMatcher, segmentText, type GlossaryEntry, type Matcher } from "@/lib/glossary/logic";
import { Citations } from "@/components/content/citations";
import { PracticalCard } from "@/components/content/practical-card";
import { ResourceCard } from "@/components/content/resource-card";
import { VocabularyList } from "@/components/content/vocabulary-list";
import { getResource, getTerm } from "@/lib/content";
import { cn } from "@/lib/utils";

/**
 * Wraps every occurrence of an active glossary word or phrase in an inline
 * definition button. Server-side and display-only: source text is unchanged.
 */
export class GlossaryLinker {
  private readonly matcher: Matcher;
  private readonly byId: Map<string, GlossaryEntry>;

  constructor(entries: GlossaryEntry[]) {
    this.matcher = buildMatcher(entries);
    this.byId = new Map(entries.map((entry) => [entry.id, entry]));
  }

  /** Current (possibly edited) wording for a lesson vocabulary term. */
  current<T extends { id: string; term: string; definition: string }>(term: T): T {
    const entry = this.byId.get(term.id);
    return entry ? { ...term, term: entry.term, definition: entry.definition } : term;
  }

  render(text: string): ReactNode {
    const segments = segmentText(text, this.matcher);
    if (segments.length === 1 && !segments[0].entry) return text;
    return segments.map((segment, index) =>
      segment.entry ? (
        <GlossaryTerm key={index} text={segment.text} term={segment.entry.term} definition={segment.entry.definition} />
      ) : (
        <Fragment key={index}>{segment.text}</Fragment>
      ),
    );
  }
}

function Block({ block, unit, linker }: { block: ContentBlock; unit: Unit; linker?: GlossaryLinker }) {
  const text = (value: string) => (linker ? linker.render(value) : value);

  switch (block.type) {
    case "heading":
      return <h3 className="pt-4 text-xl font-semibold tracking-tight">{block.text}</h3>;
    case "paragraph":
      return <p>{text(block.text)}</p>;
    case "quote":
      return (
        <blockquote className="border-l-4 border-primary/40 bg-muted/40 py-2 pr-3 pl-4 italic">
          {text(block.text)}
        </blockquote>
      );
    case "list": {
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <div className="space-y-2">
          {block.intro ? <p>{text(block.intro)}</p> : null}
          <ListTag className={cn("space-y-1 pl-6", block.ordered ? "list-decimal" : "list-disc")}>
            {block.items.map((item) => (
              <li key={item}>{text(item)}</li>
            ))}
          </ListTag>
        </div>
      );
    }
    case "table":
      return (
        <div className="space-y-2">
          {block.caption ? <p>{text(block.caption)}</p> : null}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-left">
              <thead className="bg-muted/60">
                <tr>
                  {block.headers.map((header, index) => (
                    <th
                      key={header}
                      scope="col"
                      className={cn("px-3 py-2 font-semibold", block.numericColumns.includes(index) && "text-right")}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row) => (
                  <tr key={row.join("|")} className="border-t align-top">
                    {row.map((cell, index) =>
                      index === 0 ? (
                        <th key={index} scope="row" className="px-3 py-2 font-medium">
                          {text(cell)}
                        </th>
                      ) : (
                        <td
                          key={index}
                          className={cn("px-3 py-2", block.numericColumns.includes(index) && "text-right tabular-nums")}
                        >
                          {text(cell)}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    case "definitions": {
      const terms = block.termIds
        .map((termId) => getTerm(unit, termId))
        .filter((term) => term !== undefined)
        .map((term) => (linker ? linker.current(term) : term));
      return <VocabularyList title={block.title} terms={terms} headingLevel="h4" />;
    }
    case "note":
      return (
        <p
          className={cn(
            "rounded-lg border px-4 py-3",
            block.tone === "caution" ? "border-amber-500/50 bg-amber-50 dark:bg-amber-950/30" : "bg-muted/40",
          )}
        >
          {text(block.text)}
        </p>
      );
    case "resource": {
      const resource = getResource(unit, block.resourceId);
      return resource ? (
        <ResourceCard resource={resource} instructions={block.instructions} reviewNote={block.reviewNote} />
      ) : null;
    }
    case "practical": {
      const practical = unit.practicals.find((candidate) => candidate.id === block.practicalId);
      return practical ? <PracticalCard practical={practical} /> : null;
    }
  }
}

export function ContentBlocks({
  blocks,
  unit,
  linker,
}: {
  blocks: ContentBlock[];
  unit: Unit;
  linker?: GlossaryLinker;
}) {
  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <div key={block.id} id={block.id} className="scroll-mt-20 space-y-1">
          <Block block={block} unit={unit} linker={linker} />
          {block.citations.length > 0 && block.type !== "resource" ? (
            <Citations citations={block.citations} unit={unit} />
          ) : null}
        </div>
      ))}
    </div>
  );
}
