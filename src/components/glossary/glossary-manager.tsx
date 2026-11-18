"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { restoreGlossaryDefaultAction, saveGlossaryEntryAction, setGlossaryActiveAction, type GlossaryResult } from "@/app/study/glossary-actions";
import { GlossaryTerm } from "@/components/glossary/glossary-term";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { filterEntries, type GlossaryEntry } from "@/lib/glossary/logic";

type Entry = GlossaryEntry & { updatedByName: string | null };
type Form = { id?: string; term: string; definition: string; aliases: string; active: boolean };

const empty: Form = { term: "", definition: "", aliases: "", active: true };
const toForm = (entry: Entry): Form => ({ id: entry.id, term: entry.term, definition: entry.definition, aliases: entry.aliases.join(", "), active: entry.active });

export function GlossaryManager({ entries, editable }: { entries: Entry[]; editable: boolean }) {
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [original, setOriginal] = useState<Form | null>(null);
  const [result, setResult] = useState<GlossaryResult | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = form !== null && JSON.stringify(form) !== JSON.stringify(original);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const shown = useMemo(() => filterEntries(entries, query), [entries, query]);

  function open(next: Form) {
    if (dirty && !window.confirm("You have unsaved changes. Discard them?")) return;
    setForm(next);
    setOriginal(next);
    setResult(null);
  }

  function save() {
    if (!form) return;
    startTransition(async () => {
      const outcome = await saveGlossaryEntryAction(form);
      setResult(outcome);
      if (outcome.ok) {
        const saved = { ...form, id: outcome.id ?? form.id };
        setForm(saved);
        setOriginal(saved);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <label htmlFor="glossary-search" className="block font-medium">Search</label>
          <input
            id="glossary-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Word, alternative form, or definition"
            className="w-full rounded-md border bg-background px-3 py-2"
          />
        </div>
        {editable ? <Button type="button" onClick={() => open(empty)}>Add a word or phrase</Button> : null}
      </div>

      {form ? (
        <section className="space-y-3 rounded-xl border-2 p-4" aria-labelledby="glossary-edit-heading">
          <h2 id="glossary-edit-heading" className="text-lg font-semibold">{form.id ? `Edit “${original?.term}”` : "Add a word or phrase"}</h2>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <div className="space-y-1">
              <label htmlFor="g-term" className="block font-medium">Word or phrase</label>
              <input id="g-term" required value={form.term} onChange={(event) => setForm({ ...form, term: event.target.value })} className="w-full rounded-md border bg-background px-3 py-2" />
            </div>
            <div className="space-y-1">
              <label htmlFor="g-definition" className="block font-medium">Definition</label>
              <Textarea id="g-definition" required rows={3} value={form.definition} onChange={(event) => setForm({ ...form, definition: event.target.value })} />
            </div>
            <div className="space-y-1">
              <label htmlFor="g-aliases" className="block font-medium">Alternative forms (optional, separated by commas)</label>
              <input id="g-aliases" value={form.aliases} onChange={(event) => setForm({ ...form, aliases: event.target.value })} placeholder="for example: cells" className="w-full rounded-md border bg-background px-3 py-2" />
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="size-4" />
              Active (shown to Lauren)
            </label>
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-sm font-medium">Preview of what Lauren sees</p>
              <p className="mt-1">
                …a sentence using{" "}
                {form.term.trim() && form.definition.trim() ? (
                  <GlossaryTerm text={form.term.trim()} term={form.term.trim()} definition={form.definition.trim()} />
                ) : (
                  <em>(enter a word and definition)</em>
                )}{" "}
                in context…
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={pending || !dirty}>{pending ? "Saving…" : "Save"}</Button>
              <Button type="button" variant="outline" onClick={() => { if (!dirty || window.confirm("Discard your changes?")) { setForm(null); setOriginal(null); } }}>
                Cancel
              </Button>
              {dirty ? <span className="text-sm">Unsaved changes</span> : null}
            </div>
            {result ? <p role={result.ok ? "status" : "alert"} className={result.ok ? "text-sm" : "text-sm font-medium text-destructive"}>{result.message}</p> : null}
          </form>
        </section>
      ) : result ? (
        <p role={result.ok ? "status" : "alert"} className="text-sm">{result.message}</p>
      ) : null}

      <p className="text-sm text-muted-foreground">{shown.length} of {entries.length} entries</p>
      <ul className="divide-y rounded-xl border">
        {shown.map((entry) => {
          const changed = entry.isDefault && (entry.term !== entry.defaultTerm || entry.definition !== entry.defaultDefinition || entry.aliases.join("|") !== (entry.defaultAliases ?? []).join("|"));
          return (
            <li key={entry.id} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{entry.term}</span>
                <span className="rounded-md border px-2 py-0.5 text-xs">{entry.isDefault ? (changed ? "Default, edited" : "Default") : "Added by reviewer"}</span>
                {!entry.active ? <span className="rounded-md border border-dashed px-2 py-0.5 text-xs">Inactive — hidden from Lauren</span> : null}
              </div>
              <p>{entry.definition}</p>
              {entry.aliases.length ? <p className="text-sm">Alternative forms: {entry.aliases.join(", ")}</p> : null}
              {entry.updatedAt ? (
                <p className="text-sm text-muted-foreground">Last changed by {entry.updatedByName ?? "a reviewer"}, {new Date(entry.updatedAt).toLocaleString()}</p>
              ) : null}
              {changed ? <p className="text-sm text-muted-foreground">Original default: “{entry.defaultDefinition}”</p> : null}
              {editable ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => open(toForm(entry))}>Edit</Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => startTransition(async () => setResult(await setGlossaryActiveAction(entry.id, !entry.active)))}
                  >
                    {entry.active ? "Deactivate" : "Activate"}
                  </Button>
                  {changed ? (
                    confirmRestore === entry.id ? (
                      <>
                        <span className="text-sm">Replace the current wording with the original default?</span>
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending}
                          onClick={() => startTransition(async () => { setResult(await restoreGlossaryDefaultAction(entry.id)); setConfirmRestore(null); })}
                        >
                          Yes, restore default
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setConfirmRestore(null)}>Keep current wording</Button>
                      </>
                    ) : (
                      <Button type="button" size="sm" variant="outline" onClick={() => setConfirmRestore(entry.id)}>Restore default…</Button>
                    )
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
