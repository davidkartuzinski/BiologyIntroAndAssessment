/**
 * Client-side list of photos attached to a draft answer. Pure, so the upload
 * lifecycle (including removal while an upload is still running) is testable.
 */

export type PhotoItem = {
  localId: string;
  name: string;
  status: "uploading" | "uploaded" | "removing";
  attachmentId?: string;
};

/** Returns the new list and, when relevant, a server attachment that must be deleted. */
export type Change = { items: PhotoItem[]; deleteOnServer?: string };

export function addPending(items: PhotoItem[], localId: string, name: string): Change {
  return { items: [...items, { localId, name, status: "uploading" }] };
}

/**
 * An upload finished. If the learner removed the photo while it was uploading,
 * it must not reappear: the stored copy is scheduled for deletion instead.
 */
export function uploadFinished(items: PhotoItem[], localId: string, attachmentId: string): Change {
  const item = items.find((candidate) => candidate.localId === localId);
  if (!item) return { items, deleteOnServer: attachmentId };
  return { items: items.map((candidate) => (candidate.localId === localId ? { ...candidate, status: "uploaded", attachmentId } : candidate)) };
}

export function uploadFailed(items: PhotoItem[], localId: string): Change {
  return { items: items.filter((candidate) => candidate.localId !== localId) };
}

/**
 * Removes one photo without touching any other. A photo still uploading is
 * dropped immediately (its late result is cleaned up by uploadFinished).
 * An uploaded photo is marked "removing" until the server confirms.
 */
export function startRemove(items: PhotoItem[], localId: string): Change {
  const item = items.find((candidate) => candidate.localId === localId);
  if (!item || item.status === "removing") return { items };
  if (item.status === "uploading" || !item.attachmentId) {
    return { items: items.filter((candidate) => candidate.localId !== localId) };
  }
  return {
    items: items.map((candidate) => (candidate.localId === localId ? { ...candidate, status: "removing" } : candidate)),
    deleteOnServer: item.attachmentId,
  };
}

export function removeConfirmed(items: PhotoItem[], localId: string): Change {
  return { items: items.filter((candidate) => candidate.localId !== localId) };
}

export function removeFailed(items: PhotoItem[], localId: string): Change {
  return { items: items.map((candidate) => (candidate.localId === localId ? { ...candidate, status: "uploaded" } : candidate)) };
}

/** Server rule: only the owner's photos not yet linked to a submitted attempt may be removed. */
export function canRemoveAttachment(row: { ownerId: string; attemptId: string | null }, userId: string) {
  return row.ownerId === userId && row.attemptId === null;
}
