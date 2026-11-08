import "server-only";

import type { UIMessage } from "ai";
import { textFromMessage } from "@/lib/ai/messages";
import {
  createServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

const CONVERSATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function persistMessages({
  userId,
  conversationId,
  messages,
}: {
  userId: string;
  conversationId: string | null;
  messages: UIMessage[];
}) {
  if (
    !isSupabaseConfigured() ||
    !conversationId ||
    !CONVERSATION_ID_PATTERN.test(conversationId)
  ) {
    return;
  }

  const supabase = createServiceClient();
  const { data: existing, error: lookupError } = await supabase
    .from("conversations")
    .select("id, clerk_user_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (lookupError) {
    console.error("Could not look up the conversation.");
    return;
  }

  if (existing && existing.clerk_user_id !== userId) {
    return;
  }

  const title =
    messages
      .filter((message) => message.role === "user")
      .map((message) => textFromMessage(message))
      .find((text) => text.length > 0)
      ?.slice(0, 80) || "Study conversation";

  const now = new Date().toISOString();

  if (!existing) {
    const { error } = await supabase.from("conversations").insert({
      id: conversationId,
      clerk_user_id: userId,
      title,
      updated_at: now,
    });

    if (error) {
      console.error("Could not create the conversation.");
      return;
    }
  } else {
    const { error } = await supabase
      .from("conversations")
      .update({ title, updated_at: now })
      .eq("id", conversationId)
      .eq("clerk_user_id", userId);

    if (error) {
      console.error("Could not update the conversation.");
      return;
    }
  }

  const rows = messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      id: message.id,
      conversation_id: conversationId,
      clerk_user_id: userId,
      role: message.role,
      parts: message.parts,
    }));

  if (rows.length === 0) {
    return;
  }

  const { error: messageError } = await supabase
    .from("messages")
    .upsert(rows, { onConflict: "id" });

  if (messageError) {
    console.error("Could not save the chat messages.");
  }
}
