import "server-only";

import { getCourse } from "@/lib/content";

/** Finds a question by id from validated content. Never trust client-supplied versions. */
export function findQuestion(questionId: string) {
  for (const unit of getCourse().units) {
    const question = unit.assessment.questions.find((candidate) => candidate.id === questionId);
    if (question) return { unit, question };
  }
  return undefined;
}
