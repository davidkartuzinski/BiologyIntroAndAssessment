"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveDraftAction, submitAttemptAction, type ActionResult } from "@/app/study/actions";
import { PhotoUpload } from "@/components/attempts/photo-upload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Part = { id: string; label: string; prompt: string };

export type AnswerFormProps = {
  questionId: string;
  questionNumber: number;
  parts: Part[];
  isReflection: boolean;
  hasAttempts: boolean;
  draft: { text: string; parts: Record<string, string>; assistance: string | null; unclearWords: string; updatedAt: string } | null;
  draftPhotos: { id: string; createdAt: string }[];
  maxPhotos: number;
};

const SUPPORT = [
  { code: "I", label: "I: independent" },
  { code: "N", label: "N: used notes or dictionary" },
  { code: "H", label: "H: discussed with someone" },
];

export function AnswerForm(props: AnswerFormProps) {
  const [text, setText] = useState(props.draft?.text ?? "");
  const [parts, setParts] = useState<Record<string, string>>(props.draft?.parts ?? {});
  const [assistance, setAssistance] = useState(props.draft?.assistance ?? "");
  const [unclearWords, setUnclearWords] = useState(props.draft?.unclearWords ?? "");
  const [status, setStatus] = useState<ActionResult | null>(
    props.draft ? { ok: true, message: `Draft saved ${new Date(props.draft.updatedAt).toLocaleString()}.` } : null,
  );
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const payload = () => ({ questionId: props.questionId, text, parts, assistance, unclearWords });

  // Autosave the draft a few seconds after typing stops.
  useEffect(() => {
    if (!dirty) return;
    timer.current = setTimeout(() => {
      startTransition(async () => {
        const result = await saveDraftAction(payload());
        setStatus(result.ok ? { ok: true, message: `Draft saved ${new Date(result.at ?? Date.now()).toLocaleTimeString()}.` } : result);
        if (result.ok) setDirty(false);
      });
    }, 3000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- payload is rebuilt from these values
  }, [dirty, text, parts, assistance, unclearWords]);

  function edit<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setDirty(true);
      setStatus({ ok: true, message: "Unsaved changes…" });
    };
  }

  function submit() {
    if (timer.current) clearTimeout(timer.current);
    startTransition(async () => {
      const result = await submitAttemptAction(payload());
      setStatus(result);
      if (result.ok) setDirty(false);
    });
  }

  const base = `q${props.questionNumber}`;

  return (
    <form
      className="space-y-4 rounded-lg bg-muted/30 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <p className="text-sm font-medium">{props.hasAttempts ? "Revised answer (your earlier attempts are kept)" : "Your answer"}</p>
      {props.parts.length > 0 ? (
        props.parts.map((part) => (
          <div key={part.id} className="space-y-1">
            <label htmlFor={`${base}-${part.id}`} className="block text-sm font-medium">
              {part.label}. {part.prompt}
            </label>
            <Textarea id={`${base}-${part.id}`} value={parts[part.id] ?? ""} onChange={(event) => edit(setParts)({ ...parts, [part.id]: event.target.value })} rows={3} />
          </div>
        ))
      ) : (
        <div className="space-y-1">
          <label htmlFor={`${base}-text`} className="sr-only">
            Answer to question {props.questionNumber}
          </label>
          <Textarea id={`${base}-text`} value={text} onChange={(event) => edit(setText)(event.target.value)} rows={5} />
        </div>
      )}

      <PhotoUpload questionId={props.questionId} initial={props.draftPhotos} maxCount={props.maxPhotos} />

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Support used</legend>
        <div className="flex flex-wrap gap-3">
          {SUPPORT.map((option) => (
            <label key={option.code} className="flex items-center gap-2 text-sm">
              <input type="radio" name={`${base}-support`} value={option.code} checked={assistance === option.code} onChange={() => edit(setAssistance)(option.code)} />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1">
        <label htmlFor={`${base}-unclear`} className="block text-sm font-medium">
          A word or phrase that was unclear (optional)
        </label>
        <input
          id={`${base}-unclear`}
          value={unclearWords}
          onChange={(event) => edit(setUnclearWords)(event.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={pending} onClick={() => startTransition(async () => {
          const result = await saveDraftAction(payload());
          setStatus(result.ok ? { ok: true, message: "Draft saved." } : result);
          if (result.ok) setDirty(false);
        })}>
          Save draft
        </Button>
        <Button type="submit" disabled={pending}>
          {props.hasAttempts ? "Submit revised answer" : "Submit answer"}
        </Button>
        <span className="text-sm text-muted-foreground">Status: {props.hasAttempts ? "submitted earlier; editing a new draft" : "draft"}</span>
      </div>
      {status ? (
        <p role={status.ok ? "status" : "alert"} className={status.ok ? "text-sm text-muted-foreground" : "text-sm font-medium text-destructive"}>
          {status.message}
        </p>
      ) : null}
    </form>
  );
}
