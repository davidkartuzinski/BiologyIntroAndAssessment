import { auth } from "@clerk/nextjs/server";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  gateway,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { latestUserText } from "@/lib/ai/messages";
import { retrieveStudyContext } from "@/lib/ai/retrieval";
import { buildTutorInstructions, tutorModelId } from "@/lib/ai/tutor";
import { persistMessages } from "@/lib/chat/persist";

export const maxDuration = 60;

const RECENT_MESSAGE_LIMIT = 40;

function isUIMessage(value: unknown): value is UIMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as { id?: unknown; role?: unknown; parts?: unknown };
  return (
    typeof message.id === "string" &&
    (message.role === "user" ||
      message.role === "assistant" ||
      message.role === "system") &&
    Array.isArray(message.parts)
  );
}

export async function POST(request: Request) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const payload = body as { messages?: unknown; conversationId?: unknown };
  if (!Array.isArray(payload.messages) || !payload.messages.every(isUIMessage)) {
    return Response.json({ error: "Invalid messages." }, { status: 400 });
  }

  const messages = payload.messages.slice(-RECENT_MESSAGE_LIMIT);
  const conversationId =
    typeof payload.conversationId === "string" ? payload.conversationId : null;
  const studyContext = await retrieveStudyContext({
    query: latestUserText(messages),
    userId,
  });

  const result = streamText({
    model: gateway(tutorModelId()),
    instructions: buildTutorInstructions(studyContext),
    messages: await convertToModelMessages(messages),
    providerOptions: {
      gateway: {
        user: userId,
        tags: ["feature:tutor"],
        models: ["openai/gpt-5.4-mini"],
      },
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      onEnd: ({ messages: finished, outcome }) => {
        if (outcome.status !== "completed") {
          return;
        }

        void persistMessages({
          userId,
          conversationId,
          messages: finished,
        });
      },
    }),
  });
}
