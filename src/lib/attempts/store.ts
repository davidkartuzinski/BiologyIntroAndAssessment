import "server-only";

import {
  DEFAULT_MAX_ATTACHMENTS_PER_QUESTION,
  SIGNED_URL_SECONDS,
  displayStatus,
  extensionFor,
  type AiStatus,
  type AnswerContent,
  type Assistance,
  type DisplayStatus,
  type ImageType,
  type ReviewOutcome,
} from "@/lib/attempts/logic";
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Data access for attempts, review, consent and photos.
 *
 * Every function takes the caller's verified Clerk user id from the server
 * (never from the browser) and enforces ownership or reviewer assignment here,
 * because the service-role client bypasses RLS.
 */

export const BUCKET = "attempt-photos";
export const CONSENT_POLICY_VERSION = 1;
export type ConsentKind = "ai_processing" | "reviewer_access" | "submission_emails";
export const CONSENT_KINDS: ConsentKind[] = ["ai_processing", "reviewer_access", "submission_emails"];

export class StoreError extends Error {}

export function maxAttachmentsPerQuestion() {
  const value = Number.parseInt(process.env.MAX_ATTACHMENTS_PER_QUESTION ?? "", 10);
  return Number.isInteger(value) && value > 0 && value <= 20 ? value : DEFAULT_MAX_ATTACHMENTS_PER_QUESTION;
}

function db() {
  if (!isSupabaseConfigured()) throw new StoreError("Saving is not connected yet.");
  return createServiceClient();
}

function check<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) {
    console.error(`[store] ${what} failed: ${result.error.message}`);
    throw new StoreError(`Could not ${what}. Your work on this page has not been lost; please try again.`);
  }
  return result.data;
}

// Consent ---------------------------------------------------------------------

export async function getConsents(userId: string): Promise<Record<ConsentKind, boolean>> {
  const rows = check(
    await db()
      .from("consent_records")
      .select("kind, granted, recorded_at")
      .eq("clerk_user_id", userId)
      .order("recorded_at", { ascending: false }),
    "load consent settings",
  ) as { kind: ConsentKind; granted: boolean }[];
  const result = { ai_processing: false, reviewer_access: false, submission_emails: false };
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.kind)) continue;
    seen.add(row.kind);
    result[row.kind] = row.granted;
  }
  return result;
}

export async function recordConsents(userId: string, next: Record<ConsentKind, boolean>) {
  const current = await getConsents(userId);
  const changes = CONSENT_KINDS.filter((kind) => current[kind] !== next[kind]).map((kind) => ({
    clerk_user_id: userId,
    kind,
    granted: next[kind],
    policy_version: CONSENT_POLICY_VERSION,
  }));
  if (changes.length === 0) return;
  check(await db().from("consent_records").insert(changes), "save consent settings");
}

// Drafts ----------------------------------------------------------------------

export type Draft = {
  questionId: string;
  answer: AnswerContent;
  assistance: Assistance | null;
  unclearWords: string;
  updatedAt: string;
};

export async function getDrafts(userId: string): Promise<Map<string, Draft>> {
  const rows = check(
    await db().from("answer_drafts").select("question_id, answer, assistance, unclear_words, updated_at").eq("clerk_user_id", userId),
    "load drafts",
  ) as { question_id: string; answer: AnswerContent; assistance: Assistance | null; unclear_words: string | null; updated_at: string }[];
  return new Map(
    rows.map((row) => [
      row.question_id,
      { questionId: row.question_id, answer: row.answer, assistance: row.assistance, unclearWords: row.unclear_words ?? "", updatedAt: row.updated_at },
    ]),
  );
}

export async function saveDraft(input: {
  userId: string;
  questionId: string;
  questionVersion: number;
  contentVersion: number;
  answer: AnswerContent;
  assistance: Assistance | null;
  unclearWords: string;
}) {
  check(
    await db().from("answer_drafts").upsert({
      clerk_user_id: input.userId,
      question_id: input.questionId,
      question_version: input.questionVersion,
      content_version: input.contentVersion,
      answer: input.answer,
      assistance: input.assistance,
      unclear_words: input.unclearWords || null,
      updated_at: new Date().toISOString(),
    }),
    "save your draft",
  );
}

// Attempts --------------------------------------------------------------------

export type AttemptSummary = {
  id: string;
  learnerId: string;
  questionId: string;
  questionVersion: number;
  attemptNumber: number;
  revisesAttemptId: string | null;
  answer: AnswerContent;
  assistance: Assistance;
  unclearWords: string;
  submittedAt: string;
  aiFeedback: { id: string; status: AiStatus; feedback: unknown; modelId: string; createdAt: string }[];
  humanReviews: { id: string; reviewerId: string; outcome: ReviewOutcome; comments: string | null; reviewedAt: string }[];
  status: DisplayStatus;
};

type AttemptRow = {
  id: string;
  clerk_user_id: string;
  question_id: string;
  question_version: number;
  attempt_number: number;
  revises_attempt_id: string | null;
  answer: AnswerContent;
  assistance: Assistance;
  unclear_words: string | null;
  submitted_at: string;
  ai_feedback: { id: string; status: AiStatus; feedback: unknown; model_id: string; created_at: string }[];
  human_reviews: { id: string; reviewer_clerk_user_id: string; outcome: ReviewOutcome; comments: string | null; reviewed_at: string }[];
};

const ATTEMPT_SELECT =
  "id, clerk_user_id, question_id, question_version, attempt_number, revises_attempt_id, answer, assistance, unclear_words, submitted_at, ai_feedback(id, status, feedback, model_id, created_at), human_reviews(id, reviewer_clerk_user_id, outcome, comments, reviewed_at)";

function toSummary(row: AttemptRow): AttemptSummary {
  const ai = [...(row.ai_feedback ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const human = [...(row.human_reviews ?? [])].sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at));
  return {
    id: row.id,
    learnerId: row.clerk_user_id,
    questionId: row.question_id,
    questionVersion: row.question_version,
    attemptNumber: row.attempt_number,
    revisesAttemptId: row.revises_attempt_id,
    answer: row.answer,
    assistance: row.assistance,
    unclearWords: row.unclear_words ?? "",
    submittedAt: row.submitted_at,
    aiFeedback: ai.map((entry) => ({ id: entry.id, status: entry.status, feedback: entry.feedback, modelId: entry.model_id, createdAt: entry.created_at })),
    humanReviews: human.map((entry) => ({ id: entry.id, reviewerId: entry.reviewer_clerk_user_id, outcome: entry.outcome, comments: entry.comments, reviewedAt: entry.reviewed_at })),
    status: displayStatus(human[0]?.outcome ?? null, ai[0]?.status ?? null),
  };
}

export async function listOwnAttempts(userId: string): Promise<AttemptSummary[]> {
  const rows = check(
    await db().from("question_attempts").select(ATTEMPT_SELECT).eq("clerk_user_id", userId).order("submitted_at", { ascending: true }),
    "load your attempts",
  ) as unknown as AttemptRow[];
  return rows.map(toSummary);
}

/**
 * Inserts a new attempt. Earlier attempts are never updated (a database
 * trigger also blocks updates). The unique (user, question, attempt_number)
 * constraint means a race cannot overwrite; we retry with the next number.
 */
export async function submitAttempt(input: {
  userId: string;
  questionId: string;
  questionVersion: number;
  contentVersion: number;
  answer: AnswerContent;
  assistance: Assistance;
  unclearWords: string;
}): Promise<string> {
  const client = db();
  for (let tries = 0; tries < 3; tries += 1) {
    const previous = check(
      await client
        .from("question_attempts")
        .select("id, attempt_number")
        .eq("clerk_user_id", input.userId)
        .eq("question_id", input.questionId)
        .order("attempt_number", { ascending: false })
        .limit(1),
      "check earlier attempts",
    ) as { id: string; attempt_number: number }[];
    const inserted = await client
      .from("question_attempts")
      .insert({
        clerk_user_id: input.userId,
        question_id: input.questionId,
        question_version: input.questionVersion,
        content_version: input.contentVersion,
        attempt_number: (previous[0]?.attempt_number ?? 0) + 1,
        revises_attempt_id: previous[0]?.id ?? null,
        answer: input.answer,
        assistance: input.assistance,
        unclear_words: input.unclearWords || null,
      })
      .select("id")
      .single();
    if (inserted.error?.code === "23505") continue; // another submission took this number
    const row = check(inserted, "submit your answer") as { id: string };

    // Attach photos uploaded while drafting to this attempt.
    check(
      await client
        .from("attempt_attachments")
        .update({ attempt_id: row.id })
        .eq("clerk_user_id", input.userId)
        .eq("question_id", input.questionId)
        .is("attempt_id", null),
      "link your photos",
    );
    return row.id;
  }
  throw new StoreError("Could not submit your answer. Please try again.");
}

// Reviewer --------------------------------------------------------------------

/** Learners assigned to this reviewer who have consented to reviewer access. */
export async function reviewableLearners(reviewerId: string): Promise<string[]> {
  const assigned = check(
    await db().from("reviewer_assignments").select("learner_clerk_user_id").eq("reviewer_clerk_user_id", reviewerId),
    "load reviewer assignments",
  ) as { learner_clerk_user_id: string }[];
  const learners: string[] = [];
  for (const { learner_clerk_user_id: learnerId } of assigned) {
    if ((await getConsents(learnerId)).reviewer_access) learners.push(learnerId);
  }
  return learners;
}

export async function canReview(reviewerId: string, learnerId: string) {
  return (await reviewableLearners(reviewerId)).includes(learnerId);
}

export async function reviewQueue(reviewerId: string): Promise<AttemptSummary[]> {
  const learners = await reviewableLearners(reviewerId);
  if (learners.length === 0) return [];
  const rows = check(
    await db().from("question_attempts").select(ATTEMPT_SELECT).in("clerk_user_id", learners).order("submitted_at", { ascending: false }),
    "load the review queue",
  ) as unknown as AttemptRow[];
  return rows.map(toSummary);
}

/** Returns the attempt only if this reviewer may see it; otherwise null. */
export async function attemptForReviewer(reviewerId: string, attemptId: string): Promise<AttemptSummary | null> {
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return null;
  const rows = check(
    await db().from("question_attempts").select(ATTEMPT_SELECT).eq("id", attemptId).limit(1),
    "load this submission",
  ) as unknown as AttemptRow[];
  const row = rows[0];
  if (!row || !(await canReview(reviewerId, row.clerk_user_id))) return null;
  return toSummary(row);
}

export async function attemptsForQuestion(learnerId: string, questionId: string): Promise<AttemptSummary[]> {
  const rows = check(
    await db().from("question_attempts").select(ATTEMPT_SELECT).eq("clerk_user_id", learnerId).eq("question_id", questionId).order("attempt_number"),
    "load attempts",
  ) as unknown as AttemptRow[];
  return rows.map(toSummary);
}

export async function addHumanReview(reviewerId: string, attemptId: string, outcome: ReviewOutcome, comments: string) {
  const attempt = await attemptForReviewer(reviewerId, attemptId);
  if (!attempt) throw new StoreError("You do not have access to this submission.");
  check(
    await db().from("human_reviews").insert({ attempt_id: attemptId, reviewer_clerk_user_id: reviewerId, outcome, comments: comments || null }),
    "save the review",
  );
}

export async function flagAiFeedback(reviewerId: string, aiFeedbackId: string, reason: string) {
  const rows = check(
    await db().from("ai_feedback").select("id, attempt_id").eq("id", aiFeedbackId).limit(1),
    "load the AI feedback",
  ) as { id: string; attempt_id: string }[];
  if (!rows[0] || !(await attemptForReviewer(reviewerId, rows[0].attempt_id))) {
    throw new StoreError("You do not have access to this feedback.");
  }
  check(
    await db().from("feedback_flags").insert({ ai_feedback_id: aiFeedbackId, flagged_by_clerk_user_id: reviewerId, reason }),
    "save the flag",
  );
}

// Attachments -----------------------------------------------------------------

export type Attachment = { id: string; ownerId: string; questionId: string; attemptId: string | null; contentType: string; sizeBytes: number; createdAt: string };

type AttachmentRow = { id: string; clerk_user_id: string; question_id: string; attempt_id: string | null; content_type: string; size_bytes: number; created_at: string; storage_path: string };

const toAttachment = (row: AttachmentRow): Attachment => ({
  id: row.id,
  ownerId: row.clerk_user_id,
  questionId: row.question_id,
  attemptId: row.attempt_id,
  contentType: row.content_type,
  sizeBytes: row.size_bytes,
  createdAt: row.created_at,
});

export async function listOwnAttachments(userId: string): Promise<Attachment[]> {
  const rows = check(
    await db().from("attempt_attachments").select("*").eq("clerk_user_id", userId).order("created_at"),
    "load your photos",
  ) as AttachmentRow[];
  return rows.map(toAttachment);
}

export async function attachmentsForAttempt(attemptId: string): Promise<Attachment[]> {
  const rows = check(
    await db().from("attempt_attachments").select("*").eq("attempt_id", attemptId).order("created_at"),
    "load photos",
  ) as AttachmentRow[];
  return rows.map(toAttachment);
}

export async function countDraftAttachments(userId: string, questionId: string) {
  const result = await db()
    .from("attempt_attachments")
    .select("id", { count: "exact", head: true })
    .eq("clerk_user_id", userId)
    .eq("question_id", questionId)
    .is("attempt_id", null);
  check(result, "count your photos");
  return result.count ?? 0;
}

export async function storeAttachment(userId: string, questionId: string, bytes: Uint8Array, type: ImageType): Promise<Attachment> {
  const client = db();
  const path = `${userId}/${questionId}/${crypto.randomUUID()}.${extensionFor[type]}`;
  const uploaded = await client.storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: false });
  if (uploaded.error) {
    console.error(`[store] photo upload failed: ${uploaded.error.message}`);
    throw new StoreError("The photo could not be uploaded. Your written answer is still saved; please try the photo again.");
  }
  const inserted = await client
    .from("attempt_attachments")
    .insert({ clerk_user_id: userId, question_id: questionId, storage_path: path, content_type: type, size_bytes: bytes.length })
    .select("*")
    .single();
  if (inserted.error) {
    await client.storage.from(BUCKET).remove([path]); // do not leave an unlinked file behind
  }
  return toAttachment(check(inserted, "record your photo") as AttachmentRow);
}

/**
 * Creates a 15-minute viewing link after checking that the viewer owns the
 * photo or is a reviewer assigned to its owner (with consent).
 */
export async function signedAttachmentUrl(viewerId: string, attachmentId: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(attachmentId)) throw new StoreError("Photo not found.");
  const client = db();
  const rows = check(
    await client.from("attempt_attachments").select("*").eq("id", attachmentId).limit(1),
    "find the photo",
  ) as AttachmentRow[];
  const row = rows[0];
  const allowed = row && (row.clerk_user_id === viewerId || (await canReview(viewerId, row.clerk_user_id)));
  if (!row || !allowed) throw new StoreError("Photo not found.");
  const signed = await client.storage.from(BUCKET).createSignedUrl(row.storage_path, SIGNED_URL_SECONDS);
  if (signed.error || !signed.data) throw new StoreError("Could not create a viewing link. Please try again.");
  return signed.data.signedUrl;
}
