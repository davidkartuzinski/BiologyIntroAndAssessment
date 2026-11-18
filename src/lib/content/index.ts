import "server-only";

import { courseContent } from "@/content/course.ts";
import type { Course, Resource, SyllabusReference, Unit, VocabularyTerm } from "@/content/schema.ts";
import { ContentValidationError, validateCourse } from "@/content/validate.ts";

let cached: Course | undefined;

/**
 * Returns the validated course. Invalid content throws, so a broken content
 * file fails `next build` instead of reaching the learner.
 */
export function getCourse(): Course {
  if (!cached) {
    const { course, issues } = validateCourse(courseContent);
    if (issues.length > 0) {
      throw new ContentValidationError(issues);
    }
    cached = course;
  }
  return cached;
}

export function getUnit(unitId: string): Unit | undefined {
  return getCourse().units.find((unit) => unit.id === unitId);
}

export function getSection(unit: Unit, sectionId: string) {
  const index = unit.sections.findIndex((section) => section.id === sectionId);
  if (index === -1) return undefined;
  return {
    section: unit.sections[index],
    previous: unit.sections[index - 1],
    next: unit.sections[index + 1],
  };
}

export function getSyllabusReference(refId: string): SyllabusReference | undefined {
  return getCourse().syllabusReferences.find((reference) => reference.id === refId);
}

export function formatSyllabusReference(reference: SyllabusReference) {
  const document = getCourse().sourceDocuments.find((candidate) => candidate.id === reference.documentId);
  const pageLabel = reference.pages.includes("–") ? "pp." : "p.";
  return `${document?.title ?? "Syllabus"}, ${reference.section}, ${pageLabel} ${reference.pages}`;
}

export type GlossaryEntry = VocabularyTerm & { unitId: string; introducedInLabel: string };

export function getGlossary(): GlossaryEntry[] {
  return getCourse()
    .units.flatMap((unit) =>
      unit.vocabulary.map((term) => {
        const section = unit.sections.find((candidate) => candidate.id === term.introducedIn);
        return {
          ...term,
          unitId: unit.id,
          introducedInLabel: section ? `Section ${section.letter}: ${section.title}` : "Supporting-resource menu",
        };
      }),
    )
    .sort((a, b) => a.term.localeCompare(b.term));
}

export function getTerm(unit: Unit, termId: string) {
  return unit.vocabulary.find((term) => term.id === termId);
}

export function getResource(unit: Unit, resourceId: string): Resource | undefined {
  return unit.resources.find((resource) => resource.id === resourceId);
}

export function unitHref(unitId: string) {
  return `/study/units/${unitId}`;
}

export function sectionHref(unitId: string, sectionId: string, blockId?: string) {
  return `/study/units/${unitId}/${sectionId}${blockId ? `#${blockId}` : ""}`;
}

export function assessmentHref(unitId: string) {
  return `/study/units/${unitId}/assessment`;
}
