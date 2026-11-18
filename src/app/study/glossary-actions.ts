"use server";

import { refresh } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { GlossaryError, restoreDefault, saveEntry, setEntryActive } from "@/lib/glossary/store";

export type GlossaryResult = { ok: true; message: string; id?: string } | { ok: false; message: string };

async function reviewer() {
  const viewer = await getViewer();
  if (viewer.role !== "reviewer") throw new GlossaryError("Only the reviewer can change the glossary.");
  return viewer;
}

function failure(error: unknown): GlossaryResult {
  if (error instanceof GlossaryError) return { ok: false, message: error.message };
  console.error("[glossary action] unexpected error", error);
  return { ok: false, message: "The change could not be saved. Please try again." };
}

export async function saveGlossaryEntryAction(input: { id?: string; term: string; definition: string; aliases: string; active: boolean }): Promise<GlossaryResult> {
  try {
    const viewer = await reviewer();
    const id = await saveEntry(viewer.userId, {
      id: input.id ? String(input.id) : undefined,
      term: String(input.term ?? ""),
      definition: String(input.definition ?? ""),
      aliases: String(input.aliases ?? "").split(","),
      active: Boolean(input.active),
    });
    refresh();
    return { ok: true, message: "Saved. Lauren will see this on her next page load.", id };
  } catch (error) {
    return failure(error);
  }
}

export async function setGlossaryActiveAction(id: string, active: boolean): Promise<GlossaryResult> {
  try {
    const viewer = await reviewer();
    await setEntryActive(viewer.userId, String(id), Boolean(active));
    refresh();
    return { ok: true, message: active ? "Entry activated." : "Entry deactivated. It can be activated again at any time." };
  } catch (error) {
    return failure(error);
  }
}

export async function restoreGlossaryDefaultAction(id: string): Promise<GlossaryResult> {
  try {
    const viewer = await reviewer();
    await restoreDefault(viewer.userId, String(id));
    refresh();
    return { ok: true, message: "Original default wording restored." };
  } catch (error) {
    return failure(error);
  }
}
