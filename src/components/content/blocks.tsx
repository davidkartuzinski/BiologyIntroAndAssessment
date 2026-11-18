import Link from "next/link";
import type { ReactNode } from "react";
import type { ContentBlock, Unit, VocabularyTerm } from "@/content/schema.ts";
import { Citations } from "@/components/content/citations";
import { PracticalCard } from "@/components/content/practical-card";
import { ResourceCard } from "@/components/content/resource-card";
import { VocabularyList } from "@/components/content/vocabulary-list";
import { getResource, getTerm } from "@/lib/content";
import { cn } from "@/lib/utils";

/**
 * Links the first use of earlier-defined glossary terms to the glossary.
 * Terms defined at the top of the current section are not linked, because
 * their definitions are already on the page.
 */
export class TermLinker {
  private readonly pattern: RegExp | null;
  private readonly byLabel = new Map<string, VocabularyTerm>();
  private readonly linked = new Set<string>();

  constructor(terms: VocabularyTerm[]) {
    const labels: string[] = [];
    for (const term of terms) {
      if (!term.linkInText) continue;
      for (const label of [term.term, ...term.aliases]) {
        this.byLabel.set(label.toLowerCase(), term);
        labels.push(label);
      }
    }
    labels.sort((a, b) => b.length - a.length);
    const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    this.pattern = escaped.length > 0 ? new RegExp(`\\b(${escaped.join("|")})\\b`, "gi") : null;
  }

  render(text: string): ReactNode {
    if (!this.pattern) return text;
    const nodes: ReactNode[] = [];
    let last = 0;
    for (const match of text.matchAll(this.pattern)) {
      const term = this.byLabel.get(match[0].toLowerCase());
      if (!term || this.linked.has(term.id) || match.index === undefined) continue;
      this.linked.add(term.id);
      nodes.push(text.slice(last, match.index));
      nodes.push(
        <Link
          key={`${term.id}-${match.index}`}
          href={`/study/glossary#term-${term.id}`}
          title={`${term.term}: ${term.definition}`}
          className="underline decoration-dotted underline-offset-4 hover:decoration-solid"
        >
          {match[0]}
        </Link>,
      );
      last = match.index + match[0].length;
    }
    if (nodes.length === 0) return text;
    nodes.push(text.slice(last));
    return nodes;
  }
}

function Block({ block, unit, linker }: { block: ContentBlock; unit: Unit; linker?: TermLinker }) {
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
                          {cell}
                        </th>
                      ) : (
                        <td
                          key={index}
                          className={cn("px-3 py-2", block.numericColumns.includes(index) && "text-right tabular-nums")}
                        >
                          {cell}
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
      const terms = block.termIds.map((termId) => getTerm(unit, termId)).filter((term) => term !== undefined);
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
  linker?: TermLinker;
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
