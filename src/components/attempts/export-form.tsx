"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Options and a plain-language summary shown before the download starts. */
export function ExportForm({ learnerName }: { learnerName: string }) {
  const [images, setImages] = useState(false);
  const [guidance, setGuidance] = useState(false);
  const [neutral, setNeutral] = useState(false);

  return (
    <form method="get" action="/api/review/export" className="space-y-5">
      <input type="hidden" name="format" value={images ? "zip" : "md"} />
      <fieldset className="space-y-3">
        <legend className="font-semibold">Options</legend>
        <label className="flex gap-3">
          <input type="checkbox" checked={neutral} onChange={(event) => setNeutral(event.target.checked)} name="label" value="neutral" className="mt-1 size-4" />
          <span>Use a neutral label (“Learner A”) instead of “{learnerName}”</span>
        </label>
        <label className="flex gap-3">
          <input type="checkbox" checked={images} onChange={(event) => setImages(event.target.checked)} className="mt-1 size-4" />
          <span>Include attached images (downloads a ZIP with the report, the photos, and a manifest)</span>
        </label>
        <label className="flex gap-3">
          <input type="checkbox" checked={guidance} onChange={(event) => setGuidance(event.target.checked)} name="guidance" value="1" className="mt-1 size-4" />
          <span>Include private reviewer guidance — not learner-facing course content</span>
        </label>
      </fieldset>

      <section className="space-y-2 rounded-lg border bg-muted/40 p-4" aria-live="polite">
        <h2 className="font-semibold">This download will contain</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Learner shown as: {neutral ? "Learner A" : learnerName}</li>
          <li>Every question in order, with the full question wording and section</li>
          <li>Lauren’s latest submitted answer, word for word, with support used, unclear words, and submission date</li>
          <li>Review outcomes, reviewer name and date, and your full written feedback</li>
          <li>Earlier attempts and their own reviews, in a separate history section for each question</li>
          <li>Unsubmitted drafts: not included</li>
          <li>Images: {images ? "included as files in the ZIP" : "listed by name only, not included"}</li>
          <li>Private reviewer guidance: {guidance ? "included and clearly labelled" : "not included"}</li>
          <li>Not included: email addresses, account IDs, passwords, tokens, or viewing links</li>
        </ul>
        <p className="text-sm">
          Downloading does not change anything: submissions, reviews, the review queue, and Lauren’s “new feedback” markers stay
          exactly as they are. Treat the file as private and store it securely.
        </p>
      </section>
      <Button type="submit">{images ? "Download ZIP" : "Download Markdown report"}</Button>
    </form>
  );
}
