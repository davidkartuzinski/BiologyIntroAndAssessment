-- Study foundation for chat history and future document retrieval.
-- Run this in the Supabase SQL editor, or with the Supabase CLI, after the
-- project exists. The app writes through the service role and always filters
-- by the Clerk user id. Row level security is enabled with no policies, so
-- the anon key cannot read these tables.

create table if not exists public.conversations (
  id uuid primary key,
  clerk_user_id text not null,
  title text not null default 'Study conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_clerk_user_id_idx
  on public.conversations (clerk_user_id, updated_at desc);

create table if not exists public.messages (
  id text primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  clerk_user_id text not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  parts jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx
  on public.messages (conversation_id, created_at);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  title text not null,
  source_type text not null default 'note',
  storage_path text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists documents_clerk_user_id_idx
  on public.documents (clerk_user_id, created_at desc);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  clerk_user_id text not null,
  content text not null,
  chunk_index integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_document_id_idx
  on public.document_chunks (document_id, chunk_index);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;

-- Future retrieval step, after an embedding model and its vector size are chosen:
--
-- create extension if not exists vector;
-- alter table public.document_chunks
--   add column embedding vector(<dimensions>);
-- create index document_chunks_embedding_idx
--   on public.document_chunks
--   using hnsw (embedding vector_cosine_ops);
--
-- Then replace the body of src/lib/ai/retrieval.ts so it embeds the question
-- and reads the nearest document_chunks for that clerk_user_id.
