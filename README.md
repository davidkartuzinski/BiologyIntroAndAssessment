# Biology study

A private Next.js study site for one student. Clerk keeps the study desk signed in. Supabase is ready for chat history and, later, textbook excerpts. The tutor streams answers through the Vercel AI SDK.

## Project structure

```text
src/proxy.ts                         Clerk session middleware
src/app/layout.tsx                   Clerk provider and theme
src/app/page.tsx                     Signed-out welcome
src/app/sign-in, src/app/sign-up     Clerk screens
src/app/study                        Protected study desk and sidebar
src/app/api/chat/route.ts            Streaming tutor route
src/components/tutor-chat.tsx        Chat UI
src/lib/ai/tutor.ts                  Tutor persona and model id
src/lib/ai/retrieval.ts              Retrieval step, empty until materials exist
src/lib/chat/persist.ts              Saves chats when Supabase is configured
src/lib/supabase/server.ts           Service-role Supabase client
supabase/migrations                  Tables for chats and future documents
```

## 1. Run the app locally

Clerk is already initialized in this project. Development keys are in `.env.local`, which is gitignored.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, and you will land on `/study`.

This Clerk application is unclaimed. When you want it on your own Clerk account, run this in the project folder and finish the browser login:

```bash
npx clerk@latest auth login
```

## 2. Connect Supabase

Create a Supabase project, or add the Supabase integration from the Vercel Marketplace:

```bash
npx vercel integration add supabase
npx vercel env pull .env.local --yes
```

The app reads `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY`. Put those names in `.env.local` if the integration uses different ones. Do not expose the service role key to the browser.

Then run `supabase/migrations/0001_study_foundation.sql` in the Supabase SQL editor. Chat messages start saving on the next tutor reply. Until those variables exist, the tutor still answers and simply skips saving.

The tables use row level security with no public policies. The server uses the service role and only writes rows for the signed-in Clerk user id.

## 3. Connect the tutor model

The chat route calls the Vercel AI Gateway. The default model is `google/gemini-3.8-flash`. Set `AI_TUTOR_MODEL` to another `provider/model` id, such as `openai/gpt-5.4-mini`, to switch.

On Vercel, link the project and enable AI Gateway. Deployed apps authenticate with OIDC automatically. Locally, pull a token:

```bash
npx vercel link
npx vercel env pull .env.local --yes
```

Re-pull when local AI requests start failing. The local token expires after about a day. A static `AI_GATEWAY_API_KEY` also works if you create one in the Vercel AI Gateway settings.

## 4. Deploy

```bash
npx vercel
```

Add the same Clerk and Supabase variables to the Vercel project for Production and Preview. After you have a domain, claim the Clerk app and follow `npx clerk@latest deploy` for production keys.

## Adding textbooks later

The chat route already calls `retrieveStudyContext` in `src/lib/ai/retrieval.ts` and appends whatever it returns to the tutor instructions. That function returns an empty list today.

When materials exist:

1. Store files and split them into `documents` and `document_chunks`.
2. Choose an embedding model and add the commented `vector` column in the migration.
3. Replace the body of `retrieveStudyContext` so it embeds the question and returns the nearest chunks for that Clerk user.

The chat component and `/api/chat` route can stay as they are.
