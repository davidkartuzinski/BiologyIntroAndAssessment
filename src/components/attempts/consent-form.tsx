"use client";

import { useActionState } from "react";
import { saveConsentAction } from "@/app/study/actions";
import { Button } from "@/components/ui/button";

const ITEMS = [
  {
    kind: "reviewer_access",
    title: "Let David review my work",
    body: "David (reviewer) can see my submitted answers, photos, and feedback inside this site.",
  },
  {
    kind: "submission_emails",
    title: "Email copies of my submissions and feedback to David",
    body: "Emails are not being sent yet. They will start only after this is on and live email has been approved.",
  },
] as const;

export function ConsentForm({ current }: { current: Record<string, boolean> }) {
  const [state, action, pending] = useActionState(saveConsentAction, null);
  return (
    <form action={action} className="space-y-4">
      {ITEMS.map((item) => (
        <div key={item.kind} className="flex gap-3 rounded-lg border p-4">
          <input id={item.kind} name={item.kind} type="checkbox" defaultChecked={current[item.kind]} className="mt-1 size-4" aria-describedby={`${item.kind}-desc`} />
          <div>
            <label htmlFor={item.kind} className="font-medium">{item.title}</label>
            <p id={`${item.kind}-desc`} className="text-sm text-muted-foreground">{item.body}</p>
          </div>
        </div>
      ))}
      <p className="text-sm text-muted-foreground">You can change these at any time. Every change is recorded with the date.</p>
      <Button type="submit" disabled={pending}>Save settings</Button>
      {state ? <p role={state.ok ? "status" : "alert"} className="text-sm">{state.message}</p> : null}
    </form>
  );
}
