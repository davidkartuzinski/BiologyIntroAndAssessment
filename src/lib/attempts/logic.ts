/**
 * Pure helpers for attempts and uploads. No I/O, so they are unit-tested directly.
 */

export const SIGNED_URL_SECONDS = 15 * 60;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_ANSWER_CHARS = 5000;
export const DEFAULT_MAX_ATTACHMENTS_PER_QUESTION = 5;

export type ImageType = "image/jpeg" | "image/png" | "image/webp";
export type Assistance = "I" | "N" | "H";
export type AnswerContent = { text: string; parts: Record<string, string> };

/** Detects the image type from the file's first bytes. Extensions and browser-reported types are ignored. */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((byte, index) => bytes[index] === byte)) return "image/png";
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/** True when the bytes look like HEIC/HEIF, so we can give a specific message. */
export function looksLikeHeic(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const ascii = String.fromCharCode(...bytes.slice(4, 12));
  return ascii.startsWith("ftyp") && /heic|heix|hevc|heim|heis|mif1|msf1/.test(ascii.slice(4));
}

export const extensionFor: Record<ImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type UploadCheck =
  | { ok: true; type: ImageType }
  | { ok: false; message: string };

export function checkUpload(bytes: Uint8Array, existingCount: number, maxCount: number): UploadCheck {
  if (bytes.length === 0) return { ok: false, message: "The file is empty." };
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, message: "This photo is larger than 10 MB. Please take it at a lower resolution or crop it." };
  if (existingCount >= maxCount) return { ok: false, message: `You can attach up to ${maxCount} photos to one question.` };
  if (looksLikeHeic(bytes)) {
    return {
      ok: false,
      message:
        "HEIC photos (the iPhone default) are not supported yet. On iPhone, choose Settings → Camera → Formats → Most Compatible, or take a screenshot of the photo, then upload that JPEG or PNG.",
    };
  }
  const type = sniffImageType(bytes);
  if (!type) return { ok: false, message: "Please upload a JPEG, PNG, or WebP image." };
  return { ok: true, type };
}

/** Normalises and validates an answer against the question's parts. */
export function normaliseAnswer(
  raw: { text?: unknown; parts?: unknown },
  partIds: string[],
): { ok: true; answer: AnswerContent } | { ok: false; message: string } {
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  const partsIn = raw.parts && typeof raw.parts === "object" ? (raw.parts as Record<string, unknown>) : {};
  const parts: Record<string, string> = {};
  for (const id of partIds) {
    const value = partsIn[id];
    parts[id] = typeof value === "string" ? value.trim() : "";
  }
  const all = [text, ...Object.values(parts)];
  if (all.some((value) => value.length > MAX_ANSWER_CHARS)) {
    return { ok: false, message: `Each answer box is limited to ${MAX_ANSWER_CHARS} characters.` };
  }
  return { ok: true, answer: { text, parts } };
}

export function isEmptyAnswer(answer: AnswerContent) {
  return answer.text === "" && Object.values(answer.parts).every((value) => value === "");
}

export function parseAssistance(value: unknown): Assistance | null {
  return value === "I" || value === "N" || value === "H" ? value : null;
}

export type ReviewOutcome = "clear" | "developing" | "revisit" | "not_assessed" | "reflection_noted";
export type AiStatus = "clear" | "developing" | "revisit" | "needs_human_review";

export type DisplayStatus =
  | { source: "human"; status: ReviewOutcome }
  | { source: "ai"; status: AiStatus }
  | { source: "none"; status: "awaiting_feedback" };

/** A human review always takes precedence; the AI feedback stays stored either way. */
export function displayStatus(latestHuman: ReviewOutcome | null, latestAi: AiStatus | null): DisplayStatus {
  if (latestHuman) return { source: "human", status: latestHuman };
  if (latestAi) return { source: "ai", status: latestAi };
  return { source: "none", status: "awaiting_feedback" };
}

export const statusLabel: Record<ReviewOutcome | AiStatus | "awaiting_feedback", string> = {
  clear: "Clear",
  developing: "Developing",
  revisit: "Revisit",
  not_assessed: "Not assessed",
  reflection_noted: "Reflection noted",
  needs_human_review: "Needs human review",
  awaiting_feedback: "Submitted — awaiting review",
};
