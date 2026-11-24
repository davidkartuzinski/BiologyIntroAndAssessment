import assert from "node:assert/strict";
import { test } from "node:test";
import { planStorageCleanup, RECORDED_SCOPE, validateScope } from "../scripts/maintenance/reset-scope.mjs";

const L = RECORDED_SCOPE.learnerId;
const attempts = [
  { id: "a1", clerk_user_id: L, question_id: "intro-q1", submitted_at: "2026-11-18T16:00:00Z" },
  { id: "a2", clerk_user_id: L, question_id: "intro-q1", submitted_at: "2026-11-20T09:00:00Z" }, // real, after cutoff
  { id: "o1", clerk_user_id: "user_Other", question_id: "intro-q1", submitted_at: "2026-11-18T16:00:00Z" },
];
const row = (id: string, over: Record<string, unknown>) => ({ id, clerk_user_id: L, question_id: "intro-q1", attempt_id: "a1", storage_path: `${L}/intro-q1/${id}.png`, created_at: "2026-11-18T16:00:00Z", ...over });

test("maintenance: the recorded scope is valid once its cutoff has passed", () => {
  assert.deepEqual(validateScope(RECORDED_SCOPE, new Date("2026-11-19T00:00:00Z")), []);
  assert.ok(validateScope(RECORDED_SCOPE, new Date("2026-11-18T18:00:00Z")).some((e: string) => /future/.test(e)));
  assert.ok(validateScope({ ...RECORDED_SCOPE, learnerId: "" }).length > 0);
  assert.ok(validateScope({ ...RECORDED_SCOPE, assessmentId: "everything" }).length > 0);
});

test("maintenance: only test photos (submitted or draft, before cutoff) for this learner are targeted", () => {
  const plan = planStorageCleanup(RECORDED_SCOPE, [
    row("p1", {}),
    row("draft", { attempt_id: null }),
    row("real", { attempt_id: "a2", created_at: "2026-11-20T09:00:00Z" }),
    row("lateDraft", { attempt_id: null, created_at: "2026-11-20T08:00:00Z" }),
    row("other", { clerk_user_id: "user_Other", attempt_id: "o1", storage_path: "user_Other/intro-q1/x.png" }),
  ], attempts);
  assert.deepEqual(plan.files.map((f: { path: string }) => f.path).sort(), [`${L}/intro-q1/draft.png`, `${L}/intro-q1/p1.png`]);
  assert.equal(plan.conflicts.length, 0);
});

test("maintenance: a photo added after the cutoff to a test attempt is a conflict", () => {
  const plan = planStorageCleanup(RECORDED_SCOPE, [row("late", { created_at: "2026-11-20T09:00:00Z" })], attempts);
  assert.equal(plan.conflicts.length, 1);
});

test("maintenance: a file also referenced outside the scope is never targeted", () => {
  const shared = `${L}/intro-q1/shared.png`;
  const plan = planStorageCleanup(RECORDED_SCOPE, [row("a", { storage_path: shared }), row("b", { attempt_id: "a2", created_at: "2026-11-20T09:00:00Z", storage_path: shared })], attempts);
  assert.equal(plan.files.length, 0);
});
