-- 0002: answer attempts, AI and human review, consent, and private photo uploads.
--
-- Additive only: creates new tables and one private Storage bucket. It does not
-- alter or delete anything from 0001.
--
-- Security model (unchanged from 0001): RLS is enabled with NO policies, and
-- no Storage policies are created, so the anon/authenticated keys can read or
-- write nothing. All access goes through server code using the service role,
-- after checking the Clerk identity, role, and reviewer assignment.
-- Signed photo-viewing URLs (15 minutes) are only created by that server code.

-- Reviewer -> learner assignments. A reviewer sees only assigned learners.
create table if not exists public.reviewer_assignments (
  reviewer_clerk_user_id text not null,
  learner_clerk_user_id text not null,
  created_at timestamptz not null default now(),
  primary key (reviewer_clerk_user_id, learner_clerk_user_id)
);

-- Consent decisions. Append-only: the latest row per (user, kind) is current.
create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  kind text not null check (kind in ('ai_processing', 'reviewer_access', 'submission_emails')),
  granted boolean not null,
  policy_version integer not null,
  recorded_at timestamptz not null default now()
);
create index if not exists consent_records_user_idx
  on public.consent_records (clerk_user_id, kind, recorded_at desc);

-- One editable draft per learner and question. Drafts are never submissions.
create table if not exists public.answer_drafts (
  clerk_user_id text not null,
  question_id text not null,
  question_version integer not null,
  content_version integer not null,
  answer jsonb not null default '{}'::jsonb,
  assistance text check (assistance in ('I', 'N', 'H')),
  unclear_words text,
  updated_at timestamptz not null default now(),
  primary key (clerk_user_id, question_id)
);

-- Submitted attempts. Insert-only: a revision is a new row, never an update.
create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  question_id text not null,
  question_version integer not null,
  content_version integer not null,
  attempt_number integer not null check (attempt_number > 0),
  revises_attempt_id uuid references public.question_attempts (id),
  answer jsonb not null,
  assistance text not null check (assistance in ('I', 'N', 'H')),
  unclear_words text,
  submitted_at timestamptz not null default now(),
  unique (clerk_user_id, question_id, attempt_number)
);
create index if not exists question_attempts_user_idx
  on public.question_attempts (clerk_user_id, submitted_at desc);

-- Photos. Linked to an owner and to a draft (question_id) or a submitted attempt.
create table if not exists public.attempt_attachments (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  question_id text not null,
  attempt_id uuid references public.question_attempts (id),
  storage_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now()
);
create index if not exists attempt_attachments_owner_idx
  on public.attempt_attachments (clerk_user_id, question_id);
create index if not exists attempt_attachments_attempt_idx
  on public.attempt_attachments (attempt_id);

-- AI feedback. Insert-only, so the original AI assessment is always preserved.
create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.question_attempts (id),
  status text not null check (status in ('clear', 'developing', 'revisit', 'needs_human_review')),
  feedback jsonb not null,
  model_id text not null,
  prompt_version text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_feedback_attempt_idx on public.ai_feedback (attempt_id, created_at desc);

-- Human reviews. Insert-only; the latest review sets the displayed status.
create table if not exists public.human_reviews (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.question_attempts (id),
  reviewer_clerk_user_id text not null,
  outcome text not null check (outcome in ('clear', 'developing', 'revisit', 'not_assessed', 'reflection_noted')),
  comments text,
  reviewed_at timestamptz not null default now()
);
create index if not exists human_reviews_attempt_idx on public.human_reviews (attempt_id, reviewed_at desc);

-- Reviewer flags on incorrect AI feedback.
create table if not exists public.feedback_flags (
  id uuid primary key default gen_random_uuid(),
  ai_feedback_id uuid not null references public.ai_feedback (id),
  flagged_by_clerk_user_id text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.reviewer_assignments enable row level security;
alter table public.consent_records enable row level security;
alter table public.answer_drafts enable row level security;
alter table public.question_attempts enable row level security;
alter table public.attempt_attachments enable row level security;
alter table public.ai_feedback enable row level security;
alter table public.human_reviews enable row level security;
alter table public.feedback_flags enable row level security;

-- Enforce insert-only history at the database level, even for the service role.
create or replace function public.prevent_history_change()
returns trigger language plpgsql as $$
begin
  raise exception '% rows are permanent history and cannot be changed or deleted', tg_table_name;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['question_attempts', 'ai_feedback', 'human_reviews', 'consent_records'] loop
    execute format('drop trigger if exists %I_immutable on public.%I', t, t);
    execute format(
      'create trigger %I_immutable before update or delete on public.%I for each row execute function public.prevent_history_change()',
      t, t);
  end loop;
end $$;

-- Private bucket: no public access, 10 MB limit, JPEG/PNG/WebP only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attempt-photos', 'attempt-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
