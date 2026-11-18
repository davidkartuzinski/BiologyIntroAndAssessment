import assert from "node:assert/strict";
import { test } from "node:test";
import { checkUpload, displayStatus, isEmptyAnswer, normaliseAnswer, sniffImageType } from "../src/lib/attempts/logic.ts";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
const heic = new Uint8Array([0, 0, 0, 24, ...new TextEncoder().encode("ftypheic"), 0, 0]);
const pdf = new TextEncoder().encode("%PDF-1.7 not an image");

test("image type comes from file bytes, not names", () => {
  assert.equal(sniffImageType(jpeg), "image/jpeg");
  assert.equal(sniffImageType(png), "image/png");
  assert.equal(sniffImageType(webp), "image/webp");
  assert.equal(sniffImageType(pdf), null);
});

test("HEIC is rejected with a helpful message", () => {
  const result = checkUpload(heic, 0, 5);
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.message, /HEIC/);
});

test("size and count limits are enforced", () => {
  assert.equal(checkUpload(new Uint8Array(10 * 1024 * 1024 + 1).fill(0xff), 0, 5).ok, false);
  assert.equal(checkUpload(jpeg, 5, 5).ok, false);
  assert.equal(checkUpload(new Uint8Array(), 0, 5).ok, false);
  assert.equal(checkUpload(pdf, 0, 5).ok, false);
  assert.deepEqual(checkUpload(jpeg, 4, 5), { ok: true, type: "image/jpeg" });
});

test("a human review takes precedence but AI status is used when no human review exists", () => {
  assert.deepEqual(displayStatus("clear", "revisit"), { source: "human", status: "clear" });
  assert.deepEqual(displayStatus(null, "revisit"), { source: "ai", status: "revisit" });
  assert.deepEqual(displayStatus(null, null), { source: "none", status: "awaiting_feedback" });
});

test("answers keep only known parts and enforce length", () => {
  const result = normaliseAnswer({ parts: { a: " seven ", injected: "x" } }, ["a", "b"]);
  assert.deepEqual(result, { ok: true, answer: { text: "", parts: { a: "seven", b: "" } } });
  assert.equal(normaliseAnswer({ text: "x".repeat(5001) }, []).ok, false);
  assert.equal(isEmptyAnswer({ text: "", parts: { a: "" } }), true);
});

import { progressSummary, questionProgress } from "../src/lib/attempts/progress.ts";

test("progress counts only real submissions and human reviews", () => {
  const questions = [
    { id: "q1", number: 1, title: "One", isReflection: false },
    { id: "q2", number: 2, title: "Two", isReflection: false },
    { id: "q3", number: 3, title: "Three", isReflection: false },
  ];
  const rows = questionProgress(questions, [
    { questionId: "q1", attemptNumber: 1, submittedAt: "2026-11-19T01:00:00Z", humanReviews: [{}], status: { source: "human", status: "clear" } },
    { questionId: "q1", attemptNumber: 2, submittedAt: "2026-11-19T02:00:00Z", humanReviews: [], status: { source: "none", status: "awaiting_feedback" } },
    { questionId: "q2", attemptNumber: 1, submittedAt: "2026-11-19T01:00:00Z", humanReviews: [{}], status: { source: "human", status: "developing" } },
  ]);
  assert.equal(rows[0].state, "awaiting_review"); // latest revision not yet reviewed
  assert.equal(rows[0].label, "Submitted — awaiting review");
  assert.equal(rows[1].label, "Reviewed: Developing");
  assert.equal(rows[2].state, "not_started");
  assert.deepEqual(progressSummary(rows), { total: 3, submitted: 2, awaitingReview: 1, reviewed: 1 });
});
