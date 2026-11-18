/**
 * Export-only image planning. Each attachment gets ONE canonical path, used
 * for the ZIP entry, the manifest row, and the report link. The extension
 * comes from the file's actual bytes; bytes are never converted or altered.
 */
import { sniffImageType, type ImageType } from "../attempts/logic.ts";

export type PlannedImageInput = {
  attachmentId: string;
  questionId: string;
  questionNumber: number;
  attemptId: string;
  attemptNumber: number;
  /** Position of this photo within its attempt (0-based, in upload order). */
  index: number;
  /** Recorded type, used only when bytes are not being exported (Markdown-only). */
  recordedType: string;
  /** Downloaded bytes for a ZIP export; null if the file could not be fetched; undefined when not fetched. */
  bytes?: Uint8Array | null;
};

export type PlannedImage = {
  attachmentId: string;
  attemptId: string;
  questionId: string;
  attemptNumber: number;
  path: string;
  status: "included" | "listed" | "missing" | "unsupported";
  detectedType: ImageType | null;
  bytes?: Uint8Array;
};

const EXT: Record<ImageType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function basePath(input: PlannedImageInput) {
  return `images/q${String(input.questionNumber).padStart(2, "0")}-attempt${input.attemptNumber}-photo${input.index + 1}`;
}

export function planExportImages(inputs: PlannedImageInput[], zip: boolean): PlannedImage[] {
  const used = new Set<string>();
  return inputs.map((input) => {
    let detected: ImageType | null = null;
    let status: PlannedImage["status"];
    if (!zip) {
      detected = (Object.keys(EXT) as ImageType[]).includes(input.recordedType as ImageType) ? (input.recordedType as ImageType) : null;
      status = "listed";
    } else if (!input.bytes) {
      status = "missing";
    } else {
      detected = sniffImageType(input.bytes);
      status = detected ? "included" : "unsupported";
    }
    const base = basePath(input);
    let path = detected ? `${base}.${EXT[detected]}` : `${base}.unavailable`;
    // Never let two attachments share a path (defensive; question/attempt/index is already unique).
    for (let n = 2; used.has(path); n += 1) path = path.replace(/(\.[a-z]+)$/, `-${n}$1`);
    used.add(path);
    return {
      attachmentId: input.attachmentId,
      attemptId: input.attemptId,
      questionId: input.questionId,
      attemptNumber: input.attemptNumber,
      path,
      status,
      detectedType: detected,
      bytes: status === "included" ? input.bytes ?? undefined : undefined,
    };
  });
}

export function manifestCsv(images: PlannedImage[], questionNumber: (questionId: string) => number | undefined) {
  const rows = images.map((image) => [image.status === "included" ? image.path : "", image.questionId, questionNumber(image.questionId) ?? "", image.attemptNumber, image.status === "included" ? image.detectedType : "", image.status].join(","));
  return ["file,question_id,question_number,attempt_number,format,status", ...rows].join("\n") + "\n";
}

/** Consistency check for a finished package; returns problems (empty when consistent). */
export function verifyPackage(report: string, manifest: string, zipEntries: Map<string, Uint8Array>): string[] {
  const problems: string[] = [];
  const [, ...rows] = manifest.trim().split("\n");
  for (const row of rows) {
    const [file, , , , format, status] = row.split(",");
    if (status !== "included") continue;
    const data = zipEntries.get(file);
    if (!data) {
      problems.push(`manifest file not in ZIP: ${file}`);
      continue;
    }
    const actual = sniffImageType(data);
    if (actual !== format) problems.push(`format mismatch for ${file}: manifest ${format}, bytes ${actual}`);
    const ext = file.split(".").pop();
    if (!actual || EXT[actual] !== ext) problems.push(`extension does not match bytes: ${file}`);
  }
  for (const match of report.matchAll(/\]\((images\/[^)]+)\)/g)) {
    if (!zipEntries.has(match[1])) problems.push(`report link not in ZIP: ${match[1]}`);
  }
  return problems;
}
