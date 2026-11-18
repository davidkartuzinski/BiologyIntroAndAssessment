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
import { manifestCsv, planExportImages, verifyPackage, type PlannedImageInput } from "@/lib/export/images";
import { buildExportMarkdown, canExport, type ExportAttempt } from "@/lib/export/markdown";
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

    // Plan every image once; its path is reused for the ZIP entry, manifest, and report link.
    const inputs: PlannedImageInput[] = [];
    for (const attempt of attempts) {
      const photos = attachments.filter((photo) => photo.attemptId === attempt.id);
      for (const [index, photo] of photos.entries()) {
        inputs.push({
          attachmentId: photo.id,
          questionId: attempt.questionId,
          questionNumber: questionNumber.get(attempt.questionId) ?? 0,
          attemptId: attempt.id,
          attemptNumber: attempt.attemptNumber,
          index,
          recordedType: photo.contentType,
          bytes: format === "zip" ? await downloadAttachment(photo.storagePath) : undefined,
        });
      }
    }
    const planned = planExportImages(inputs, format === "zip");

    const exportAttempts: ExportAttempt[] = attempts.map((attempt) => ({
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
      images: planned
        .filter((image) => image.attemptId === attempt.id)
        .map((image) => ({ attachmentId: image.attachmentId, path: image.path, status: image.status })),
    }));

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
    const manifest = manifestCsv(planned, (questionId) => questionNumber.get(questionId));
    const entries = new Map<string, Uint8Array>([
      ["report.md", encoder.encode(markdown)],
      ["manifest.csv", encoder.encode(manifest)],
      ...planned.filter((image) => image.bytes).map((image) => [image.path, image.bytes!] as [string, Uint8Array]),
    ]);
    const problems = verifyPackage(markdown, manifest, entries);
    if (problems.length > 0) {
      console.error("[export] package failed its consistency check", problems);
      return Response.json({ error: "The export package failed its consistency check. Nothing was changed." }, { status: 500 });
    }
    const zip = createZip([...entries].map(([name, data]) => ({ name, data })));
    return new Response(zip as unknown as BodyInit, {
      headers: { ...headers, "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${base}.zip"` },
    });
  } catch (error) {
    console.error("[export] failed", error instanceof StoreError ? error.message : error);
    return Response.json({ error: "The export could not be created. Nothing was changed." }, { status: 500 });
  }
}
