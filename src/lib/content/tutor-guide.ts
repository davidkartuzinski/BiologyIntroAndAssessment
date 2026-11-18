import "server-only";

import { introductionTutorGuide } from "@/content/private/introduction-tutor-guide.ts";
import { ContentValidationError, validateTutorGuide } from "@/content/validate.ts";
import { getCourse } from "@/lib/content";

/** Private marking guidance. Import only from reviewer pages and server-side AI code. */
export function getMarkingGuidance(questionId: string) {
  const { guide, issues } = validateTutorGuide(introductionTutorGuide, getCourse());
  if (issues.length > 0) throw new ContentValidationError(issues);
  return guide.markingGuidance.find((entry) => entry.questionId === questionId);
}
