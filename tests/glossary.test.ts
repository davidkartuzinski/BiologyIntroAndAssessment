import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { courseContent } from "../src/content/course.ts";
import { validateCourse } from "../src/content/validate.ts";
import {
  buildMatcher,
  cleanAliases,
  entryFromDefault,
  filterEntries,
  planDefaultSeed,
  segmentText,
  validateEntry,
  type GlossaryEntry,
} from "../src/lib/glossary/logic.ts";

const { course } = validateCourse(courseContent);
const defaults = course.units.flatMap((unit) => unit.vocabulary.map((term) => ({ id: term.id, term: term.term, definition: term.definition, aliases: term.aliases })));
const entries = defaults.map(entryFromDefault);
const matcher = buildMatcher(entries);
const linked = (text: string, m = matcher) => segmentText(text, m).map((s) => (s.entry ? `[${s.text}→${s.entry.id}]` : s.text)).join("");

test("glossary: every existing definition is a starting entry, marked as default", () => {
  assert.equal(entries.length, course.units[0].vocabulary.length);
  const cell = entries.find((entry) => entry.id === "cell")!;
  assert.equal(cell.isDefault, true);
  assert.equal(cell.definition, cell.defaultDefinition);
});

test("glossary: seeding again never resets a reviewer's edit, and adds only missing defaults", () => {
  const edited: GlossaryEntry[] = entries.map((entry) => (entry.id === "cell" ? { ...entry, definition: "Edited by David." } : entry)).filter((entry) => entry.id !== "organism");
  const plan = planDefaultSeed(edited, defaults);
  assert.deepEqual(plan.toInsert.map((entry) => entry.id), ["organism"]);
  assert.equal(plan.defaultUpdates.length, 0);
  // A changed default only updates the stored default wording, never the live text.
  const changed = defaults.map((term) => (term.id === "cell" ? { ...term, definition: "New default." } : term));
  const plan2 = planDefaultSeed(edited, changed);
  assert.deepEqual(plan2.defaultUpdates, [{ id: "cell", defaultTerm: "Cell", defaultDefinition: "New default.", defaultAliases: ["cells"] }]);
});

test("glossary: add and edit validation — empty, duplicates, and conflicting aliases", () => {
  assert.ok(validateEntry({ term: " ", definition: "x", aliases: [] }, entries).some((e) => /Enter a word/.test(e)));
  assert.ok(validateEntry({ term: "Thing", definition: " ", aliases: [] }, entries).some((e) => /Enter a definition/.test(e)));
  assert.ok(validateEntry({ term: "CELL", definition: "dup", aliases: [] }, entries).some((e) => /already in the glossary/.test(e)));
  assert.ok(validateEntry({ term: "Tissue", definition: "x", aliases: ["cells"] }, entries).some((e) => /already belongs to “Cell”/.test(e)));
  assert.ok(validateEntry({ term: "Cells", definition: "x", aliases: [] }, entries).some((e) => /alternative form of “Cell”/.test(e)));
  assert.deepEqual(validateEntry({ term: "Tissue", definition: "A group of similar cells.", aliases: ["tissues"] }, entries), []);
  // Editing an entry does not conflict with itself.
  assert.deepEqual(validateEntry({ id: "cell", term: "Cell", definition: "Changed.", aliases: ["cells"] }, entries), []);
  assert.deepEqual(cleanAliases(" cells, Cells ,, organelles "), ["cells", "organelles"]);
});

test("glossary: whole words only, any capitalization, original wording kept", () => {
  assert.equal(linked("CELLS divide; cellular is different."), "[CELLS→cell] divide; cellular is different.");
  assert.equal(linked("A Bacterium."), "A [Bacterium→bacterium].");
});

test("glossary: longest phrase wins and aliases are explicit", () => {
  assert.equal(linked("A chemical reaction occurs."), "A [chemical reaction→chemical-reaction] occurs.");
  assert.equal(linked("Independent variable and variable."), "[Independent variable→independent-variable] and [variable→variable].");
  assert.equal(linked("Bacteria are tiny."), "[Bacteria→bacterium] are tiny.");
});

test("glossary: every occurrence is matched, across line breaks too", () => {
  assert.equal(linked("cell, cell and cell"), "[cell→cell], [cell→cell] and [cell→cell]");
  assert.equal(linked("chemical\nreaction"), "[chemical\nreaction→chemical-reaction]");
});

test("glossary: inactive entries are not matched", () => {
  const off = buildMatcher(entries.map((entry) => (entry.id === "cell" ? { ...entry, active: false } : entry)));
  assert.equal(linked("cell", off), "cell");
});

test("glossary: HTML-like text stays plain text and is never altered", () => {
  const text = "<img src=x onerror=alert(1)> a cell <b>";
  const segments = segmentText(text, matcher);
  assert.equal(segments.map((s) => s.text).join(""), text);
  assert.ok(segments.every((s) => !s.entry || s.text === "cell"));
});

test("glossary: search covers word, alias, and definition", () => {
  assert.ok(filterEntries(entries, "bacteria").some((entry) => entry.id === "bacterium"));
  assert.ok(filterEntries(entries, "smallest unit").some((entry) => entry.id === "cell"));
});

const read = (path: string) => readFileSync(path, "utf8");

test("glossary: triggers are type=button, never links, and do not render HTML", () => {
  const source = read("src/components/glossary/glossary-term.tsx");
  assert.match(source, /type="button"/);
  assert.doesNotMatch(source, /<a |dangerouslySetInnerHTML|href=/);
  assert.match(source, /Popover\.Close/); // explicit dismiss for touch
});

test("glossary: not applied to answer fields, uploads, reviewer views, or exports", () => {
  for (const file of [
    "src/components/attempts/answer-form.tsx",
    "src/components/attempts/photo-upload.tsx",
    "src/components/attempts/changed-answer-text.tsx",
    "src/app/study/review/[attemptId]/page.tsx",
    "src/lib/export/markdown.ts",
    "src/app/api/review/export/route.ts",
  ]) {
    assert.doesNotMatch(read(file), /GlossaryTerm|GlossaryLinker|glossaryForPage|linker/, file);
  }
});

test("glossary: every change action checks the reviewer role on the server", () => {
  const source = read("src/app/study/glossary-actions.ts");
  const actions = source.match(/export async function \w+/g) ?? [];
  assert.equal(actions.length, 3);
  assert.equal((source.match(/await reviewer\(\)/g) ?? []).length, 3);
  assert.match(source, /viewer\.role !== "reviewer"/);
});
