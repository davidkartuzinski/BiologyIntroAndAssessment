import assert from "node:assert/strict";
import { test } from "node:test";
import { courseContent } from "../src/content/course.ts";
import { introductionTutorGuide } from "../src/content/private/introduction-tutor-guide.ts";
import { validateCourse, validateTutorGuide } from "../src/content/validate.ts";
import { buildExportMarkdown, canExport, exportImageName, type ExportAttempt } from "../src/lib/export/markdown.ts";
import { crc32, createZip } from "../src/lib/export/zip.ts";

const { course } = validateCourse(courseContent);
const unit = course.units[0];
const { guide } = validateTutorGuide(introductionTutorGuide, course);

const answerText = "A person has *many* cells.\n\n<b>Not HTML</b> | pipe\nSecond line.";
const attempts: ExportAttempt[] = [
  {
    id: "a1", questionId: "intro-q2", attemptNumber: 1, submittedAt: "2026-11-18T09:00:00Z",
    answer: { text: "First try.", parts: {} }, assistance: "N", unclearWords: "organism",
    reviews: [{ id: "r1", reviewerName: "David", outcome: "revisit", comments: "Add the bacterium.", reviewedAt: "2026-11-18T10:00:00Z" }],
    images: [],
  },
  {
    id: "a2", questionId: "intro-q2", attemptNumber: 2, submittedAt: "2026-11-19T09:00:00Z",
    answer: { text: answerText, parts: {} }, assistance: "I", unclearWords: "",
    reviews: [],
    images: [
      { attachmentId: "p1", fileName: exportImageName(2, 2, 0, "image/jpeg"), contentType: "image/jpeg", sizeBytes: 10, available: true },
      { attachmentId: "p2", fileName: exportImageName(2, 2, 1, "image/png"), contentType: "image/png", sizeBytes: 10, available: false },
    ],
  },
];
const base = { unit, learnerLabel: "Lauren", attempts, exportedAt: new Date("2026-11-19T12:00:00Z"), timeZone: "Asia/Kuala_Lumpur", imagesIncluded: true };

test("export: only an assigned reviewer can export, never another learner", () => {
  assert.equal(canExport("reviewer", ["lauren"], "lauren"), true);
  assert.equal(canExport("reviewer", ["lauren"], "someone-else"), false);
  assert.equal(canExport("learner", ["lauren"], "lauren"), false);
  assert.equal(canExport(null, ["lauren"], "lauren"), false);
  assert.equal(canExport("reviewer", [], "lauren"), false); // not assigned or consent withdrawn
});

test("export: questions appear once each, in assessment order, with section and wording", () => {
  const md = buildExportMarkdown(base);
  const positions = unit.assessment.questions.map((question) => md.indexOf(`## Question ${question.number}: ${question.title}`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.match(md, /Section\/topic: Section A — What does biology study\?/);
  assert.match(md, /Are both organisms\? Explain your answer\./);
  assert.match(md, /Question ID: intro-q2 \(version 1\)/);
});

test("export: written answers are preserved exactly, line by line", () => {
  const md = buildExportMarkdown(base);
  for (const line of answerText.split("\n").filter(Boolean)) assert.ok(md.includes(`> ${line}`), line);
});

test("export: latest submission is the main answer; earlier attempt keeps its own review", () => {
  const md = buildExportMarkdown(base);
  const q2 = md.slice(md.indexOf("## Question 2:"), md.indexOf("## Question 3:"));
  const latest = q2.slice(q2.indexOf("### Latest submitted answer — attempt 2"), q2.indexOf("### Earlier attempts"));
  assert.match(latest, /Review outcome: Awaiting review/); // old Revisit not attached to attempt 2
  assert.doesNotMatch(latest, /Add the bacterium/);
  assert.match(latest, /Support used: Independent \(I\)/);
  assert.match(latest, /Word or phrase found unclear: None recorded/);
  const history = q2.slice(q2.indexOf("### Earlier attempts"));
  assert.match(history, /#### Attempt 1/);
  assert.match(history, /Review outcome: Revisit/);
  assert.match(history, /Reviewed by: David/);
  assert.match(history, /> Add the bacterium\./);
  assert.match(history, /Support used: Used notes or dictionary \(N\)/);
});

test("export: unanswered and awaiting-review questions are labelled, and the report is not final", () => {
  const md = buildExportMarkdown(base);
  assert.match(md, /Status: INCOMPLETE — not a final record/);
  assert.match(md, new RegExp(`not answered: ${unit.assessment.questions.length - 1} · awaiting review: 1`));
  const q1 = md.slice(md.indexOf("## Question 1:"), md.indexOf("## Question 2:"));
  assert.match(q1, /Not answered/);
});

test("export: drafts are never used — only submitted attempts passed in appear", () => {
  const md = buildExportMarkdown({ ...base, attempts: [] });
  assert.equal((md.match(/Not answered/g) ?? []).length, unit.assessment.questions.length);
});

test("export: private guidance only when selected, clearly labelled", () => {
  assert.doesNotMatch(buildExportMarkdown(base), /Private reviewer guidance — not learner-facing/);
  const guidance = new Map(guide.markingGuidance.map((entry) => [entry.questionId, entry]));
  const md = buildExportMarkdown({ ...base, guidance });
  assert.match(md, /### Private reviewer guidance — not learner-facing course content/);
  assert.match(md, /Private reviewer guidance included: yes/);
});

test("export: images map to their attempt with safe relative names, and missing images are named", () => {
  const md = buildExportMarkdown(base);
  assert.match(md, /\[images\/q02-attempt2-photo1\.jpg\]\(images\/q02-attempt2-photo1\.jpg\)/);
  assert.match(md, /\*\*MISSING:\*\* images\/q02-attempt2-photo2\.png could not be exported/);
  assert.match(exportImageName(11, 3, 0, "image/webp"), /^images\/q11-attempt3-photo1\.webp$/);
});

test("export: no identifiers or links leak into the report", () => {
  const md = buildExportMarkdown(base);
  assert.doesNotMatch(md, /user_[A-Za-z0-9]{10,}|@midio|token=|https?:\/\//);
});

test("export: building the report does not mutate the attempt data", () => {
  const before = structuredClone(attempts);
  buildExportMarkdown(base);
  assert.deepEqual(attempts, before);
});

test("zip: produces a valid stored archive with the expected entries", () => {
  const data = new TextEncoder().encode("hello");
  assert.equal(crc32(data), 0x3610a686);
  const zip = createZip([{ name: "report.md", data }, { name: "images/a.jpg", data: new Uint8Array([1, 2, 3]) }]);
  const view = new DataView(zip.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(zip.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(zip.length - 22 + 10, true), 2);
});
