import { auth, currentUser } from "@clerk/nextjs/server";
import { parseRole } from "@/lib/auth/roles";
import {
  StoreError,
  downloadAttachment,
  exportSource,
  learnerDisplayName,
  reviewableLearners,
  reviewerNames,
} from "@/lib/attempts/store";
import { getCourse } from "@/lib/content";
import { getMarkingGuidance } from "@/lib/content/tutor-guide";
import { buildExportMarkdown, canExport, exportImageName, type ExportAttempt } from "@/lib/export/markdown";
import { createZip } from "@/lib/export/zip";

const TIME_ZONE = "Asia/Kuala_Lumpur";

/**
 * Reviewer-only, read-only export. Nothing here writes to the database or
 * Storage, so queue counts, review status and "new feedback" state are unchanged.
 */
export async function GET(request: Request) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  const role = parseRole((await currentUser())?.publicMetadata);
  if (role !== "reviewer") return Response.json({ error: "Not found." }, { status: 404 });

  const url = new URL(request.url);
  const learners = await reviewableLearners(userId).catch(() => [] as string[]);
  const learnerId = url.searchParams.get("learner") ?? learners[0] ?? "";
  if (!canExport(role, learners, learnerId)) return Response.json({ error: "Not found." }, { status: 404 });

  const format = url.searchParams.get("format") === "zip" ? "zip" : "md";
  const includeGuidance = url.searchParams.get("guidance") === "1";
  const neutral = url.searchParams.get("label") === "neutral";

  try {
    const unit = getCourse().units[0];
    const { attempts, attachments } = await exportSource(userId, learnerId);
    const names = await reviewerNames(attempts.flatMap((attempt) => attempt.humanReviews.map((review) => review.reviewerId)));
    const questionNumber = new Map(unit.assessment.questions.map((question) => [question.id, question.number]));

    const files: { name: string; data: Uint8Array }[] = [];
    const manifest: string[] = ["file,question_id,question_number,attempt_number,status"];
    const exportAttempts: ExportAttempt[] = [];

    for (const attempt of attempts) {
      const photos = attachments.filter((photo) => photo.attemptId === attempt.id);
      const images = [];
      for (const [index, photo] of photos.entries()) {
        const fileName = exportImageName(questionNumber.get(attempt.questionId) ?? 0, attempt.attemptNumber, index, photo.contentType);
        let available = true;
        if (format === "zip") {
          const bytes = await downloadAttachment(photo.storagePath);
          if (bytes) files.push({ name: fileName, data: bytes });
          else available = false;
          manifest.push(`${fileName},${attempt.questionId},${questionNumber.get(attempt.questionId) ?? ""},${attempt.attemptNumber},${available ? "included" : "missing"}`);
        }
        images.push({ attachmentId: photo.id, fileName, contentType: photo.contentType, sizeBytes: photo.sizeBytes, available });
      }
      exportAttempts.push({
        id: attempt.id,
        questionId: attempt.questionId,
        attemptNumber: attempt.attemptNumber,
        submittedAt: attempt.submittedAt,
        answer: attempt.answer,
        assistance: attempt.assistance,
        unclearWords: attempt.unclearWords,
        reviews: attempt.humanReviews.map((review) => ({
          id: review.id,
          reviewerName: names.get(review.reviewerId) ?? "Reviewer",
          outcome: review.outcome,
          comments: review.comments,
          reviewedAt: review.reviewedAt,
        })),
        images,
      });
    }

    const guidance = includeGuidance
      ? new Map(unit.assessment.questions.flatMap((question) => {
          const entry = getMarkingGuidance(question.id);
          return entry ? [[question.id, entry] as const] : [];
        }))
      : undefined;

    const markdown = buildExportMarkdown({
      unit,
      learnerLabel: neutral ? "Learner A" : await learnerDisplayName(learnerId),
      attempts: exportAttempts,
      exportedAt: new Date(),
      timeZone: TIME_ZONE,
      guidance,
      imagesIncluded: format === "zip",
    });
    const stamp = new Date().toISOString().slice(0, 10);
    const base = `assessment-evidence-${unit.id}-${stamp}`;
    const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

    if (format === "md") {
      return new Response(markdown, {
        headers: { ...headers, "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.md"` },
      });
    }
    const encoder = new TextEncoder();
    const zip = createZip([
      { name: "report.md", data: encoder.encode(markdown) },
      { name: "manifest.csv", data: encoder.encode(manifest.join("\n") + "\n") },
      ...files,
    ]);
    return new Response(zip as unknown as BodyInit, {
      headers: { ...headers, "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${base}.zip"` },
    });
  } catch (error) {
    console.error("[export] failed", error instanceof StoreError ? error.message : error);
    return Response.json({ error: "The export could not be created. Nothing was changed." }, { status: 500 });
  }
}
