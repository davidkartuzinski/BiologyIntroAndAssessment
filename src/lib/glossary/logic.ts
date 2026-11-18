/**
 * Shared glossary: pure matching, validation, and default-seeding rules.
 * No I/O here, so every rule is unit-tested.
 */

export type GlossaryEntry = {
  id: string;
  term: string;
  definition: string;
  aliases: string[];
  active: boolean;
  isDefault: boolean;
  /** Original default wording, kept so it can be restored. */
  defaultTerm: string | null;
  defaultDefinition: string | null;
  defaultAliases: string[] | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type DefaultTerm = { id: string; term: string; definition: string; aliases: string[] };

export function entryFromDefault(term: DefaultTerm): GlossaryEntry {
  return {
    id: term.id,
    term: term.term,
    definition: term.definition,
    aliases: term.aliases,
    active: true,
    isDefault: true,
    defaultTerm: term.term,
    defaultDefinition: term.definition,
    defaultAliases: term.aliases,
    updatedBy: null,
    updatedAt: null,
  };
}

/**
 * Seeding plan. Missing defaults are inserted; for existing rows only the
 * stored default_* columns are refreshed, never the live term/definition,
 * so a reviewer's edits are never reset.
 */
export function planDefaultSeed(existing: GlossaryEntry[], defaults: DefaultTerm[]) {
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  const toInsert = defaults.filter((term) => !byId.has(term.id)).map(entryFromDefault);
  const defaultUpdates = defaults
    .filter((term) => {
      const row = byId.get(term.id);
      return row && (row.defaultTerm !== term.term || row.defaultDefinition !== term.definition || JSON.stringify(row.defaultAliases ?? []) !== JSON.stringify(term.aliases));
    })
    .map((term) => ({ id: term.id, defaultTerm: term.term, defaultDefinition: term.definition, defaultAliases: term.aliases }));
  return { toInsert, defaultUpdates };
}

const norm = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");

export function cleanAliases(raw: string[] | string): string[] {
  const list = Array.isArray(raw) ? raw : raw.split(/[,\n]/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const alias of list.map((value) => value.trim().replace(/\s+/g, " ")).filter(Boolean)) {
    if (!seen.has(norm(alias))) {
      seen.add(norm(alias));
      out.push(alias);
    }
  }
  return out;
}

export type EntryDraft = { id?: string; term: string; definition: string; aliases: string[] };

/** Validation for add/edit. `others` are all other entries (active or not). */
export function validateEntry(draft: EntryDraft, others: GlossaryEntry[]): string[] {
  const errors: string[] = [];
  const term = draft.term.trim();
  if (!term) errors.push("Enter a word or phrase.");
  if (!draft.definition.trim()) errors.push("Enter a definition.");
  if (term.length > 80) errors.push("Keep the word or phrase under 80 characters.");
  if (draft.definition.length > 1000) errors.push("Keep the definition under 1000 characters.");
  const ownForms = [term, ...draft.aliases].map(norm).filter(Boolean);
  if (new Set(ownForms).size !== ownForms.length) errors.push("An alternative form repeats the word itself.");
  for (const other of others) {
    if (other.id === draft.id) continue;
    if (norm(other.term) === norm(term)) errors.push(`“${other.term}” is already in the glossary.`);
    const theirForms = new Set([other.term, ...other.aliases].map(norm));
    for (const form of draft.aliases) {
      if (theirForms.has(norm(form))) errors.push(`The alternative form “${form}” already belongs to “${other.term}”.`);
    }
    if (other.aliases.some((alias) => norm(alias) === norm(term))) errors.push(`“${term}” is already an alternative form of “${other.term}”.`);
  }
  return [...new Set(errors)];
}

export type TextSegment = { text: string; entry?: GlossaryEntry };

export type Matcher = { pattern: RegExp; byForm: Map<string, GlossaryEntry> } | null;

/** Builds a matcher over active entries: whole words, any capitalization, longest phrase first. */
export function buildMatcher(entries: GlossaryEntry[]): Matcher {
  const byForm = new Map<string, GlossaryEntry>();
  for (const entry of entries) {
    if (!entry.active) continue;
    for (const form of [entry.term, ...entry.aliases]) {
      const key = norm(form);
      if (key && !byForm.has(key)) byForm.set(key, entry);
    }
  }
  if (byForm.size === 0) return null;
  const forms = [...byForm.keys()].sort((a, b) => b.length - a.length);
  const escaped = forms.map((form) => form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"));
  // Unicode-aware whole-word boundaries, so "cell" never matches inside "cellular".
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_-])(${escaped.join("|")})(?![\\p{L}\\p{N}_])`, "giu");
  return { pattern, byForm };
}

/** Splits text into plain and glossary segments. Every occurrence is matched; text is never altered. */
export function segmentText(text: string, matcher: Matcher): TextSegment[] {
  if (!matcher || !text) return [{ text }];
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(matcher.pattern)) {
    const entry = matcher.byForm.get(norm(match[0]));
    if (!entry || match.index === undefined) continue;
    if (match.index > last) segments.push({ text: text.slice(last, match.index) });
    segments.push({ text: match[0], entry });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments.length ? segments : [{ text }];
}

export function filterEntries<T extends GlossaryEntry>(entries: T[], query: string): T[] {
  const q = norm(query);
  if (!q) return entries;
  return entries.filter((entry) => [entry.term, entry.definition, ...entry.aliases].some((value) => norm(value).includes(q)));
}
