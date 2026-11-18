"use client";

import { useActionState } from "react";
import { flagFeedbackAction, reviewAction } from "@/app/study/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const OUTCOMES = [
  { value: "clear", label: "Clear" },
  { value: "developing", label: "Developing" },
  { value: "revisit", label: "Revisit" },
  { value: "not_assessed", label: "Not assessed" },
  { value: "reflection_noted", label: "Reflection noted (not judged)" },
];

export function ReviewForm({ attemptId, isReflection }: { attemptId: string; isReflection: boolean }) {
  const [state, action, pending] = useActionState(reviewAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="attemptId" value={attemptId} />
      <fieldset>
        <legend className="font-medium">Outcome</legend>
        <div className="flex flex-wrap gap-3">
          {OUTCOMES.filter((option) => (isReflection ? option.value === "reflection_noted" || option.value === "not_assessed" : option.value !== "reflection_noted")).map((option) => (
            <label key={option.value} className="flex items-center gap-2">
              <input type="radio" name="outcome" value={option.value} required />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1">
        <label htmlFor={`comments-${attemptId}`} className="block font-medium">Feedback for Lauren</label>
        <Textarea id={`comments-${attemptId}`} name="comments" rows={4} />
      </div>
      <Button type="submit" disabled={pending}>Save review</Button>
      {state ? <p role={state.ok ? "status" : "alert"} className="text-sm">{state.message}</p> : null}
    </form>
  );
}

export function FlagForm({ aiFeedbackId }: { aiFeedbackId: string }) {
  const [state, action, pending] = useActionState(flagFeedbackAction, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="aiFeedbackId" value={aiFeedbackId} />
      <label htmlFor={`flag-${aiFeedbackId}`} className="block text-sm font-medium">What is wrong with this AI feedback?</label>
      <Textarea id={`flag-${aiFeedbackId}`} name="reason" rows={2} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>Flag as incorrect</Button>
      {state ? <p role={state.ok ? "status" : "alert"} className="text-sm">{state.message}</p> : null}
    </form>
  );
}
