import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { courseContent } from "../src/content/course.ts";
import { introductionTutorGuide } from "../src/content/private/introduction-tutor-guide.ts";
import type { CourseInput } from "../src/content/schema.ts";
import { validateCourse, validateTutorGuide } from "../src/content/validate.ts";

const clone = <T>(value: T): T => structuredClone(value);

test("authored course content passes validation", () => {
  const { issues } = validateCourse(courseContent);
  assert.deepEqual(issues, []);
});

test("tutor guide matches every assessment question exactly once", () => {
  const { course } = validateCourse(courseContent);
  const { issues } = validateTutorGuide(introductionTutorGuide, course);
  assert.deepEqual(issues, []);
});

test("the introductory package keeps its twelve questions in order", () => {
  const { course } = validateCourse(courseContent);
  const numbers = course.units[0].assessment.questions.map((question) => question.number);
  assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test("only question 12 is a reflection", () => {
  const { course } = validateCourse(courseContent);
  const reflections = course.units[0].assessment.questions.filter((question) => question.isReflection);
  assert.deepEqual(reflections.map((question) => question.number), [12]);
});

test("a question that assesses an untaught concept is rejected", () => {
  const input = clone(courseContent) as CourseInput;
  const question = input.units[0].assessment.questions[0];
  question.assessedConceptIds = ["respiration-not-breathing"]; // taught in B, question references A
  const { issues } = validateCourse(input);
  assert.ok(issues.some((issue) => issue.message.includes("not taught in the referenced sections")));
});

test("a teaching reference to a missing block is rejected", () => {
  const input = clone(courseContent) as CourseInput;
  input.units[0].assessment.questions[1].teachingReferences = [{ sectionId: "section-a", blockId: "does-not-exist" }];
  const { issues } = validateCourse(input);
  assert.ok(issues.some((issue) => issue.message.includes("unknown block")));
});

test("private answer fields added to learner questions are stripped by the schema", () => {
  const input = clone(courseContent) as CourseInput;
  (input.units[0].assessment.questions[0] as Record<string, unknown>).evidenceOfUnderstanding = "leak";
  const { course } = validateCourse(input);
  assert.equal("evidenceOfUnderstanding" in course.units[0].assessment.questions[0], false);
});

test("an unknown syllabus citation is rejected", () => {
  const input = clone(courseContent) as CourseInput;
  input.units[0].sections[0].contentBlocks[0].citations = [{ kind: "syllabus", refId: "syl-made-up" }];
  const { issues } = validateCourse(input);
  assert.ok(issues.some((issue) => issue.message.includes("syl-made-up")));
});

test("a term used before its section defines it is rejected", () => {
  const input = clone(courseContent) as CourseInput;
  input.units[0].sections[0].termsBeforeUse = input.units[0].sections[0].termsBeforeUse?.filter((id) => id !== "cell");
  const { issues } = validateCourse(input);
  assert.ok(issues.some((issue) => issue.path.endsWith("vocabulary.cell")));
});

test("source documents can never be marked publishable", () => {
  const input = clone(courseContent) as CourseInput;
  (input.sourceDocuments[0] as { publishable: boolean }).publishable = true;
  const { issues } = validateCourse(input);
  assert.ok(issues.length > 0);
});

test("no temporary upload links or local source paths appear in content or app code", () => {
  const forbidden = [/ppl-ai-file-upload/i, /X-Amz-Signature/i, /docs\/sources/i, /\.pdf\b/i];
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx|json|md)$/.test(entry)) files.push(path);
    }
  };
  walk("src");
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.equal(pattern.test(text), false, `${file} contains ${pattern}`);
    }
  }
});

test("learner-facing code never imports private tutor guidance", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(entry)) files.push(path);
    }
  };
  walk("src");
  // Only the server-only loader and reviewer pages (which call requireRole("reviewer")) may import it.
  const allowed = new Set([join("src", "lib", "content", "tutor-guide.ts"), join("src", "app", "study", "review", "[attemptId]", "page.tsx"), join("src", "app", "api", "review", "export", "route.ts")]);
  for (const file of files) {
    if (file.startsWith(join("src", "content", "private"))) continue;
    const text = readFileSync(file, "utf8");
    if (/(?:from|import)\s*\(?\s*["'][^"']*(?:content\/private|\.\/private\/|lib\/content\/tutor-guide)[^"']*["']/.test(text)) {
      assert.ok(allowed.has(file), `${file} imports private tutor guidance`);
    }
  }
});
