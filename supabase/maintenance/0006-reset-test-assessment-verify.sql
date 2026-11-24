-- READ-ONLY verification after the 0006 reset. Every "remaining" row should be 0;
-- "kept" rows show what was intentionally preserved.
with params as (select 'user_3LpKNJ84Zo6hc1WCkbtDIoX9t9u'::text as learner_id, timestamptz '2026-11-18 19:00:00+00' as cutoff)
select 'remaining: question_attempts (intro, before cutoff)' as check_item, count(*) as n from public.question_attempts a, params p where a.clerk_user_id = p.learner_id and a.question_id like 'intro-q%' and a.submitted_at <= p.cutoff
union all select 'remaining: answer_drafts (intro, before cutoff)', count(*) from public.answer_drafts d, params p where d.clerk_user_id = p.learner_id and d.question_id like 'intro-q%' and d.updated_at <= p.cutoff
union all select 'remaining: attempt_attachments (intro, before cutoff)', count(*) from public.attempt_attachments x, params p where x.clerk_user_id = p.learner_id and x.question_id like 'intro-q%' and x.created_at <= p.cutoff
union all select 'remaining: human_reviews on learner attempts', count(*) from public.human_reviews r join public.question_attempts a on a.id = r.attempt_id, params p where a.clerk_user_id = p.learner_id and a.submitted_at <= p.cutoff
union all select 'remaining: feedback_views for learner', count(*) from public.feedback_views v, params p where v.clerk_user_id = p.learner_id and v.viewed_at <= now()
union all select 'remaining: photo files under learner folder (Storage)', count(*) from storage.objects o, params p where o.bucket_id = 'attempt-photos' and o.name like p.learner_id || '/intro-q%'
union all select 'kept: reviewer_assignments', count(*) from public.reviewer_assignments
union all select 'kept: consent_records', count(*) from public.consent_records
union all select 'kept: work after cutoff (attempts)', count(*) from public.question_attempts a, params p where a.submitted_at > p.cutoff
union all select 'triggers enabled (should be 3)', count(*) from pg_trigger where tgname in ('question_attempts_immutable','human_reviews_immutable','ai_feedback_immutable') and tgenabled = 'O';
