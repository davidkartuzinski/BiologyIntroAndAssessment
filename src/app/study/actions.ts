"use server";

import { refresh } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { normaliseAnswer, parseAssistance, isEmptyAnswer, type ReviewOutcome } from "@/lib/attempts/logic";
import {
  CONSENT_KINDS,
  NewerAttemptError,
  StoreError,
  addHumanReview,
  flagAiFeedback,
  markReviewsSeen,
  recordConsents,
  removeDraftAttachment,
  saveDraft,
  signedAttachmentUrl,
  submitAttempt,
  type ConsentKind,
} from "@/lib/attempts/store";
import { findQuestion } from "@/lib/content/questions";

export type ActionResult =
  | { ok: true; message: string; at?: string }
  | { ok: false; message: string; latestAttemptId?: string; comments?: string; outcome?: string };

function failure(error: unknown): ActionResult {
  if (error instanceof StoreError) return { ok: false, message: error.message };
  console.error("[action] unexpected error", error);
  return { ok: false, message: "Something went wrong. Your work on this page has not been lost; please try again." };
}

type AnswerPayload = { questionId: string; text?: string; parts?: Record<string, string>; assistance?: string; unclearWords?: string };

async function learnerInput(payload: AnswerPayload) {
  const viewer = await getViewer();
  if (viewer.role !== "learner") return { error: "Only the learner account can save answers." } as const;
  const found = findQuestion(String(payload.questionId));
  if (!found) return { error: "Unknown question." } as const;
  const normalised = normaliseAnswer(payload, found.question.parts.map((part) => part.id));
  if (!normalised.ok) return { error: normalised.message } as const;
  const unclearWords = typeof payload.unclearWords === "string" ? payload.unclearWords.trim().slice(0, 500) : "";
  return { viewer, ...found, answer: normalised.answer, assistance: parseAssistance(payload.assistance), unclearWords } as const;
}

export async function saveDraftAction(payload: AnswerPayload): Promise<ActionResult> {
  try {
    const input = await learnerInput(payload);
    if ("error" in input) return { ok: false, message: input.error ?? "Could not save." };
    await saveDraft({
      userId: input.viewer.userId,
      questionId: input.question.id,
      questionVersion: input.question.version,
      contentVersion: input.unit.version,
      answer: input.answer,
      assistance: input.assistance,
      unclearWords: input.unclearWords,
    });
    return { ok: true, message: "Draft saved.", at: new Date().toISOString() };
  } catch (error) {
    return failure(error);
  }
}

export async function submitAttemptAction(payload: AnswerPayload): Promise<ActionResult> {
  try {
    const input = await learnerInput(payload);
    if ("error" in input) return { ok: false, message: input.error ?? "Could not submit." };
    if (isEmptyAnswer(input.answer) && input.question.type !== "photo-upload") {
      return { ok: false, message: "Write an answer before submitting. You can write “I’m not sure.”" };
    }
    if (!input.assistance) return { ok: false, message: "Choose I, N, or H to record what support you used." };
    // Save the draft first so the written answer survives even if submission fails.
    await saveDraft({
      userId: input.viewer.userId,
      questionId: input.question.id,
      questionVersion: input.question.version,
      contentVersion: input.unit.version,
      answer: input.answer,
      assistance: input.assistance,
      unclearWords: input.unclearWords,
    });
    await submitAttempt({
      userId: input.viewer.userId,
      questionId: input.question.id,
      questionVersion: input.question.version,
      contentVersion: input.unit.version,
      answer: input.answer,
      assistance: input.assistance,
      unclearWords: input.unclearWords,
    });
    refresh();
    return { ok: true, message: "Submitted. Your earlier attempts are kept.", at: new Date().toISOString() };
  } catch (error) {
    return failure(error);
  }
}

export async function saveConsentAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const viewer = await getViewer();
    if (viewer.role !== "learner") return { ok: false, message: "Only the learner account has consent settings." };
    const next = Object.fromEntries(CONSENT_KINDS.map((kind) => [kind, formData.get(kind) === "on"])) as Record<ConsentKind, boolean>;
    await recordConsents(viewer.userId, next);
    refresh();
    return { ok: true, message: "Settings saved." };
  } catch (error) {
    return failure(error);
  }
}

/** Fresh 15-minute viewing link. Access is re-checked on every call. */
export async function attachmentLinkAction(attachmentId: string): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  try {
    const viewer = await getViewer();
    if (viewer.role !== "learner" && viewer.role !== "reviewer") return { ok: false, message: "Photo not found." };
    return { ok: true, url: await signedAttachmentUrl(viewer.userId, String(attachmentId)) };
  } catch (error) {
    const result = failure(error);
    return { ok: false, message: result.message };
  }
}

const OUTCOMES: ReviewOutcome[] = ["clear", "developing", "revisit", "not_assessed", "reflection_noted"];

export async function reviewAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const viewer = await getViewer();
    if (viewer.role !== "reviewer") return { ok: false, message: "Only the reviewer can record reviews." };
    const outcome = String(formData.get("outcome")) as ReviewOutcome;
    if (!OUTCOMES.includes(outcome)) return { ok: false, message: "Choose an outcome." };
    const comments = String(formData.get("comments") ?? "").trim().slice(0, 5000);
    try {
      await addHumanReview(viewer.userId, String(formData.get("attemptId")), outcome, comments);
    } catch (error) {
      if (error instanceof NewerAttemptError) {
        // Keep what the reviewer typed so it can be reused on the latest attempt.
        return { ok: false, message: error.message, latestAttemptId: error.latestAttemptId, comments, outcome };
      }
      throw error;
    }
    refresh();
    return { ok: true, message: "Review saved. Earlier feedback is kept." };
  } catch (error) {
    return failure(error);
  }
}

export async function flagFeedbackAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const viewer = await getViewer();
    if (viewer.role !== "reviewer") return { ok: false, message: "Only the reviewer can flag feedback." };
    const reason = String(formData.get("reason") ?? "").trim().slice(0, 2000);
    if (!reason) return { ok: false, message: "Say briefly what is wrong with the feedback." };
    await flagAiFeedback(viewer.userId, String(formData.get("aiFeedbackId")), reason);
    return { ok: true, message: "Flag saved." };
  } catch (error) {
    return failure(error);
  }
}

/** Removes a photo from the learner's own draft. Submitted photos are never removed. */
export async function removeDraftAttachmentAction(attachmentId: string): Promise<ActionResult> {
  try {
    const viewer = await getViewer();
    if (viewer.role !== "learner") return { ok: false, message: "Only the learner account can remove photos." };
    await removeDraftAttachment(viewer.userId, String(attachmentId));
    return { ok: true, message: "Photo removed. Your written answer has not changed." };
  } catch (error) {
    return failure(error);
  }
}

/** Records that the learner has opened these reviews. Never changes the reviews. */
export async function markFeedbackSeenAction(reviewIds: string[]): Promise<void> {
  try {
    const viewer = await getViewer();
    if (viewer.role !== "learner" || !Array.isArray(reviewIds)) return;
    await markReviewsSeen(viewer.userId, reviewIds.map(String));
    refresh(); // clears the "new feedback" badge in the navigation
  } catch (error) {
    console.error("[action] could not record viewed feedback", error);
  }
}
