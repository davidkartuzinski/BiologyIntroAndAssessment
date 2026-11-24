# One-off maintenance: reset test assessment data (0006)

This is **destructive maintenance, not a migration**. It lives outside `supabase/migrations/` so it can never run automatically. Run it once, by hand, before Lauren starts.

## Recorded scope

| Item | Value |
| --- | --- |
| Learner | `user_3LpKNJ84Zo6hc1WCkbtDIoX9t9u` (Lauren) |
| Assessment | `introduction-assessment` (questions `intro-q1` … `intro-q12`) |
| Cutoff (fixed) | **2026-11-18 19:00 UTC = 2026-11-19 03:00 Asia/Kuala_Lumpur** |
| Bucket | `attempt-photos` |

What the reset removes:

- Lauren's test drafts, submitted attempts, and photo rows and files for this assessment, at or before the cutoff.
- David's reviews of those attempts.
- Any AI feedback and flags on those attempts (there are none).
- Lauren's "feedback seen" records for those reviews.

What it keeps:

- Accounts and roles.
- Reviewer assignments.
- Consent records.
- The glossary, including David's edits.
- Course content and marking guidance.
- Buckets and policies, and all tables, indexes, constraints, RLS and triggers.
- Anything after the cutoff.

The review queue and progress are calculated from these records, so nothing else needs resetting. There are no notification or job tables yet.

If testing continues after 19:00 UTC on 18 November, change the cutoff in all three SQL files and in `scripts/maintenance/reset-scope.mjs`, and record the new value here.

## Files

- `0006-reset-test-assessment-preview.sql`: read-only preview.
- `../../scripts/maintenance/reset-test-assessment-storage.mjs`: deletes photo files through the Storage API. It runs as a dry run by default.
- `0006-reset-test-assessment.sql`: the database cleanup, in one transaction. It refuses to run until the photo files are gone.
- `0006-reset-test-assessment-verify.sql`: read-only checks afterwards.

## Steps

> Storage deletion and the database transaction are **separate operations**. They cannot be rolled back together. Do them in this order and do not skip ahead.

1. **Pause testing.** Ask Lauren not to sign in until you finish. Close any open study tabs.
2. **Preview (read-only).** Paste `0006-reset-test-assessment-preview.sql` into the Supabase SQL Editor and run it. Check:
   - the learner, assessment and cutoff;
   - the counts;
   - the targeted attempts by question;
   - the photo paths;
   - that every `CONFLICT` row is `0`.
3. **Keep evidence you want.** Download the review-queue export (with images) if you want a record.
4. **Create the manifest (dry run, changes nothing):**
   ```bash
   node --env-file=.env.local scripts/maintenance/reset-test-assessment-storage.mjs
   ```
   It prints the scope and each file path, and saves `scripts/maintenance/output/0006-storage-manifest-<time>.json` (gitignored). Check that the paths match the preview.
5. **Delete the photo files listed in that manifest:**
   ```bash
   node --env-file=.env.local scripts/maintenance/reset-test-assessment-storage.mjs --execute --manifest scripts/maintenance/output/0006-storage-manifest-<time>.json --backup
   ```
   - `--backup` saves a local copy of each file first. Leave it off if you don't want copies.
   - If **Failed** is not 0, run the same command again. Files already deleted are reported as "already missing", and nothing else is touched.
   - Do not continue until Failed is 0.
   - Manual alternative: in Supabase → Storage → `attempt-photos`, open Lauren's folder and delete exactly the files listed in the manifest. Never delete the bucket or other folders.
6. **Database cleanup.**
   - Open `0006-reset-test-assessment.sql`.
   - Type the confirmation line exactly, replacing `''` with `'RESET introduction-assessment FOR user_3LpKNJ84Zo6hc1WCkbtDIoX9t9u UP TO 2026-11-18 19:00 UTC'`.
   - Paste the whole file into the SQL Editor and run it.
   - It shows rows deleted per table.
   - If it stops with a message, nothing was deleted. Fix the cause and run it again.
   - A second run reports zeros.
7. **Verify.** Run `0006-reset-test-assessment-verify.sql`. Every "remaining" row should be 0, the reviewer assignment and consent should be kept, and "triggers enabled" should be 3. Then check in the app:
   - **Lauren:** the assessment shows empty answer boxes; Progress shows "Not started" for every question; there are no "New feedback" badges. Lessons, popovers and the glossary still work.
   - **David:** the "Awaiting review" card says "No submissions awaiting review"; there is no sidebar count; the queue is empty. The glossary page still shows his edits.

Things that remain visible on purpose:

- Lauren's consent settings stay as she set them.
- Glossary edits and the text-size preference are unaffected.

## Protection triggers

`question_attempts`, `human_reviews` and `ai_feedback` have `*_immutable` triggers that block edits and deletes. For this approved one-off reset, the cleanup script disables them **inside its transaction** and re-enables them before `COMMIT`. If anything fails, the whole transaction rolls back, including the trigger change.

Tested against fixture data in an in-memory Postgres (PGlite) on 2026-11-18:

- The preview changes nothing.
- A missing confirmation is refused.
- The cleanup refuses to run while targeted files still exist.
- Only in-scope rows are deleted; later work and another learner's work are kept.
- Consent, the glossary and the assignment are preserved.
- The triggers are re-enabled and block deletes again.
- A second run is a no-op.
- A later revision of a test attempt stops everything.
