import "server-only";

import type { VocabularyTerm } from "@/content/schema.ts";
import { GlossaryLinker } from "@/components/content/blocks";
import { loadGlossary } from "@/lib/glossary/store";

/** Linker plus current wording for lesson word lists, both from the shared glossary. */
export async function glossaryForPage() {
  const { entries } = await loadGlossary();
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return {
    linker: new GlossaryLinker(entries),
    /** Current (possibly edited) wording for a lesson's "Words to understand first" list. */
    current: (term: VocabularyTerm): VocabularyTerm => {
      const entry = byId.get(term.id);
      return entry ? { ...term, term: entry.term, definition: entry.definition } : term;
    },
  };
}
