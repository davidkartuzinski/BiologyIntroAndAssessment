/**
 * Typed, validated schema for authored course content.
 *
 * Learner-visible content and private tutor guidance use separate schemas and
 * live in separate modules. Private guidance is only importable on the server
 * (see src/content/private).
 *
 * Imports in src/content use relative paths with .ts extensions so the
 * validation tests can run with plain `node --test`.
 */
import { z } from "zod";

const id = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "IDs use lowercase words joined by hyphens");

export const reviewStatusSchema = z.enum([
  "draft",
  "needs-review",
  "human-reviewed",
]);

export const classificationSchema = z.enum([
  "foundation",
  "core",
  "supplement",
  "enrichment",
]);

/** A verified pointer into an authored source document (never a URL or local path). */
export const syllabusReferenceSchema = z.object({
  id,
  documentId: id,
  /** Syllabus section, e.g. "1.1 Characteristics of living organisms". */
  section: z.string().min(1),
  /** Printed page number(s) in the source document, e.g. "12" or "50–51". */
  pages: z.string().min(1),
  note: z.string().optional(),
  verification: z.enum(["verified-against-source", "unverified"]),
});

export const sourceDocumentSchema = z.object({
  id,
  title: z.string().min(1),
  publisher: z.string().min(1),
  /** Source PDFs stay private. This flag must remain false. */
  publishable: z.literal(false),
});

export const vocabularyTermSchema = z.object({
  id,
  term: z.string().min(1),
  definition: z.string().min(1),
  /** Other spellings or plural forms to recognise when linking text. */
  aliases: z.array(z.string().min(1)).default([]),
  /** Section ID where the term is first defined, or "resource-menu". */
  introducedIn: id,
  /** Set false for ordinary words that should not be auto-linked in lesson text. */
  linkInText: z.boolean().default(true),
  /** True when the lesson defines the term within running text rather than a definitions block. */
  definedInline: z.boolean().default(false),
});

export const conceptSchema = z.object({
  id,
  label: z.string().min(1),
  description: z.string().min(1),
});

export const citationSchema = z.object({
  /** A Resource ID or a SyllabusReference ID. */
  refId: id,
  kind: z.enum(["resource", "syllabus"]),
});

const blockBase = {
  id,
  citations: z.array(citationSchema).default([]),
};

export const contentBlockSchema = z.discriminatedUnion("type", [
  z.object({ ...blockBase, type: z.literal("heading"), text: z.string().min(1) }),
  z.object({ ...blockBase, type: z.literal("paragraph"), text: z.string().min(1) }),
  z.object({
    ...blockBase,
    type: z.literal("list"),
    ordered: z.boolean().default(false),
    intro: z.string().optional(),
    items: z.array(z.string().min(1)).min(1),
  }),
  z.object({ ...blockBase, type: z.literal("quote"), text: z.string().min(1) }),
  z.object({
    ...blockBase,
    type: z.literal("table"),
    caption: z.string().optional(),
    headers: z.array(z.string()).min(1),
    rows: z.array(z.array(z.string())).min(1),
    /** Column indexes whose cells are numeric and should align right. */
    numericColumns: z.array(z.number().int().nonnegative()).default([]),
  }),
  z.object({
    ...blockBase,
    type: z.literal("definitions"),
    title: z.string().min(1),
    termIds: z.array(id).min(1),
  }),
  z.object({
    ...blockBase,
    type: z.literal("note"),
    tone: z.enum(["info", "caution"]).default("info"),
    text: z.string().min(1),
  }),
  z.object({
    ...blockBase,
    type: z.literal("resource"),
    resourceId: id,
    instructions: z.array(z.string().min(1)).default([]),
    reviewNote: z.string().optional(),
  }),
  z.object({
    ...blockBase,
    type: z.literal("practical"),
    practicalId: id,
  }),
]);

export const lessonSectionSchema = z.object({
  id,
  letter: z.string().regex(/^[A-Z]$/),
  title: z.string().min(1),
  summary: z.string().min(1),
  termsBeforeUse: z.array(id).default([]),
  taughtConceptIds: z.array(id).min(1),
  contentBlocks: z.array(contentBlockSchema).min(1),
  reflectionPrompts: z
    .object({ intro: z.string().optional(), prompts: z.array(z.string().min(1)).min(1) })
    .optional(),
  resourceIds: z.array(id).default([]),
  syllabusReferenceIds: z.array(id).default([]),
  estimatedMinutes: z.number().int().positive().optional(),
});

export const resourceSchema = z.object({
  id,
  title: z.string().min(1),
  creator: z.string().min(1),
  url: z.url().refine((value) => value.startsWith("https://"), "Resource URLs must use https"),
  type: z.enum(["video", "article"]),
  platform: z.enum(["youtube", "web"]),
  learningPurpose: z.string().min(1),
  whenToUse: z.string().min(1),
  limits: z.string().min(1),
  relatedSectionIds: z.array(id).min(1),
  relatedConceptIds: z.array(id).default([]),
  status: z.enum(["required", "optional", "source-only"]),
  vocabularyCaveats: z.array(z.string().min(1)).default([]),
  reviewBasis: z.string().min(1),
  reviewStatus: reviewStatusSchema,
  /** ISO date the link was last checked, or null when no check date was supplied. */
  dateChecked: z.iso.date().nullable(),
  accessLimitations: z.string().optional(),
});

export const practicalActivitySchema = z.object({
  id,
  title: z.string().min(1),
  learningPurpose: z.string().min(1),
  relatedSectionIds: z.array(id).min(1),
  syllabusReferenceIds: z.array(id).default([]),
  materials: z.array(z.object({ item: z.string().min(1), quantity: z.string().optional(), optional: z.boolean().default(false) })).min(1),
  setupAndObservationTime: z.string().nullable(),
  safety: z.array(z.string().min(1)).min(1),
  supervision: z.string().min(1),
  storageAndDisposal: z.string().min(1),
  saferAlternative: z.string().optional(),
  steps: z.array(z.string().min(1)).min(1),
  involvesChemicalsOrHazards: z.boolean(),
  reviewStatus: reviewStatusSchema,
});

export const equipmentItemSchema = z.object({
  id,
  name: z.string().min(1),
  status: z.enum(["already-owned", "needed", "ordered", "available", "not-required"]),
  note: z.string().optional(),
});

export const questionSchema = z.object({
  id,
  number: z.number().int().positive(),
  version: z.number().int().positive(),
  title: z.string().min(1),
  type: z.enum(["short-written", "multi-part", "photo-upload", "reflection"]),
  prompt: z.array(contentBlockSchema).min(1),
  /** Parts the learner answers separately, when the question has them. */
  parts: z.array(z.object({ id, label: z.string().min(1), prompt: z.string().min(1) })).default([]),
  /** Instructions shown after the parts, such as permitted wording. */
  promptAfterParts: z.array(contentBlockSchema).default([]),
  assessedConceptIds: z.array(id),
  teachingReferences: z.array(z.object({ sectionId: id, blockId: id.optional() })).min(1),
  isReflection: z.boolean(),
  isReservedMock: z.boolean().default(false),
});

export const assessmentSchema = z.object({
  id,
  version: z.number().int().positive(),
  title: z.string().min(1),
  introduction: z.array(contentBlockSchema).min(1),
  supportLabels: z.array(z.object({ code: z.enum(["I", "N", "H"]), meaning: z.string().min(1) })).length(3),
  commandWords: z.object({ items: z.array(z.object({ word: z.string(), meaning: z.string() })).min(1), syllabusReferenceId: id }),
  questions: z.array(questionSchema).min(1),
  closingNote: z.string().min(1),
});

export const unitSchema = z.object({
  id,
  version: z.number().int().positive(),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  overview: z.array(contentBlockSchema).min(1),
  classification: classificationSchema,
  learningObjectives: z.array(z.string().min(1)).min(1),
  studySequence: z.object({
    note: z.string().min(1),
    sessions: z.array(z.object({ session: z.number().int().positive(), study: z.string().min(1) })).min(1),
    closing: z.string().min(1),
  }),
  syllabusReferenceIds: z.array(id).default([]),
  prerequisiteConceptIds: z.array(id).default([]),
  prerequisiteSkillIds: z.array(id).default([]),
  concepts: z.array(conceptSchema).min(1),
  vocabulary: z.array(vocabularyTermSchema).min(1),
  sections: z.array(lessonSectionSchema).min(1),
  recap: z.object({ intro: z.string().min(1), points: z.array(z.string().min(1)).min(1) }),
  resources: z.array(resourceSchema),
  resourceMenuNote: z.array(z.string().min(1)),
  practicals: z.array(practicalActivitySchema),
  assessment: assessmentSchema,
  estimatedMinutes: z.number().int().positive().nullable(),
  reviewStatus: reviewStatusSchema,
  contentSource: z.string().min(1),
});

export const courseSchema = z.object({
  id,
  version: z.number().int().positive(),
  title: z.string().min(1),
  qualification: z.string().min(1),
  sourceDocuments: z.array(sourceDocumentSchema).min(1),
  syllabusReferences: z.array(syllabusReferenceSchema),
  /** Syllabus topic list. Topics without a published unit show as not yet available. */
  syllabusTopics: z.array(z.object({ number: z.number().int().positive(), title: z.string().min(1) })),
  syllabusTopicsReferenceId: id,
  equipment: z.array(equipmentItemSchema),
  units: z.array(unitSchema).min(1),
  /** True while only part of the course has been authored. */
  curriculumIncomplete: z.boolean(),
});

// Private tutor guidance -------------------------------------------------------

export const markingGuidanceSchema = z.object({
  questionId: id,
  questionVersion: z.number().int().positive(),
  evidenceOfUnderstanding: z.string().min(1),
  cautions: z.array(z.string().min(1)).default([]),
  acceptableAlternatives: z.array(z.string().min(1)).default([]),
  requiredTerminology: z.array(z.string().min(1)).default([]),
  commonMisunderstandings: z.array(z.string().min(1)).default([]),
  hintStages: z.array(z.string().min(1)).default([]),
  notJudgedForCorrectness: z.boolean().default(false),
});

export const tutorGuideSchema = z.object({
  unitId: id,
  assessmentId: id,
  version: z.number().int().positive(),
  purpose: z.string().min(1),
  notAssessed: z.array(z.string().min(1)).min(1),
  syllabusNote: z.object({ text: z.string().min(1), syllabusReferenceId: id }),
  administration: z.array(z.string().min(1)).min(1),
  undefinedTermRule: z.string().min(1),
  markingGuidance: z.array(markingGuidanceSchema).min(1),
  feedbackCategories: z.array(z.object({ id: z.enum(["clear", "developing", "revisit", "not-assessed"]), label: z.string(), meaning: z.string() })).length(4),
  feedbackCategoryNote: z.array(z.string().min(1)),
  correctionProcedure: z.object({ intro: z.string(), steps: z.array(z.string().min(1)).min(1), example: z.string(), closing: z.string() }),
  retryPrompts: z.object({ intro: z.string(), prompts: z.array(z.string().min(1)).min(1), closing: z.string() }),
  usingResults: z.object({ items: z.array(z.string().min(1)).min(1), closing: z.string() }),
  practicalRegister: z.object({ rows: z.array(z.object({ item: z.string(), status: z.string() })).min(1), note: z.string() }),
  responseTemplate: z.object({ intro: z.string(), text: z.string().min(1), closing: z.string() }),
});

export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type SyllabusReference = z.infer<typeof syllabusReferenceSchema>;
export type SourceDocument = z.infer<typeof sourceDocumentSchema>;
export type VocabularyTerm = z.infer<typeof vocabularyTermSchema>;
export type Concept = z.infer<typeof conceptSchema>;
export type Citation = z.infer<typeof citationSchema>;
export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type LessonSection = z.infer<typeof lessonSectionSchema>;
export type Resource = z.infer<typeof resourceSchema>;
export type PracticalActivity = z.infer<typeof practicalActivitySchema>;
export type EquipmentItem = z.infer<typeof equipmentItemSchema>;
export type Question = z.infer<typeof questionSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type Course = z.infer<typeof courseSchema>;
export type MarkingGuidance = z.infer<typeof markingGuidanceSchema>;
export type TutorGuide = z.infer<typeof tutorGuideSchema>;

/** Input types: authored files may omit fields that have defaults. */
export type CourseInput = z.input<typeof courseSchema>;
export type UnitInput = z.input<typeof unitSchema>;
export type TutorGuideInput = z.input<typeof tutorGuideSchema>;
