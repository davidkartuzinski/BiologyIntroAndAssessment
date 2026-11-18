import "server-only";

import { cache } from "react";
import { getCourse } from "@/lib/content";
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  cleanAliases,
  entryFromDefault,
  planDefaultSeed,
  validateEntry,
  type DefaultTerm,
  type EntryDraft,
  type GlossaryEntry,
} from "@/lib/glossary/logic";

export class GlossaryError extends Error {}

type Row = {
  id: string;
  term: string;
  definition: string;
  aliases: string[] | null;
  active: boolean;
  is_default: boolean;
  default_term: string | null;
  default_definition: string | null;
  default_aliases: string[] | null;
  updated_by: string | null;
  updated_at: string | null;
};

const toEntry = (row: Row): GlossaryEntry => ({
  id: row.id,
  term: row.term,
  definition: row.definition,
  aliases: row.aliases ?? [],
  active: row.active,
  isDefault: row.is_default,
  defaultTerm: row.default_term,
  defaultDefinition: row.default_definition,
  defaultAliases: row.default_aliases,
  updatedBy: row.updated_by,
  updatedAt: row.updated_at,
});

const toRow = (entry: GlossaryEntry) => ({
  id: entry.id,
  term: entry.term,
  definition: entry.definition,
  aliases: entry.aliases,
  active: entry.active,
  is_default: entry.isDefault,
  default_term: entry.defaultTerm,
  default_definition: entry.defaultDefinition,
  default_aliases: entry.defaultAliases,
  updated_by: entry.updatedBy,
  updated_at: entry.updatedAt,
});

/** The course content's vocabulary is the default glossary. */
export function defaultTerms(): DefaultTerm[] {
  return getCourse().units.flatMap((unit) => unit.vocabulary.map((term) => ({ id: term.id, term: term.term, definition: term.definition, aliases: term.aliases })));
}

function missingTable(error: { code?: string; message: string } | null) {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || /glossary_entries/.test(error.message)));
}

export type GlossaryLoad = { entries: GlossaryEntry[]; source: "database" | "defaults"; note?: string };

/**
 * Current glossary, read fresh on each request (no rebuild needed after edits).
 * Falls back to the course defaults when the database or table is not ready.
 */
export const loadGlossary = cache(async (): Promise<GlossaryLoad> => {
  const defaults = defaultTerms();
  const fallback = (note: string): GlossaryLoad => ({ entries: defaults.map(entryFromDefault), source: "defaults", note });
  if (!isSupabaseConfigured()) return fallback("Saving is not connected, so the built-in definitions are shown.");
  const client = createServiceClient();
  const result = await client.from("glossary_entries").select("*").order("term");
  if (missingTable(result.error)) return fallback("The glossary table has not been created yet (migration 0005).");
  if (result.error) {
    console.error(`[glossary] load failed: ${result.error.message}`);
    return fallback("The glossary could not be loaded, so the built-in definitions are shown.");
  }
  let entries = (result.data as Row[]).map(toEntry);
  const { toInsert } = planDefaultSeed(entries, defaults);
  if (toInsert.length > 0) {
    // ignoreDuplicates: never overwrite an existing (possibly edited) entry.
    const seeded = await client.from("glossary_entries").upsert(toInsert.map(toRow), { onConflict: "id", ignoreDuplicates: true });
    if (seeded.error) console.error(`[glossary] seeding failed: ${seeded.error.message}`);
    else entries = [...entries, ...toInsert].sort((a, b) => a.term.localeCompare(b.term));
  }
  return { entries, source: "database" };
});

/** Reviewer page only: refresh the stored default wording without touching live text. */
export async function refreshDefaultWording() {
  if (!isSupabaseConfigured()) return;
  const { entries, source } = await loadGlossary();
  if (source !== "database") return;
  const { defaultUpdates } = planDefaultSeed(entries, defaultTerms());
  const client = createServiceClient();
  for (const update of defaultUpdates) {
    await client
      .from("glossary_entries")
      .update({ default_term: update.defaultTerm, default_definition: update.defaultDefinition, default_aliases: update.defaultAliases })
      .eq("id", update.id);
  }
}

async function writableEntries() {
  const { entries, source } = await loadGlossary();
  if (source !== "database") throw new GlossaryError("The glossary cannot be edited until migration 0005 has been applied.");
  return entries;
}

function slug(term: string) {
  const base = term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "term";
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function saveEntry(reviewerId: string, draft: EntryDraft & { active: boolean }) {
  const entries = await writableEntries();
  const clean = { ...draft, term: draft.term.trim().replace(/\s+/g, " "), definition: draft.definition.trim(), aliases: cleanAliases(draft.aliases) };
  const errors = validateEntry(clean, entries);
  if (errors.length) throw new GlossaryError(errors.join(" "));
  const client = createServiceClient();
  const now = new Date().toISOString();
  if (clean.id) {
    if (!entries.some((entry) => entry.id === clean.id)) throw new GlossaryError("That entry no longer exists.");
    const result = await client
      .from("glossary_entries")
      .update({ term: clean.term, definition: clean.definition, aliases: clean.aliases, active: clean.active, updated_by: reviewerId, updated_at: now })
      .eq("id", clean.id);
    if (result.error) throw new GlossaryError(result.error.code === "23505" ? "That word is already in the glossary." : "The entry could not be saved.");
    return clean.id;
  }
  const id = slug(clean.term);
  const result = await client.from("glossary_entries").insert({
    id,
    term: clean.term,
    definition: clean.definition,
    aliases: clean.aliases,
    active: clean.active,
    is_default: false,
    updated_by: reviewerId,
    updated_at: now,
  });
  if (result.error) throw new GlossaryError(result.error.code === "23505" ? "That word is already in the glossary." : "The entry could not be saved.");
  return id;
}

export async function setEntryActive(reviewerId: string, id: string, active: boolean) {
  const entries = await writableEntries();
  if (!entries.some((entry) => entry.id === id)) throw new GlossaryError("That entry no longer exists.");
  const result = await createServiceClient()
    .from("glossary_entries")
    .update({ active, updated_by: reviewerId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (result.error) throw new GlossaryError("The change could not be saved.");
}

export async function restoreDefault(reviewerId: string, id: string) {
  const entries = await writableEntries();
  const entry = entries.find((candidate) => candidate.id === id);
  if (!entry?.isDefault || !entry.defaultTerm || !entry.defaultDefinition) throw new GlossaryError("This entry has no default wording to restore.");
  const restored = { id, term: entry.defaultTerm, definition: entry.defaultDefinition, aliases: entry.defaultAliases ?? [] };
  const errors = validateEntry(restored, entries);
  if (errors.length) throw new GlossaryError(`The default cannot be restored: ${errors.join(" ")}`);
  const result = await createServiceClient()
    .from("glossary_entries")
    .update({ term: restored.term, definition: restored.definition, aliases: restored.aliases, updated_by: reviewerId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (result.error) throw new GlossaryError("The default could not be restored.");
}
