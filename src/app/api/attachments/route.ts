import { auth, currentUser } from "@clerk/nextjs/server";
import { parseRole } from "@/lib/auth/roles";
import { MAX_IMAGE_BYTES, checkUpload } from "@/lib/attempts/logic";
import { StoreError, countDraftAttachments, maxAttachmentsPerQuestion, storeAttachment } from "@/lib/attempts/store";
import { findQuestion } from "@/lib/content/questions";

/**
 * Photo upload for the learner. A route handler is used instead of a Server
 * Action because photos can be up to 10 MB. The owner is the verified Clerk
 * user; any user id in the request body is ignored.
 */
export async function POST(request: Request) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  const user = await currentUser();
  if (parseRole(user?.publicMetadata) !== "learner") {
    return Response.json({ error: "Only the learner account can upload photos." }, { status: 403 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_IMAGE_BYTES + 64 * 1024) {
    return Response.json({ error: "This photo is larger than 10 MB." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }
  const questionId = String(form.get("questionId") ?? "");
  const file = form.get("file");
  if (!findQuestion(questionId)) return Response.json({ error: "Unknown question." }, { status: 400 });
  if (!(file instanceof File)) return Response.json({ error: "Choose a photo to upload." }, { status: 400 });

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const verdict = checkUpload(bytes, await countDraftAttachments(userId, questionId), maxAttachmentsPerQuestion());
    if (!verdict.ok) return Response.json({ error: verdict.message }, { status: 422 });
    const attachment = await storeAttachment(userId, questionId, bytes, verdict.type);
    return Response.json({ attachment }, { status: 201 });
  } catch (error) {
    const message = error instanceof StoreError ? error.message : "The photo could not be uploaded. Your written answer is still saved.";
    if (!(error instanceof StoreError)) console.error("[attachments] upload failed", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
