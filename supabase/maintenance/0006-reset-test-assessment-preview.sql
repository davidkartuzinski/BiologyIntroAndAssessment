-- READ-ONLY PREVIEW for the one-off test-data reset (0006). Changes nothing.
-- Paste into the Supabase SQL Editor and run. Edit the three values below
-- only if they differ from the recorded scope in supabase/maintenance/README.md.

with params as (
  select
    'user_3LpKNJ84Zo6hc1WCkbtDIoX9t9u'::text            as learner_id,      -- Lauren (learner)
    'introduction-assessment'::text                      as assessment_id,
    timestamptz '2026-11-18 19:00:00+00'                  as cutoff          -- = 2026-11-19 03:00 Asia/Kuala_Lumpur
),
questions(question_id) as (
  values ('intro-q1'),('intro-q2'),('intro-q3'),('intro-q4'),('intro-q5'),('intro-q6'),
         ('intro-q7'),('intro-q8'),('intro-q9'),('intro-q10'),('intro-q11'),('intro-q12')
),
t_attempts as (
  select a.* from public.question_attempts a, params p
  where a.clerk_user_id = p.learner_id and a.question_id in (select question_id from questions) and a.submitted_at <= p.cutoff
),
t_reviews as (select r.* from public.human_reviews r where r.attempt_id in (select id from t_attempts)),
t_ai as (select f.* from public.ai_feedback f where f.attempt_id in (select id from t_attempts)),
t_photos as (
  select x.* from public.attempt_attachments x, params p
  where x.clerk_user_id = p.learner_id and x.question_id in (select question_id from questions)
    and (x.attempt_id in (select id from t_attempts) or (x.attempt_id is null and x.created_at <= p.cutoff))
),
t_drafts as (
  select d.* from public.answer_drafts d, params p
  where d.clerk_user_id = p.learner_id and d.question_id in (select question_id from questions) and d.updated_at <= p.cutoff
)
select 1 as ord, 'scope' as section, 'learner' as item,
       (select learner_id from params) || case when exists (select 1 from public.reviewer_assignments where learner_clerk_user_id = (select learner_id from params)) then ' (assigned learner: OK)' else ' (NOT an assigned learner: STOP)' end as detail
union all select 2, 'scope', 'assessment', (select assessment_id from params) || ' — questions intro-q1 … intro-q12'
union all select 3, 'scope', 'cutoff', to_char((select cutoff from params) at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC = ' || to_char((select cutoff from params) at time zone 'Asia/Kuala_Lumpur', 'YYYY-MM-DD HH24:MI') || ' Asia/Kuala_Lumpur'
union all select 10, 'counts to delete', 'question_attempts', count(*)::text from t_attempts
union all select 11, 'counts to delete', 'human_reviews', count(*)::text from t_reviews
union all select 12, 'counts to delete', 'feedback_views', count(*)::text from public.feedback_views v where v.human_review_id in (select id from t_reviews)
union all select 13, 'counts to delete', 'ai_feedback', count(*)::text from t_ai
union all select 14, 'counts to delete', 'feedback_flags', count(*)::text from public.feedback_flags g where g.ai_feedback_id in (select id from t_ai)
union all select 15, 'counts to delete', 'attempt_attachments (rows)', count(*)::text from t_photos
union all select 16, 'counts to delete', 'answer_drafts', count(*)::text from t_drafts
union all select 20, 'targeted attempt', a.question_id || ' attempt ' || a.attempt_number, to_char(a.submitted_at at time zone 'Asia/Kuala_Lumpur', 'YYYY-MM-DD HH24:MI') || ' KL · reviews: ' || (select count(*) from t_reviews r where r.attempt_id = a.id) from t_attempts a
union all select 30, 'storage object (bucket attempt-photos)', x.storage_path, x.content_type || ' · ' || x.size_bytes || ' bytes · ' || case when x.attempt_id is null then 'draft photo' else 'submitted photo' end || case when exists (select 1 from storage.objects o where o.bucket_id = 'attempt-photos' and o.name = x.storage_path) then ' · file present' else ' · FILE ALREADY MISSING' end from t_photos x
union all select 40, 'PROTECTED (after cutoff, kept)', 'question_attempts', count(*)::text from public.question_attempts a, params p where a.clerk_user_id = p.learner_id and a.submitted_at > p.cutoff
union all select 41, 'PROTECTED (after cutoff, kept)', 'answer_drafts', count(*)::text from public.answer_drafts d, params p where d.clerk_user_id = p.learner_id and d.updated_at > p.cutoff
union all select 50, 'CONFLICT (must be 0)', 'later attempts revising a targeted attempt', count(*)::text from public.question_attempts a, params p where a.submitted_at > p.cutoff and a.revises_attempt_id in (select id from t_attempts)
union all select 51, 'CONFLICT (must be 0)', 'reviews saved after cutoff on targeted attempts', count(*)::text from t_reviews r, params p where r.reviewed_at > p.cutoff
union all select 52, 'CONFLICT (must be 0)', 'photos added after cutoff to targeted attempts', count(*)::text from public.attempt_attachments x, params p where x.created_at > p.cutoff and x.attempt_id in (select id from t_attempts)
order by ord, item;
