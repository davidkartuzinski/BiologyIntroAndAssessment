-- 0005: shared glossary, editable by the reviewer. Additive only.
-- Default terms from the course content are inserted by the app on first use
-- (never overwriting edits). RLS is on with no policies: the browser keys can
-- read or write nothing; the server reads active entries for learners and only
-- lets the reviewer role change them.

create table if not exists public.glossary_entries (
  id text primary key,
  term text not null check (length(btrim(term)) > 0),
  definition text not null check (length(btrim(definition)) > 0),
  aliases text[] not null default '{}',
  active boolean not null default true,
  is_default boolean not null default false,
  default_term text,
  default_definition text,
  default_aliases text[],
  updated_by text,
  updated_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists glossary_entries_term_unique
  on public.glossary_entries (lower(btrim(term)));

alter table public.glossary_entries enable row level security;
