-- 0004: records when the learner has opened a human review, so the app can
-- show a "new feedback" badge until she has seen it. Additive only.
-- Viewing never changes or hides the review itself.

create table if not exists public.feedback_views (
  clerk_user_id text not null,
  human_review_id uuid not null references public.human_reviews (id),
  viewed_at timestamptz not null default now(),
  primary key (clerk_user_id, human_review_id)
);

alter table public.feedback_views enable row level security;
