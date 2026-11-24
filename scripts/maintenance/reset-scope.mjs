// Pure scope rules for the one-off 0006 test reset (shared by the Storage script and tests).
// Must stay identical to the SQL in supabase/maintenance/0006-reset-test-assessment*.sql.

export const RECORDED_SCOPE = Object.freeze({
  learnerId: "user_3LpKNJ84Zo6hc1WCkbtDIoX9t9u", // Lauren (learner)
  assessmentId: "introduction-assessment",
  cutoff: "2026-11-18T19:00:00Z", // = 2026-11-19 03:00 Asia/Kuala_Lumpur
  bucket: "attempt-photos",
});

export const ASSESSMENT_QUESTIONS = Object.freeze({
  "introduction-assessment": Array.from({ length: 12 }, (_, i) => `intro-q${i + 1}`),
});

export function validateScope(scope, now = new Date()) {
  const errors = [];
  if (!/^user_[A-Za-z0-9]+$/.test(scope.learnerId ?? "")) errors.push("learner id is missing or malformed");
  if (!ASSESSMENT_QUESTIONS[scope.assessmentId]) errors.push(`unknown assessment ${scope.assessmentId}`);
  const cutoff = new Date(scope.cutoff);
  if (Number.isNaN(cutoff.getTime())) errors.push("cutoff is not a valid timestamp");
  else if (cutoff > now) errors.push("cutoff is in the future; it must be a fixed past time");
  if (scope.bucket !== "attempt-photos") errors.push("unexpected bucket");
  return errors;
}

/**
 * Decides which photo files are in scope. Rows are attempt_attachments joined
 * with their attempt's submitted_at. Only files whose rows are in scope are
 * targeted; a file referenced by any out-of-scope row is never deleted.
 */
export function planStorageCleanup(scope, attachmentRows, attempts) {
  const questions = new Set(ASSESSMENT_QUESTIONS[scope.assessmentId]);
  const cutoff = new Date(scope.cutoff).getTime();
  const targetedAttempts = new Set(
    attempts
      .filter((a) => a.clerk_user_id === scope.learnerId && questions.has(a.question_id) && new Date(a.submitted_at).getTime() <= cutoff)
      .map((a) => a.id),
  );
  const conflicts = [];
  const inScope = [];
  const outOfScopePaths = new Set();
  for (const row of attachmentRows) {
    const isOwner = row.clerk_user_id === scope.learnerId && questions.has(row.question_id);
    const linked = row.attempt_id && targetedAttempts.has(row.attempt_id);
    const draft = !row.attempt_id && new Date(row.created_at).getTime() <= cutoff;
    if (isOwner && (linked || draft)) {
      if (linked && new Date(row.created_at).getTime() > cutoff) conflicts.push(`photo ${row.id} added after cutoff to a targeted attempt`);
      inScope.push(row);
    } else {
      outOfScopePaths.add(row.storage_path);
    }
  }
  const files = inScope
    .filter((row) => !outOfScopePaths.has(row.storage_path))
    .map((row) => ({ path: row.storage_path, attachmentId: row.id, questionId: row.question_id, kind: row.attempt_id ? "submitted" : "draft" }));
  return { files, conflicts, targetedAttemptCount: targetedAttempts.size };
}
