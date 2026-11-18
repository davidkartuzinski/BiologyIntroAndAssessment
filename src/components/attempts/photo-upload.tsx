"use client";

import { useEffect, useRef, useState } from "react";
import { removeDraftAttachmentAction } from "@/app/study/actions";
import { PhotoLinkButton } from "@/components/attempts/photo-link-button";
import { Button } from "@/components/ui/button";
import {
  addPending,
  removeConfirmed,
  removeFailed,
  startRemove,
  uploadFailed,
  uploadFinished,
  type Change,
  type PhotoItem,
} from "@/lib/attempts/photo-list";

type Uploaded = { id: string; createdAt: string };

/**
 * Photos for a draft answer. Uploading or removing a photo never changes the
 * written answer, which lives in the parent form's state.
 */
export function PhotoUpload({ questionId, initial, maxCount }: { questionId: string; initial: Uploaded[]; maxCount: number }) {
  const [items, setItems] = useState<PhotoItem[]>(() =>
    initial.map((photo, index) => ({ localId: photo.id, name: `Photo ${index + 1} (saved earlier)`, status: "uploaded", attachmentId: photo.id })),
  );
  const itemsRef = useRef(items);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const inputId = `photo-${questionId}`;

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const previewsRef = useRef(previews);
  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);
  // Release local previews only when the component unmounts.
  useEffect(() => () => Object.values(previewsRef.current).forEach((url) => URL.revokeObjectURL(url)), []);

  /** Applies a list change and deletes any server copy it asks for. */
  function apply(change: Change) {
    itemsRef.current = change.items;
    setItems(change.items);
    if (change.deleteOnServer) void removeDraftAttachmentAction(change.deleteOnServer);
  }

  function dropPreview(localId: string) {
    setPreviews((current) => {
      if (current[localId]) URL.revokeObjectURL(current[localId]);
      const next = { ...current };
      delete next[localId];
      return next;
    });
  }

  async function upload(file: File) {
    const localId = crypto.randomUUID();
    setMessage(null);
    apply(addPending(itemsRef.current, localId, file.name));
    if (/^image\/(jpeg|png|webp)$/.test(file.type)) {
      const url = URL.createObjectURL(file);
      setPreviews((current) => ({ ...current, [localId]: url }));
    }
    try {
      const body = new FormData();
      body.set("questionId", questionId);
      body.set("file", file);
      const response = await fetch("/api/attachments", { method: "POST", body });
      const result = (await response.json().catch(() => ({}))) as { attachment?: Uploaded; error?: string };
      if (!response.ok || !result.attachment) {
        apply(uploadFailed(itemsRef.current, localId));
        dropPreview(localId);
        setMessage(result.error ?? "The photo could not be uploaded. Your written answer is still saved.");
        return;
      }
      const change = uploadFinished(itemsRef.current, localId, result.attachment.id);
      apply(change);
      if (!change.deleteOnServer) setMessage(`“${file.name}” uploaded. It will be included when you submit.`);
    } catch {
      apply(uploadFailed(itemsRef.current, localId));
      dropPreview(localId);
      setMessage("The photo could not be uploaded. Check your connection and try again. Your written answer is still saved.");
    }
  }

  async function remove(item: PhotoItem) {
    const change = startRemove(itemsRef.current, item.localId);
    itemsRef.current = change.items;
    setItems(change.items);
    if (!change.deleteOnServer) {
      dropPreview(item.localId);
      setMessage(`Removed “${item.name}”. Your written answer has not changed.`);
      return;
    }
    const result = await removeDraftAttachmentAction(change.deleteOnServer);
    if (result.ok) {
      apply(removeConfirmed(itemsRef.current, item.localId));
      dropPreview(item.localId);
      setMessage(`Removed “${item.name}”. Your written answer has not changed.`);
    } else {
      apply(removeFailed(itemsRef.current, item.localId));
      setMessage(result.message);
    }
  }

  const full = items.length >= maxCount;

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
        disabled={full}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Clear the input so the same file can be chosen again after removal.
          event.target.value = "";
          if (file) void upload(file);
        }}
        className="block text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1"
      />
      {full ? <p className="text-sm">Photo limit reached. Remove a photo to add another.</p> : null}
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.localId} className="flex flex-wrap items-start gap-3 rounded-md border p-2">
              {previews[item.localId] ? (
                // eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen file
                <img src={previews[item.localId]} alt="" className="size-20 rounded object-cover" />
              ) : null}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="break-all text-sm font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  {item.status === "uploading" ? "Uploading…" : item.status === "removing" ? "Removing…" : "Uploaded"}
                </p>
                {item.status === "uploaded" && item.attachmentId && !previews[item.localId] ? (
                  <PhotoLinkButton attachmentId={item.attachmentId} label="Saved photo" />
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={item.status === "removing"}
                onClick={() => void remove(item)}
                aria-label={`Remove attachment ${item.name}`}
              >
                Remove attachment
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
