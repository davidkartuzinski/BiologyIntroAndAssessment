"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useState } from "react";
import { textFromMessage } from "@/lib/ai/messages";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function createConversationId() {
  return crypto.randomUUID();
}

export function TutorChat() {
  const [conversationId] = useState(createConversationId);
  const [input, setInput] = useState("");
  const [transport] = useState(
    () => new DefaultChatTransport({ api: "/api/chat" }),
  );
  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    transport,
  });

  const isBusy = status === "submitted" || status === "streaming";

  function submitMessage() {
    const text = input.trim();
    if (!text || isBusy) {
      return;
    }

    void sendMessage({ text }, { body: { conversationId } });
    setInput("");
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {messages.length === 0 ? (
            <div className="rounded-xl border bg-card px-5 py-6">
              <h1 className="text-xl font-semibold tracking-tight">
                Ask the tutor
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Ask for a definition, an explanation, or help working through
                an idea. Textbooks and notes can be connected later. Until
                then, the tutor answers from general knowledge and says so.
              </p>
            </div>
          ) : null}

          <div aria-live="polite" className="flex flex-col gap-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>

          {status === "submitted" ? (
            <p className="text-sm text-muted-foreground">The tutor is thinking…</p>
          ) : null}

          {error ? (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
              <p>The tutor could not answer that just now.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => regenerate()}>
                Try again
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <form
        className="border-t bg-background px-4 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          submitMessage();
        }}
      >
        <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
          <label className="sr-only" htmlFor="tutor-message">
            Message the tutor
          </label>
          <Textarea
            id="tutor-message"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitMessage();
              }
            }}
            placeholder="Ask a question"
            rows={2}
            className="min-h-16 resize-none"
          />
          {isBusy ? (
            <Button type="button" variant="outline" onClick={() => stop()}>
              Stop
            </Button>
          ) : (
            <Button type="submit" disabled={input.trim().length === 0}>
              Send
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const text = textFromMessage(message);
  if (!text) {
    return null;
  }

  const isUser = message.role === "user";

  return (
    <article
      className={
        isUser
          ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground"
          : "mr-auto max-w-[85%] rounded-2xl bg-muted px-4 py-3 text-sm leading-6"
      }
    >
      <p className="mb-1 text-xs font-medium opacity-70">
        {isUser ? "You" : "Tutor"}
      </p>
      <p className="whitespace-pre-wrap">{text}</p>
    </article>
  );
}
