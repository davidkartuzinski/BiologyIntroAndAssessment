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

## Manual checks with real accounts

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
