import { GlossaryManager } from "@/components/glossary/glossary-manager";
import { PageShell } from "@/components/page-shell";
import { requireRole } from "@/lib/auth/viewer";
import { reviewerNames } from "@/lib/attempts/store";
import { loadGlossary, refreshDefaultWording } from "@/lib/glossary/store";

export default async function ManageGlossaryPage() {
  await requireRole("reviewer");
  await refreshDefaultWording();
  const { entries, source, note } = await loadGlossary();
  const names = await reviewerNames(entries.flatMap((entry) => (entry.updatedBy ? [entry.updatedBy] : []))).catch(() => new Map<string, string>());
  return (
    <PageShell title="Glossary" intro="Definitions Lauren sees when she taps a dotted-underlined word. Changes appear on her next page load.">
      {source !== "database" ? (
        <p role="status" className="rounded-lg border border-amber-500/50 bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
          {note} Editing is available once the glossary table exists.
        </p>
      ) : null}
      <GlossaryManager
        editable={source === "database"}
        entries={entries.map((entry) => ({ ...entry, updatedByName: entry.updatedBy ? (names.get(entry.updatedBy) ?? "a reviewer") : null }))}
      />
    </PageShell>
  );
}
