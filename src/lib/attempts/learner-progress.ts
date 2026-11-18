import "server-only";

import type { Viewer } from "@/lib/auth/viewer";
import { progressSummary, questionProgress } from "@/lib/attempts/progress";
import { StoreError, getDrafts, listOwnAttempts } from "@/lib/attempts/store";
import type { Unit } from "@/content/schema.ts";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export type LearnerProgress =
  | { ok: true; rows: ReturnType<typeof questionProgress>; summary: ReturnType<typeof progressSummary> }
  | { ok: false; message: string };

export async function learnerProgress(viewer: Viewer, unit: Unit): Promise<LearnerProgress> {
  if (viewer.role !== "learner") return { ok: false, message: "Progress is shown for the learner account." };
  if (!isSupabaseConfigured()) return { ok: false, message: "Demo mode: progress is not recorded until saving is connected." };
  try {
    const [attempts, drafts] = await Promise.all([listOwnAttempts(viewer.userId), getDrafts(viewer.userId)]);
    const draftIds = new Set([...drafts.values()].filter((draft) => Object.values(draft.answer.parts).some(Boolean) || draft.answer.text).map((draft) => draft.questionId));
    const rows = questionProgress(unit.assessment.questions, attempts, draftIds);
    return { ok: true, rows, summary: progressSummary(rows) };
  } catch (error) {
    return { ok: false, message: error instanceof StoreError ? error.message : "Progress could not be loaded." };
  }
}
