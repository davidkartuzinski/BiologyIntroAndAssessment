import {
  courseSchema,
  tutorGuideSchema,
  type ContentBlock,
  type Course,
  type CourseInput,
  type TutorGuide,
  type TutorGuideInput,
  type Unit,
} from "./schema.ts";

export type ValidationIssue = { path: string; message: string };

export class ContentValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(
      `Course content failed validation:\n${issues.map((issue) => `- ${issue.path}: ${issue.message}`).join("\n")}`,
    );
    this.name = "ContentValidationError";
    this.issues = issues;
  }
}

/** Keys that belong only in private tutor guidance. */
const PRIVATE_KEYS = [
  "evidenceOfUnderstanding",
  "expectedAnswerGuidance",
  "markingGuidance",
  "acceptableAlternatives",
  "requiredTerminology",
  "commonMisunderstandings",
  "hintStages",
  "cautions",
];

function findPrivateKeys(value: unknown, path: string, issues: ValidationIssue[]) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findPrivateKeys(item, `${path}[${index}]`, issues));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (PRIVATE_KEYS.includes(key)) {
        issues.push({ path: `${path}.${key}`, message: "Private answer guidance must not appear in learner content." });
      }
      findPrivateKeys(child, `${path}.${key}`, issues);
    }
  }
}

function duplicates(values: string[]) {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

function blockReferences(blocks: ContentBlock[]) {
  return blocks.flatMap((block) => [
    ...block.citations.map((citation) => ({ blockId: block.id, citation })),
  ]);
}

function checkUnit(unit: Unit, course: Course, issues: ValidationIssue[]) {
  const at = `units.${unit.id}`;
  const sectionIds = new Set(unit.sections.map((section) => section.id));
  const conceptIds = new Set(unit.concepts.map((concept) => concept.id));
  const termIds = new Set(unit.vocabulary.map((term) => term.id));
  const resourceIds = new Set(unit.resources.map((resource) => resource.id));
  const practicalIds = new Set(unit.practicals.map((practical) => practical.id));
  const syllabusIds = new Set(course.syllabusReferences.map((reference) => reference.id));

  const idGroups: [string, string[]][] = [
    ["sections", unit.sections.map((section) => section.id)],
    ["concepts", unit.concepts.map((concept) => concept.id)],
    ["vocabulary", unit.vocabulary.map((term) => term.id)],
    ["resources", unit.resources.map((resource) => resource.id)],
    ["questions", unit.assessment.questions.map((question) => question.id)],
    [
      "content blocks",
      [
        ...unit.overview.map((block) => block.id),
        ...unit.sections.flatMap((section) => section.contentBlocks.map((block) => block.id)),
      ],
    ],
  ];
  for (const [label, ids] of idGroups) {
    for (const duplicate of duplicates(ids)) {
      issues.push({ path: `${at}.${label}`, message: `Duplicate ID "${duplicate}".` });
    }
  }
  for (const duplicate of duplicates(unit.vocabulary.map((term) => term.term.toLowerCase()))) {
    issues.push({ path: `${at}.vocabulary`, message: `Term "${duplicate}" is defined more than once.` });
  }

  const checkSyllabus = (path: string, ids: string[]) => {
    for (const refId of ids) {
      if (!syllabusIds.has(refId)) issues.push({ path, message: `Unknown syllabus reference "${refId}".` });
    }
  };
  const checkCitations = (path: string, blocks: ContentBlock[]) => {
    for (const { blockId, citation } of blockReferences(blocks)) {
      const known = citation.kind === "resource" ? resourceIds.has(citation.refId) : syllabusIds.has(citation.refId);
      if (!known) issues.push({ path: `${path}.${blockId}`, message: `Unknown ${citation.kind} citation "${citation.refId}".` });
    }
    for (const block of blocks) {
      if (block.type === "definitions") {
        for (const termId of block.termIds) {
          if (!termIds.has(termId)) issues.push({ path: `${path}.${block.id}`, message: `Unknown term "${termId}".` });
        }
      }
      if (block.type === "resource" && !resourceIds.has(block.resourceId)) {
        issues.push({ path: `${path}.${block.id}`, message: `Unknown resource "${block.resourceId}".` });
      }
      if (block.type === "practical" && !practicalIds.has(block.practicalId)) {
        issues.push({ path: `${path}.${block.id}`, message: `Unknown practical "${block.practicalId}".` });
      }
      if (block.type === "table") {
        for (const row of block.rows) {
          if (row.length !== block.headers.length) {
            issues.push({ path: `${path}.${block.id}`, message: "Table row length does not match its headers." });
          }
        }
      }
    }
  };

  checkSyllabus(`${at}.syllabusReferenceIds`, unit.syllabusReferenceIds);
  checkCitations(`${at}.overview`, unit.overview);

  for (const term of unit.vocabulary) {
    if (term.introducedIn !== "resource-menu" && !sectionIds.has(term.introducedIn)) {
      issues.push({ path: `${at}.vocabulary.${term.id}`, message: `Unknown section "${term.introducedIn}".` });
    }
  }

  // Vocabulary before use: every term is defined in the section that introduces it,
  // either in the opening "Words to understand first" block or in a definitions block.
  const definedBySection = new Map<string, Set<string>>();
  for (const section of unit.sections) {
    const path = `${at}.sections.${section.id}`;
    const defined = new Set(section.termsBeforeUse);
    for (const block of section.contentBlocks) {
      if (block.type === "definitions") block.termIds.forEach((termId) => defined.add(termId));
    }
    definedBySection.set(section.id, defined);

    for (const termId of section.termsBeforeUse) {
      if (!termIds.has(termId)) issues.push({ path: `${path}.termsBeforeUse`, message: `Unknown term "${termId}".` });
    }
    for (const conceptId of section.taughtConceptIds) {
      if (!conceptIds.has(conceptId)) issues.push({ path: `${path}.taughtConceptIds`, message: `Unknown concept "${conceptId}".` });
    }
    for (const resourceId of section.resourceIds) {
      if (!resourceIds.has(resourceId)) issues.push({ path: `${path}.resourceIds`, message: `Unknown resource "${resourceId}".` });
    }
    checkSyllabus(`${path}.syllabusReferenceIds`, section.syllabusReferenceIds);
    checkCitations(`${path}.contentBlocks`, section.contentBlocks);
  }
  for (const term of unit.vocabulary) {
    if (term.introducedIn === "resource-menu") continue;
    if (term.definedInline) continue;
    if (!definedBySection.get(term.introducedIn)?.has(term.id)) {
      issues.push({
        path: `${at}.vocabulary.${term.id}`,
        message: `Term is introduced in ${term.introducedIn} but is not listed in that section's definitions.`,
      });
    }
  }

  for (const resource of unit.resources) {
    for (const sectionId of resource.relatedSectionIds) {
      if (!sectionIds.has(sectionId)) issues.push({ path: `${at}.resources.${resource.id}`, message: `Unknown section "${sectionId}".` });
    }
    for (const conceptId of resource.relatedConceptIds) {
      if (!conceptIds.has(conceptId)) issues.push({ path: `${at}.resources.${resource.id}`, message: `Unknown concept "${conceptId}".` });
    }
  }
  for (const practical of unit.practicals) {
    checkSyllabus(`${at}.practicals.${practical.id}`, practical.syllabusReferenceIds);
    if (practical.involvesChemicalsOrHazards && practical.reviewStatus !== "human-reviewed") {
      issues.push({
        path: `${at}.practicals.${practical.id}`,
        message: "Hazardous or chemical activities must be human-reviewed before publication.",
      });
    }
  }

  // Teach before assessing.
  const assessment = unit.assessment;
  checkSyllabus(`${at}.assessment.commandWords`, [assessment.commandWords.syllabusReferenceId]);
  const numbers = assessment.questions.map((question) => question.number);
  numbers.forEach((number, index) => {
    if (number !== index + 1) issues.push({ path: `${at}.assessment`, message: `Question numbering must be sequential; found ${number} at position ${index + 1}.` });
  });

  for (const question of assessment.questions) {
    const path = `${at}.assessment.${question.id}`;
    checkCitations(`${path}.prompt`, [...question.prompt, ...question.promptAfterParts]);
    if (question.isReflection !== (question.type === "reflection")) {
      issues.push({ path, message: "Reflection questions must use type \"reflection\" and isReflection: true." });
    }
    if (!question.isReflection && question.assessedConceptIds.length === 0) {
      issues.push({ path, message: "Non-reflection questions must assess at least one concept." });
    }
    if (question.isReflection && question.assessedConceptIds.length > 0) {
      issues.push({ path, message: "Reflection questions must not assess concepts." });
    }
    for (const reference of question.teachingReferences) {
      const section = unit.sections.find((candidate) => candidate.id === reference.sectionId);
      if (!section) {
        issues.push({ path, message: `Teaching reference points to unknown section "${reference.sectionId}".` });
        continue;
      }
      if (reference.blockId && !section.contentBlocks.some((block) => block.id === reference.blockId)) {
        issues.push({ path, message: `Teaching reference points to unknown block "${reference.blockId}" in ${section.id}.` });
      }
    }
    for (const conceptId of question.assessedConceptIds) {
      if (!conceptIds.has(conceptId)) {
        issues.push({ path, message: `Unknown concept "${conceptId}".` });
        continue;
      }
      const taught = question.teachingReferences.some((reference) =>
        unit.sections.find((section) => section.id === reference.sectionId)?.taughtConceptIds.includes(conceptId),
      );
      if (!taught) {
        issues.push({ path, message: `Concept "${conceptId}" is assessed but not taught in the referenced sections.` });
      }
    }
  }

  findPrivateKeys(unit, at, issues);
}

export function validateCourse(input: CourseInput): { course: Course; issues: ValidationIssue[] } {
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      course: input as Course,
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    };
  }
  const course = parsed.data;
  const issues: ValidationIssue[] = [];

  for (const duplicate of duplicates(course.syllabusReferences.map((reference) => reference.id))) {
    issues.push({ path: "syllabusReferences", message: `Duplicate ID "${duplicate}".` });
  }
  const documentIds = new Set(course.sourceDocuments.map((document) => document.id));
  for (const reference of course.syllabusReferences) {
    if (!documentIds.has(reference.documentId)) {
      issues.push({ path: `syllabusReferences.${reference.id}`, message: `Unknown source document "${reference.documentId}".` });
    }
  }
  if (!course.syllabusReferences.some((reference) => reference.id === course.syllabusTopicsReferenceId)) {
    issues.push({ path: "syllabusTopicsReferenceId", message: "Unknown syllabus reference." });
  }
  for (const unit of course.units) checkUnit(unit, course, issues);

  return { course, issues };
}

export function validateTutorGuide(input: TutorGuideInput, course: Course): { guide: TutorGuide; issues: ValidationIssue[] } {
  const parsed = tutorGuideSchema.safeParse(input);
  if (!parsed.success) {
    return {
      guide: input as TutorGuide,
      issues: parsed.error.issues.map((issue) => ({ path: `tutorGuide.${issue.path.join(".")}`, message: issue.message })),
    };
  }
  const guide = parsed.data;
  const issues: ValidationIssue[] = [];
  const unit = course.units.find((candidate) => candidate.id === guide.unitId);
  if (!unit || unit.assessment.id !== guide.assessmentId) {
    issues.push({ path: "tutorGuide", message: `Unknown unit or assessment "${guide.unitId}/${guide.assessmentId}".` });
    return { guide, issues };
  }
  if (!course.syllabusReferences.some((reference) => reference.id === guide.syllabusNote.syllabusReferenceId)) {
    issues.push({ path: "tutorGuide.syllabusNote", message: "Unknown syllabus reference." });
  }
  for (const question of unit.assessment.questions) {
    const guidance = guide.markingGuidance.filter((entry) => entry.questionId === question.id);
    if (guidance.length !== 1) {
      issues.push({ path: `tutorGuide.${question.id}`, message: `Expected exactly one marking-guidance entry, found ${guidance.length}.` });
      continue;
    }
    if (guidance[0].questionVersion !== question.version) {
      issues.push({ path: `tutorGuide.${question.id}`, message: "Marking guidance version does not match the question version." });
    }
    if (guidance[0].notJudgedForCorrectness !== question.isReflection) {
      issues.push({ path: `tutorGuide.${question.id}`, message: "Only reflection questions are excluded from correctness judgement." });
    }
  }
  for (const entry of guide.markingGuidance) {
    if (!unit.assessment.questions.some((question) => question.id === entry.questionId)) {
      issues.push({ path: `tutorGuide.${entry.questionId}`, message: "Marking guidance refers to an unknown question." });
    }
  }
  return { guide, issues };
}
