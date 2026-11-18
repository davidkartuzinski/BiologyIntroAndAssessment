import assert from "node:assert/strict";
import { test } from "node:test";
import { courseContent } from "../src/content/course.ts";
import { introductionTutorGuide } from "../src/content/private/introduction-tutor-guide.ts";
import { validateCourse, validateTutorGuide } from "../src/content/validate.ts";
import { manifestCsv, planExportImages, verifyPackage, type PlannedImageInput } from "../src/lib/export/images.ts";
import { buildExportMarkdown, canExport, type ExportAttempt } from "../src/lib/export/markdown.ts";
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
      { attachmentId: "p1", path: "images/q02-attempt2-photo1.jpg", status: "included" },
      { attachmentId: "p2", path: "images/q02-attempt2-photo2.unavailable", status: "missing" },
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

test("export: report links use the canonical path, and missing images are not shown as links", () => {
  const md = buildExportMarkdown(base);
  assert.match(md, /\[Photo 1\]\(images\/q02-attempt2-photo1\.jpg\)/);
  assert.match(md, /\*\*NOT EXPORTED:\*\* Photo 2 — the stored file could not be found\./);
  assert.doesNotMatch(md, /\(images\/q02-attempt2-photo2/);
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

// Image packaging ----------------------------------------------------------------

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 4, 5]);
const NOT_IMAGE = new TextEncoder().encode("%PDF-1.7");

const photo = (over: Partial<PlannedImageInput>): PlannedImageInput => ({
  attachmentId: "x", questionId: "intro-q1", questionNumber: 1, attemptId: "att4", attemptNumber: 4, index: 0, recordedType: "image/png", bytes: PNG, ...over,
});

function packageFor(inputs: PlannedImageInput[]) {
  const planned = planExportImages(inputs, true);
  const attemptsFor: ExportAttempt[] = [...new Set(planned.map((image) => image.attemptId))].map((attemptId) => {
    const first = inputs.find((input) => input.attemptId === attemptId)!;
    return {
      id: attemptId, questionId: first.questionId, attemptNumber: first.attemptNumber, submittedAt: "2026-11-19T01:00:00Z",
      answer: { text: "answer", parts: {} }, assistance: "I", unclearWords: "", reviews: [],
      images: planned.filter((image) => image.attemptId === attemptId).map((image) => ({ attachmentId: image.attachmentId, path: image.path, status: image.status })),
    };
  });
  const report = buildExportMarkdown({ ...base, attempts: attemptsFor });
  const manifest = manifestCsv(planned, (questionId) => (questionId === "intro-q1" ? 1 : 2));
  const entries = new Map<string, Uint8Array>(planned.filter((image) => image.bytes).map((image) => [image.path, image.bytes!]));
  return { planned, report, manifest, entries };
}

test("images: extension follows the bytes — a JPEG recorded as PNG becomes .jpg; a real PNG stays .png", () => {
  const { planned } = packageFor([
    photo({ attachmentId: "j", recordedType: "image/png", bytes: JPEG }),
    photo({ attachmentId: "p", index: 1, recordedType: "image/png", bytes: PNG }),
  ]);
  assert.equal(planned[0].path, "images/q01-attempt4-photo1.jpg");
  assert.equal(planned[0].detectedType, "image/jpeg");
  assert.equal(planned[1].path, "images/q01-attempt4-photo2.png");
  assert.deepEqual(planned[0].bytes, JPEG); // bytes are never converted
});

test("images: one path for ZIP entry, manifest, and report; the package verifies cleanly", () => {
  const { planned, report, manifest, entries } = packageFor([
    photo({ attachmentId: "a", bytes: PNG }),
    photo({ attachmentId: "b", index: 1, bytes: JPEG }),
    photo({ attachmentId: "c", attemptId: "att3", attemptNumber: 3, bytes: PNG }), // earlier attempt
    photo({ attachmentId: "d", questionId: "intro-q2", questionNumber: 2, attemptId: "q2a1", attemptNumber: 1, bytes: JPEG }),
  ]);
  assert.deepEqual(verifyPackage(report, manifest, entries), []);
  for (const image of planned) {
    assert.ok(entries.has(image.path));
    assert.ok(manifest.includes(`${image.path},${image.questionId},`));
    assert.ok(report.includes(`(${image.path})`));
  }
  assert.equal(new Set(planned.map((image) => image.path)).size, planned.length); // unique across attempts
  assert.match(manifest, /images\/q01-attempt3-photo1\.png,intro-q1,1,3,image\/png,included/);
});

test("images: missing and unrecognisable files are reported as failures, never as included links", () => {
  const { planned, report, manifest, entries } = packageFor([
    photo({ attachmentId: "m", bytes: null }),
    photo({ attachmentId: "u", index: 1, bytes: NOT_IMAGE }),
  ]);
  assert.deepEqual(planned.map((image) => image.status), ["missing", "unsupported"]);
  assert.equal(entries.size, 0);
  assert.match(manifest, /,intro-q1,1,4,,missing/);
  assert.match(manifest, /,intro-q1,1,4,,unsupported/);
  assert.doesNotMatch(report, /\]\(images\//);
  assert.deepEqual(verifyPackage(report, manifest, entries), []);
});

test("images: the verifier catches a renamed or mismatched file", () => {
  const { report, manifest } = packageFor([photo({ attachmentId: "a", bytes: PNG })]);
  // Simulate the observed problem: the PNG is present under a .jpg name instead.
  const renamed = new Map([["images/q01-attempt4-photo1.jpg", PNG]]);
  const problems = verifyPackage(report, manifest, renamed);
  assert.ok(problems.some((problem) => /manifest file not in ZIP: images\/q01-attempt4-photo1\.png/.test(problem)));
  assert.ok(problems.some((problem) => /report link not in ZIP/.test(problem)));
});
