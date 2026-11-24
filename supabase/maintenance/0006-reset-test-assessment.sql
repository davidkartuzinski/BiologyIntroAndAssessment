-- ============================================================================
-- 0006: ONE-OFF DESTRUCTIVE RESET of test assessment data. NOT a migration.
-- Run manually in the Supabase SQL Editor ONLY after:
--   1. the read-only preview (0006-reset-test-assessment-preview.sql), and
--   2. the Storage cleanup script has deleted the photo files.
--
-- This is ONE statement (a single DO block), so it is atomic on its own:
-- if any check fails or any error occurs, nothing at all is changed.
-- Select ALL of this text (or nothing) before pressing Run.
--
-- Deletes, for ONE learner and ONE assessment, records at or before a FIXED cutoff:
--   answer_drafts, question_attempts, attempt_attachments (rows only),
--   human_reviews, ai_feedback, feedback_flags, feedback_views (for those reviews).
-- Keeps: accounts, roles, reviewer_assignments, consent_records, glossary,
--   course content, buckets/policies, all schema/RLS, and anything after the cutoff.
-- Safe to run again: a second run deletes nothing.
-- Afterwards, run 0006-reset-test-assessment-verify.sql to see the result.
-- ============================================================================

do $reset$
declare
  -- 1) Scope. Must match supabase/maintenance/README.md.
  v_learner    constant text        := 'user_3LpKNJ84Zo6hc1WCkbtDIoX9t9u';   -- Lauren (learner)
  v_assessment constant text        := 'introduction-assessment';
  v_cutoff     constant timestamptz := '2026-11-18 19:00:00+00';             -- 2026-11-19 03:00 Asia/Kuala_Lumpur
  -- 2) Confirmation: must read exactly
  --    RESET introduction-assessment FOR user_3LpKNJ84Zo6hc1WCkbtDIoX9t9u UP TO 2026-11-18 19:00 UTC
  v_confirm    constant text        := 'RESET introduction-assessment FOR user_3LpKNJ84Zo6hc1WCkbtDIoX9t9u UP TO 2026-11-18 19:00 UTC';

  v_questions  constant text[] := array['intro-q1','intro-q2','intro-q3','intro-q4','intro-q5','intro-q6',
                                        'intro-q7','intro-q8','intro-q9','intro-q10','intro-q11','intro-q12'];
  v_attempts   uuid[];
  v_photos     uuid[];
  v_paths      text[];
  n            bigint;
  report       text := '';
begin
  -- 3) Validation. Any exception aborts everything; nothing is deleted.
  if v_assessment <> 'introduction-assessment' then
    raise exception 'Unknown assessment %.', v_assessment;
  end if;
  if not exists (select 1 from public.reviewer_assignments where learner_clerk_user_id = v_learner) then
    raise exception 'Learner % is not an assigned learner. Check the identifier.', v_learner;
  end if;
  if v_cutoff > now() then
    raise exception 'The cutoff % is in the future; it must be a fixed past time.', v_cutoff;
  end if;
  if v_confirm is distinct from
     format('RESET %s FOR %s UP TO %s UTC', v_assessment, v_learner, to_char(v_cutoff at time zone 'UTC', 'YYYY-MM-DD HH24:MI')) then
    raise exception 'Confirmation text missing or wrong. Nothing was deleted.';
  end if;

  -- 4) Fix the exact targets once.
  select coalesce(array_agg(a.id), '{}') into v_attempts
    from public.question_attempts a
   where a.clerk_user_id = v_learner and a.question_id = any(v_questions) and a.submitted_at <= v_cutoff;

  select coalesce(array_agg(x.id), '{}'), coalesce(array_agg(x.storage_path), '{}') into v_photos, v_paths
    from public.attempt_attachments x
   where x.clerk_user_id = v_learner and x.question_id = any(v_questions)
     and (x.attempt_id = any(v_attempts) or (x.attempt_id is null and x.created_at <= v_cutoff));

  -- Conflicts: newer work that depends on targeted test attempts.
  select count(*) into n from public.question_attempts where submitted_at > v_cutoff and revises_attempt_id = any(v_attempts);
  if n > 0 then raise exception 'STOP: % attempt(s) after the cutoff revise targeted test attempts. Nothing was deleted.', n; end if;
  select count(*) into n from public.human_reviews where reviewed_at > v_cutoff and attempt_id = any(v_attempts);
  if n > 0 then raise exception 'STOP: % review(s) were saved after the cutoff on targeted attempts. Nothing was deleted.', n; end if;
  select count(*) into n from public.attempt_attachments where created_at > v_cutoff and attempt_id = any(v_attempts);
  if n > 0 then raise exception 'STOP: % photo(s) added after the cutoff belong to targeted attempts. Nothing was deleted.', n; end if;

  -- 5) Storage must be cleaned first, so the file list is never lost.
  select count(*) into n from storage.objects where bucket_id = 'attempt-photos' and name = any(v_paths);
  if n > 0 then
    raise exception 'STOP: % targeted photo file(s) still exist in Storage. Run the Storage cleanup script first. Nothing was deleted.', n;
  end if;

  -- 6) History tables are protected by *_immutable triggers. For this approved
  --    one-off reset they are disabled within this statement and re-enabled
  --    below. Any error undoes everything, including this.
  alter table public.question_attempts disable trigger question_attempts_immutable;
  alter table public.human_reviews     disable trigger human_reviews_immutable;
  alter table public.ai_feedback       disable trigger ai_feedback_immutable;

  -- 7) Deletes, children first.
  delete from public.feedback_views v using public.human_reviews r
   where v.human_review_id = r.id and r.attempt_id = any(v_attempts);
  get diagnostics n = row_count; report := report || format('feedback_views=%s ', n);

  delete from public.feedback_flags g using public.ai_feedback f
   where g.ai_feedback_id = f.id and f.attempt_id = any(v_attempts);
  get diagnostics n = row_count; report := report || format('feedback_flags=%s ', n);

  delete from public.ai_feedback where attempt_id = any(v_attempts);
  get diagnostics n = row_count; report := report || format('ai_feedback=%s ', n);

  delete from public.human_reviews where attempt_id = any(v_attempts);
  get diagnostics n = row_count; report := report || format('human_reviews=%s ', n);

  delete from public.attempt_attachments where id = any(v_photos);
  get diagnostics n = row_count; report := report || format('attempt_attachments=%s ', n);

  delete from public.question_attempts where id = any(v_attempts);
  get diagnostics n = row_count; report := report || format('question_attempts=%s ', n);

  delete from public.answer_drafts
   where clerk_user_id = v_learner and question_id = any(v_questions) and updated_at <= v_cutoff;
  get diagnostics n = row_count; report := report || format('answer_drafts=%s', n);

  -- 8) Restore protection.
  alter table public.question_attempts enable trigger question_attempts_immutable;
  alter table public.human_reviews     enable trigger human_reviews_immutable;
  alter table public.ai_feedback       enable trigger ai_feedback_immutable;

  raise notice 'Reset complete. Rows deleted: %', report;
end
$reset$;
