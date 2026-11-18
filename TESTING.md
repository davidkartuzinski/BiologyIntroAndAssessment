# Testing

## Automated

```bash
npm test     # content validation, role parsing, upload checks, status precedence
npm run lint
npm run build
```

Checked automatically or by request against a production build (2026-11-19):

- Signed-out requests to `/study/review`, `/study/settings` and the assessment page redirect to sign-in and contain no learner data or marking guidance.
- A signed-out `POST /api/attachments` returns 401.
- Missing, misspelled or unknown roles (`"Reviewer"`, `"tutor"`, `"admin"`, none) never become reviewer (`tests/roles.test.ts`).
- Uploads are checked by file bytes. PDF, HEIC and empty files are rejected, as are files over 10 MB or over the per-question count (`tests/attempts.test.ts`).
- A human review overrides the displayed status, and the AI result is kept (`tests/attempts.test.ts`).
- Learner pages do not import private tutor guidance (`tests/content.test.ts`).
- Photo removal (`tests/attempts.test.ts`):
  - Removing one photo leaves the others in place.
  - A removed photo is not included in the submission.
  - The same file can be chosen again after removal.
  - Removing a photo while it is uploading stops it from reappearing, and the stored copy is deleted.
  - Photos that belong to a submitted attempt cannot be removed.
- Review by question (`tests/attempts.test.ts`):
  - Three attempts produce one queue item, for attempt 3.
  - Reviewing attempt 3 resolves the question. Earlier attempts are kept and are not given reviews of their own.
  - Attempt 4 reopens the question.
  - A draft does not replace a submission.
  - Reviewing an older attempt is refused while a newer one is waiting.
  - "Reviewed" shows the actual outcome; it does not mean mastered.

## Manual results (owner, 2026-11-19)

These passed:

- Lauren is refused the review pages.
- The consent switch saves.
- Drafts save automatically.
- Revisions keep earlier attempts.
- JPEG is accepted; HEIC and PDF are refused, and the written answer stays.
- Photo links expire after 15 minutes, and "Get a new link" works.
- David's queue and review work.
- Switching off consent empties the queue.

## New manual checks: photo removal and review by question

As **Lauren**:

1. Type an answer and upload two JPEGs. Each shows a filename and thumbnail. Press "Remove attachment" on one. The other photo and the written text should stay.
2. Choose the same file again. It should upload.
3. Choose a large photo and press "Remove attachment" while it says "Uploading…". It should not come back, even after refreshing the page.
4. Use Tab to reach "Remove attachment" and press Enter. It should remove the photo without submitting the answer.
5. Submit. The photo should appear under the submitted attempt with no remove button.
6. Submit three attempts. Attempt 3 should appear as "Latest submission". Attempts 1 and 2 should be under "Earlier attempts — history", labelled "Superseded by attempt 3".

As **David**:

1. The question should appear once, as "Attempt 3 (latest of 3)". The review page should say "Attempt 3 — latest submission", with attempts 1 and 2 under "Previous attempts — history only".
2. Review it. The question moves to "Reviewed", and the awaiting count drops by one, not three.
3. Have Lauren submit attempt 4. The question goes back to "Awaiting review" and points to attempt 4. Attempt 3's review is still shown in the history.
4. Open attempt 4, have Lauren submit attempt 5, then save your review of attempt 4. It should be refused with a warning, keep your comments, and link to attempt 5. Attempt 5 should stay "Awaiting review".
5. Review an attempt as "Revisit". Lauren's Progress page should show "Reviewed: Revisit — another attempt suggested".

## Original manual checks with real accounts

These need the two Clerk accounts and the live Supabase project, so they have not been run yet.

As **Lauren** (role `learner`):

1. Open `/study/review` and `/study/review/<any id>`. Expect "You do not have access to this page".
2. Settings: switch on "Let David review my work" and save.
3. Assessment: type an answer, wait a few seconds, and refresh. The draft should still be there.
4. Submit, then edit and submit again. Both attempts should appear under "Your submitted attempts".
5. Upload a JPEG to Q11. Then try a HEIC and a PDF; both should be refused with a message, and the written answer should stay.
6. Choose "View photo", wait more than 15 minutes, and reload the image link. It should fail. "Get a new link" should work.

As **David** (role `reviewer`):

1. The "Review queue" link appears. Lauren's submissions are listed under "Awaiting review".
2. Open a submission. You should see the answer, photos, and private marking guidance. Save a review. The status changes to "Reviewed", and the earlier review (and any AI feedback) is still listed.
3. Have Lauren switch off reviewer access. The queue should become empty.

With any other signed-in account (no role): answers cannot be saved and the review pages are refused.

In Supabase, try `update public.question_attempts set answer = '{}' where true;`. It should fail with "permanent history".

## Round 3 manual checks: review colours, counts, support and unclear words

Results so far: all photo-removal steps and David steps 1–4 passed. David step 5 (Revisit shown to Lauren) failed because Lauren's page was stale (see `DECISIONS.md`). Repeat these:

As **David**:

1. On the dashboard, the blue "Awaiting review" card shows the number of questions (not attempts) awaiting review, or "No submissions awaiting review". The "Review queue" link in the sidebar shows the same number.
2. Open a submission. Above the review form, "Support used" shows the full wording (for example "Independent (I)"), and "Word or phrase Lauren found unclear" shows her text in normal dark type, or "None recorded".
3. Save a review as Revisit. It appears as an orange panel: "Outcome: Revisit", "Reviewed by you", and the date. The queue count drops by one.

As **Lauren**, with her Progress page already open before David saves the Revisit:

4. Switch back to the tab (or press "Check for new reviews"). The question shows an orange "Reviewed: Revisit" badge, the line "Another attempt suggested", and a "New feedback" label. The sidebar Progress link shows a count of new reviews (only once migration 0004 has been applied).
5. Reload the Progress page. The orange panel says "Reviewed by David" with the date, and the "New feedback" label and sidebar count are gone. The review itself is still shown.
6. Check that the assessment page shows the same orange panel under her latest submission, and that the dashboard shows the coloured counts.
7. Submit a new attempt for that question. It returns to the blue dashed "Submitted — awaiting review", and the earlier Revisit appears only in the history.

Colours: Clear is green, Developing yellow, Revisit orange, and Not assessed light grey. Awaiting review is a blue dashed outline. Each always carries its text label.
