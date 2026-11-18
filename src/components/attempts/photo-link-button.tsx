"use client";

import { useState, useTransition } from "react";
import { attachmentLinkAction } from "@/app/study/actions";
import { Button } from "@/components/ui/button";

/** Gets a fresh 15-minute link each time, after the server re-checks access. */
export function PhotoLinkButton({ attachmentId, label }: { attachmentId: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function getLink() {
    startTransition(async () => {
      const result = await attachmentLinkAction(attachmentId);
      if (result.ok) {
        setUrl(result.url);
        setMessage("Link valid for 15 minutes.");
      } else {
        setUrl(null);
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <Button type="button" size="sm" variant="outline" onClick={getLink} disabled={pending}>
          {pending ? "Getting link…" : url ? "Get a new link" : "View photo"}
        </Button>
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-4">
            Open full size<span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : null}
      </div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL; next/image would proxy and cache it
        <img src={url} alt={label} className="max-h-80 rounded-lg border" onError={() => setMessage("This link has expired. Choose “Get a new link”.")} />
      ) : null}
      {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
    </div>
  );
}
