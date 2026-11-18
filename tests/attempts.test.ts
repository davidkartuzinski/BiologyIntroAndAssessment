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

test("progress counts questions, not attempts", () => {
  const questions = [
    { id: "q1", number: 1, title: "One", isReflection: false },
    { id: "q2", number: 2, title: "Two", isReflection: false },
    { id: "q3", number: 3, title: "Three", isReflection: false },
  ];
  const at = (questionId: string, n: number, reviews: { outcome: "clear" | "developing"; reviewedAt: string }[]) => ({ id: `${questionId}-${n}`, learnerId: "l", questionId, attemptNumber: n, submittedAt: `2026-11-19T0${n}:00:00Z`, humanReviews: reviews });
  const rows = questionProgress(questions, [
    at("q1", 1, [{ outcome: "clear", reviewedAt: "2026-11-19T05:00:00Z" }]),
    at("q1", 2, []),
    at("q2", 1, [{ outcome: "developing", reviewedAt: "2026-11-19T05:00:00Z" }]),
  ]);
  assert.equal(rows[0].label, "Submitted — awaiting review");
  assert.equal(rows[1].label, "Reviewed: Developing — another attempt suggested");
  assert.equal(rows[2].state, "not_started");
  const summary = progressSummary(rows);
  assert.equal(summary.submitted, 2);
  assert.equal(summary.totalAttempts, 3);
});

import { addPending, canRemoveAttachment, removeConfirmed, startRemove, uploadFinished } from "../src/lib/attempts/photo-list.ts";
import { canReviewAttempt, latestAttempts, reviewQueueItems, supersededBy } from "../src/lib/attempts/progress.ts";

// Photo removal ----------------------------------------------------------------

test("removing one uploaded photo leaves the others and asks the server to delete only it", () => {
  let items = addPending([], "a", "a.jpg").items;
  items = addPending(items, "b", "b.jpg").items;
  items = uploadFinished(items, "a", "att-a").items;
  items = uploadFinished(items, "b", "att-b").items;
  const change = startRemove(items, "a");
  assert.equal(change.deleteOnServer, "att-a");
  const after = removeConfirmed(change.items, "a").items;
  assert.deepEqual(after.map((item) => item.attachmentId), ["att-b"]);
});

test("a removed photo is excluded, and the same file can be added again", () => {
  let items = uploadFinished(addPending([], "a", "leaf.jpg").items, "a", "att-a").items;
  items = removeConfirmed(startRemove(items, "a").items, "a").items;
  assert.equal(items.length, 0);
  items = addPending(items, "a2", "leaf.jpg").items;
  assert.deepEqual(items.map((item) => item.name), ["leaf.jpg"]);
});

test("removing during upload does not let the late response restore the photo", () => {
  let items = addPending([], "a", "a.jpg").items;
  const removed = startRemove(items, "a");
  assert.equal(removed.deleteOnServer, undefined); // nothing stored yet
  items = removed.items;
  const late = uploadFinished(items, "a", "att-late");
  assert.equal(late.items.length, 0);
  assert.equal(late.deleteOnServer, "att-late"); // stored copy is cleaned up
});

test("photos linked to a submitted attempt, or owned by someone else, cannot be removed", () => {
  assert.equal(canRemoveAttachment({ ownerId: "lauren", attemptId: null }, "lauren"), true);
  assert.equal(canRemoveAttachment({ ownerId: "lauren", attemptId: "attempt-1" }, "lauren"), false);
  assert.equal(canRemoveAttachment({ ownerId: "lauren", attemptId: null }, "david"), false);
});

// Question-level review --------------------------------------------------------

const attempt = (n: number, reviews: { outcome: "clear" | "developing" | "revisit"; reviewedAt: string }[] = [], questionId = "q11", learnerId = "lauren") => ({
  id: `${learnerId}-${questionId}-${n}`,
  learnerId,
  questionId,
  attemptNumber: n,
  submittedAt: `2026-11-19T0${n}:00:00Z`,
  humanReviews: reviews,
});

test("three submitted attempts produce one queue item for attempt 3", () => {
  const items = reviewQueueItems([attempt(1), attempt(2), attempt(3)]);
  assert.equal(items.length, 1);
  assert.equal(items[0].latest.attemptNumber, 3);
  assert.equal(items[0].pending, true);
  assert.equal(items[0].attemptCount, 3);
});

test("reviewing attempt 3 resolves the question; attempts 1 and 2 are kept and not pending", () => {
  const all = [attempt(1), attempt(2), attempt(3, [{ outcome: "clear", reviewedAt: "2026-11-19T10:00:00Z" }])];
  const items = reviewQueueItems(all);
  assert.equal(items.filter((item) => item.pending).length, 0);
  assert.equal(all.length, 3);
  assert.equal(supersededBy(all[0], all), 3);
  assert.equal(all[0].humanReviews.length, 0); // no artificial review on old attempts
});

test("a later attempt reopens the question and points only at the new attempt", () => {
  const all = [attempt(1), attempt(2), attempt(3, [{ outcome: "clear", reviewedAt: "2026-11-19T10:00:00Z" }]), attempt(4)];
  const items = reviewQueueItems(all);
  assert.equal(items.length, 1);
  assert.equal(items[0].latest.attemptNumber, 4);
  assert.equal(items[0].pending, true);
  assert.equal(all[2].humanReviews[0].outcome, "clear"); // attempt 3's review is kept
});

test("a draft does not supersede a submission", () => {
  const rows = questionProgress([{ id: "q11", number: 11, title: "Obs", isReflection: false }], [attempt(1)], new Set(["q11"]));
  assert.equal(rows[0].state, "awaiting_review");
  const draftOnly = questionProgress([{ id: "q11", number: 11, title: "Obs", isReflection: false }], [], new Set(["q11"]));
  assert.equal(draftOnly[0].state, "draft");
});

test("reviewing an older attempt is refused when a newer one is pending", () => {
  const all = [attempt(3), attempt(4)];
  assert.deepEqual(canReviewAttempt(all[0], all), { ok: false, latestAttemptNumber: 4 });
  assert.deepEqual(canReviewAttempt(all[1], all), { ok: true });
});

test("reviewed keeps the actual outcome and does not imply mastery", () => {
  const rows = questionProgress([{ id: "q11", number: 11, title: "Obs", isReflection: false }], [attempt(1, [{ outcome: "revisit", reviewedAt: "2026-11-19T10:00:00Z" }])]);
  assert.equal(rows[0].state, "reviewed");
  assert.equal(rows[0].outcome, "revisit");
  assert.equal(rows[0].anotherAttemptSuggested, true);
  assert.match(rows[0].label, /Revisit — another attempt suggested/);
});

test("attempts are grouped per learner and question, never across them", () => {
  const latest = latestAttempts([attempt(2, [], "q1"), attempt(1, [], "q2"), attempt(5, [], "q1", "other")]);
  assert.equal(latest.length, 3);
});
