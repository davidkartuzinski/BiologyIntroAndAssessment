# Project decisions

Decisions made by the project owner. Check here before asking again.

| Date | Topic | Decision |
| --- | --- | --- |
| 2026-11-18 | Supabase migrations and RLS | The current setup is acceptable for now (RLS on, no public policies, server uses the service role filtered by Clerk user id). |
| 2026-11-18 | Restricting sign-ups | The owner restricts access in the Clerk dashboard. App-side sign-up stays as is. |
| 2026-11-18 | `/study/notes` test page | Removed. |
| 2026-11-18 | Existing tutor chat | Moved to its own tab at `/study/tutor`. `/study` is now the dashboard. |
| 2026-11-18 | Weekly rest day | Chosen by the learner; leave unset for now. |
| 2026-11-18 | Source PDFs and working docs | `docs/` and `docs/sources/` are gitignored. Source PDFs are never published or linked. |

## Standing rules

- Ask before: weaker security, public access, live emails, paid services, production deployment, deleting existing data.
- Minor styling and reversible implementation details: use sensible defaults without asking.

## Roles, review, consent and uploads (2026-11-18)

- Two human roles: **learner** (Lauren, lauren@midio.ae) and **reviewer** (David, david@midio.ae). No "tutor" role was ever implemented, so the name is "reviewer".
- The AI tutor is a server-side feature, not a user or role.
- Role source: Clerk **public metadata** `role` (`"learner"` or `"reviewer"`). Users cannot edit public metadata. Every protected page and action reads the role on the server (`src/lib/auth/viewer.ts`). A missing or unknown role never grants reviewer access. Hidden navigation is not treated as security.
- Reviewer access is scoped to assigned learners only (Lauren), not to every learner.
- Reviewer can see submissions, attachments, private marking guidance and AI feedback. They can add manual feedback, record a human outcome that overrides the displayed status (the original AI assessment is kept), flag incorrect AI feedback, and see a review queue. The reviewer UI is kept simple: a queue and a detail page.
- Everything is preserved: the original answer, every revision, the original AI feedback, manual feedback, and the reviewer identity and time.
- Consent settings are required before AI processing, reviewer access and submission emails. Emails go to David only after consent and live-email approval.
- Private marking guidance goes to the AI only server-side, and never in learner-facing responses.
- Photos: a private Supabase Storage bucket; JPEG, PNG and WebP up to 10 MB; configurable attachment-count limit; content-based type checks; short-lived signed URLs issued only after an authorization check; no public URLs. The Supabase plan is **paid**: do not describe costs as free-tier.
- HEIC: not accepted at launch. Lauren sees a clear message explaining how to send a JPEG instead. Revisit only with a tested conversion path.
- Written answers must survive upload or AI failures.
- Database and Storage changes go in version-controlled migrations and are applied to a live database only with approval.
- 2026-11-18: David–Lauren link uses the `reviewer_assignments` table (approved).
- 2026-11-18: The owner applies migrations themselves in the Supabase SQL editor; Claude supplies the SQL.
- 2026-11-18: Photo viewing links last **15 minutes**. Reviewer and learner get a "Get a new link" button that issues a fresh link after re-checking access.
- 2026-11-18: Clerk IDs: David (reviewer) user_3Lp5sH36C36Bdo6h2ad7bRAXP7G; Lauren (learner) user_3LpKNJ84Zo6hc1WCkbtDIoX9t9u. Assignment seeded in migration 0003.

## AI deferred (2026-11-19)

- **AI tutor and AI feedback: Deferred — awaiting explicit authorization.** No AI provider calls, no AI keys requested, no AI charges, and no AI-generated feedback, grades, hints or explanations.
- Existing AI code is kept but switched off by the code constant `AI_FEATURES_ENABLED = false` (`src/lib/ai/feature.ts`). `/api/chat` returns 404, the tutor page and nav link are hidden, and the AI consent control is hidden.
- After submitting, Lauren sees "Submitted — awaiting review". David reviews manually. Lauren can keep studying while she waits.
- Progress comes only from real submissions and David's recorded reviews.
- Do not ask about an AI provider or an AI-feedback release policy until the owner reactivates this phase.

## Review display (2026-11-19)

- **Cause of the stale "Revisit":** the review was saved and the progress logic was correct. Lauren's page was a copy kept alive in her browser between navigations, and nothing told it that David had saved a review from another session. Review-dependent pages now refresh their server data when they come back into view or the tab regains focus, and have a "Check for new reviews" button.
- One shared status mapping (`src/lib/attempts/review-status.ts`): Clear is green, Developing yellow, Revisit orange, Not assessed light grey. Awaiting review is a distinct blue dashed outline. Each always has a text label.
- Unread feedback uses the new `feedback_views` table (migration 0004). Until it is applied, the "new" badges are hidden and everything else works.

## Export and glossary (2026-11-19)

- **Export assessment for course planning:** reviewer-only and read-only. Downloads Markdown, or a ZIP with images and a manifest. Optional neutral learner label; private guidance is off by default. Excludes drafts, IDs, emails, tokens and links. Exporting never marks feedback as read or changes the queue.
- **Shared glossary:** the course vocabulary is the default content, stored in `glossary_entries` (migration 0005). David edits it at `/study/review/glossary`, using deactivate rather than delete, and can restore the original default after confirming. Lauren sees in-text definition popovers. Until 0005 is applied, the built-in definitions are shown and editing is disabled.
- Database access follows the existing model: RLS is on with no public policies. The server lets learners read only active entries and lets only the reviewer role write.

## Test-data reset before Lauren starts (2026-11-19)

- A one-off reset is prepared in `supabase/maintenance/` (not a migration), with a fixed cutoff of **2026-11-18 19:00 UTC** for Lauren and the introductory assessment. Photo files are deleted through the Storage API script first; the database SQL then runs in one transaction.
- **Awaiting the owner's approval:** the reset must disable the `*_immutable` history triggers inside its transaction (they are re-enabled before commit, and everything rolls back on any error). Nothing has been run.

## Sidebar structure (2026-11-24)

- Student Dashboard (`/study`; the link navigates and a separate chevron expands) → Courses label → Biology (Course Map, Introductory Unit, Resources, Library, Progress), plus Math and Chemistry "Coming soon" pages.
- Coach Dashboard → Review Queue. Glossary and Settings are top level. Administrator Dashboard → Glossary Editor.
- Coach and Administrator are navigation groups, not pages. No new roles were added. The Administrator group shows for the existing reviewer role, because that role already owns the Glossary Editor. A separate administrator role would be a future change.
- All existing URLs are unchanged.
