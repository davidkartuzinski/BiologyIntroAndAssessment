import "server-only";

/**
 * A chunk of a future textbook, PDF, or note that the tutor can read.
 * `retrieveStudyContext` is the only function the chat route calls.
 * Replace its body with embeddings + `match_document_chunks` when materials exist.
 */
export type RetrievedChunk = {
  id: string;
  documentId: string;
  documentTitle: string;
  content: string;
};

export async function retrieveStudyContext(input: {
  query: string;
  userId: string;
  limit?: number;
}): Promise<RetrievedChunk[]> {
  if (input.query.trim().length === 0 || input.userId.length === 0) {
    return [];
  }

  return [];
}
