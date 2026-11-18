"use client";

import { useRef, useState } from "react";
import { PhotoLinkButton } from "@/components/attempts/photo-link-button";
import { Button } from "@/components/ui/button";

type Uploaded = { id: string; createdAt: string };

export function PhotoUpload({ questionId, initial, maxCount }: { questionId: string; initial: Uploaded[]; maxCount: number }) {
  const [photos, setPhotos] = useState<Uploaded[]>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const inputId = `photo-${questionId}`;

  async function upload(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.set("questionId", questionId);
      body.set("file", file);
      const response = await fetch("/api/attachments", { method: "POST", body });
      const result = (await response.json().catch(() => ({}))) as { attachment?: Uploaded; error?: string };
      if (!response.ok || !result.attachment) {
        setMessage(result.error ?? "The photo could not be uploaded. Your written answer is still saved.");
        return;
      }
      setPhotos((current) => [...current, result.attachment!]);
      setMessage("Photo uploaded. It will be included when you submit.");
    } catch {
      setMessage("The photo could not be uploaded. Check your connection and try again. Your written answer is still saved.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-3">
      <label htmlFor={inputId} className="block font-medium">
        Photos of your work (optional)
      </label>
      <p id={`${inputId}-help`} className="text-sm text-muted-foreground">
        JPEG, PNG, or WebP, up to 10 MB each, at most {maxCount} per question. iPhone HEIC photos are not supported yet:
        choose Settings → Camera → Formats → Most Compatible, or upload a screenshot.
      </p>
      <input
        ref={input}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-describedby={`${inputId}-help`}
        disabled={busy || photos.length >= maxCount}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
        className="block text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1"
      />
      {busy ? <p role="status" className="text-sm">Uploading…</p> : null}
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      {photos.length > 0 ? (
        <ul className="space-y-3">
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <PhotoLinkButton attachmentId={photo.id} label={`Photo ${index + 1}`} />
            </li>
          ))}
        </ul>
      ) : null}
      {photos.length >= maxCount ? (
        <Button type="button" variant="outline" size="sm" disabled>
          Photo limit reached
        </Button>
      ) : null}
    </div>
  );
}
