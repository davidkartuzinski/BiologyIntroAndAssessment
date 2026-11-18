/**
 * Builds the "Export assessment for course planning" Markdown report.
 * Pure: takes already-authorized data and returns text. Nothing here reads or
 * writes storage, so exporting can never change attempts, reviews, queue
 * state or feedback-read state.
 */
import type { ContentBlock, MarkingGuidance, Question, Unit } from "../../content/schema.ts";
import type { Assistance, ReviewOutcome } from "../attempts/logic.ts";

export type ExportReview = { id: string; reviewerName: string; outcome: ReviewOutcome; comments: string | null; reviewedAt: string };
export type ExportImage = {
  attachmentId: string;
  /** Canonical path shared with the ZIP entry and manifest. */
  path: string;
  status: "included" | "listed" | "missing" | "unsupported";
};
export type ExportAttempt = {
  id: string;
  questionId: string;
  attemptNumber: number;
  submittedAt: string;
  answer: { text: string; parts: Record<string, string> };
  assistance: Assistance | null;
  unclearWords: string;
  reviews: ExportReview[]; // reviews of THIS attempt only
  images: ExportImage[];
};

export type ExportInput = {
  unit: Unit;
  learnerLabel: string;
  attempts: ExportAttempt[];
  exportedAt: Date;
  timeZone: string;
  guidance?: Map<string, MarkingGuidance>; // only when the reviewer opts in
  imagesIncluded: boolean;
};

const OUTCOME: Record<ReviewOutcome, string> = {
  clear: "Clear",
  developing: "Developing",
  revisit: "Revisit",
  not_assessed: "Not assessed",
  reflection_noted: "Reflection noted",
};
const SUPPORT: Record<Assistance, string> = { I: "Independent", N: "Used notes or dictionary", H: "Discussed with someone" };

function when(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(iso));
}

/** Indents learner text as a block quote so Markdown cannot reinterpret it; text itself is unchanged. */
function quoted(text: string) {
  if (!text) return "> (blank)";
  return text.split("\n").map((line) => (line ? `> ${line}` : ">")).join("\n");
}

function blockToMarkdown(block: ContentBlock): string {
  switch (block.type) {
    case "heading":
      return `**${block.text}**`;
    case "paragraph":
    case "note":
      return block.text;
    case "quote":
      return `> ${block.text}`;
    case "list":
      return [block.intro, ...block.items.map((item, index) => (block.ordered ? `${index + 1}. ${item}` : `- ${item}`))].filter(Boolean).join("\n");
    case "table": {
      const row = (cells: string[]) => `| ${cells.map((cell) => cell.replace(/\|/g, "\\|")).join(" | ")} |`;
      return [block.caption, row(block.headers), row(block.headers.map(() => "---")), ...block.rows.map(row)].filter(Boolean).join("\n");
    }
    default:
      return "";
  }
}

function questionText(question: Question) {
  const parts = question.parts.map((part) => `${part.label}. ${part.prompt}`);
  return [...question.prompt.map(blockToMarkdown), ...parts, ...question.promptAfterParts.map(blockToMarkdown)].filter(Boolean).join("\n\n");
}

function answerMarkdown(question: Question, attempt: ExportAttempt) {
  if (question.parts.length === 0) return quoted(attempt.answer.text);
  return question.parts.map((part) => `*${part.label}. ${part.prompt}*\n\n${quoted(attempt.answer.parts[part.id] ?? "")}`).join("\n\n");
}

function imagesMarkdown(attempt: ExportAttempt) {
  if (attempt.images.length === 0) return "- Attachments: none";
  const lines = attempt.images.map((image, index) => {
    const label = `Photo ${index + 1}`;
    switch (image.status) {
      case "included":
        return `  - [${label}](${image.path})`;
      case "listed":
        return `  - ${label}: ${image.path} (not included in this download)`;
      case "missing":
        return `  - **NOT EXPORTED:** ${label} — the stored file could not be found.`;
      case "unsupported":
        return `  - **NOT EXPORTED:** ${label} — the stored file is not a recognisable JPEG, PNG, or WebP image.`;
    }
  });
  return ["- Attachments:", ...lines].join("\n");
}

function reviewMarkdown(review: ExportReview | undefined, timeZone: string) {
  if (!review) return "- Review outcome: Awaiting review";
  return [
    `- Review outcome: ${OUTCOME[review.outcome]}`,
    `- Reviewed by: ${review.reviewerName}, ${when(review.reviewedAt, timeZone)}`,
    `- Reviewer feedback:\n\n${review.comments ? quoted(review.comments) : "> None written"}`,
  ].join("\n");
}

function attemptDetails(question: Question, attempt: ExportAttempt, input: ExportInput) {
  const latestReview = [...attempt.reviews].sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))[0];
  const olderReviews = attempt.reviews.filter((review) => review !== latestReview);
  return [
    `- Submitted: ${when(attempt.submittedAt, input.timeZone)}`,
    `- Support used: ${attempt.assistance ? `${SUPPORT[attempt.assistance]} (${attempt.assistance})` : "Not recorded"}`,
    `- Word or phrase found unclear: ${attempt.unclearWords ? attempt.unclearWords.replace(/\n/g, " / ") : "None recorded"}`,
    imagesMarkdown(attempt),
    "",
    "Answer:",
    "",
    answerMarkdown(question, attempt),
    "",
    reviewMarkdown(latestReview, input.timeZone),
    ...olderReviews.map((review) => `\n- Earlier review of this same attempt:\n${reviewMarkdown(review, input.timeZone)}`),
  ].join("\n");
}

export function buildExportMarkdown(input: ExportInput): string {
  const { unit, timeZone } = input;
  const assessment = unit.assessment;
  const byQuestion = new Map<string, ExportAttempt[]>();
  for (const attempt of input.attempts) {
    byQuestion.set(attempt.questionId, [...(byQuestion.get(attempt.questionId) ?? []), attempt].sort((a, b) => b.attemptNumber - a.attemptNumber));
  }
  const latest = assessment.questions.map((question) => byQuestion.get(question.id)?.[0]);
  const unanswered = latest.filter((attempt) => !attempt).length;
  const awaiting = latest.filter((attempt) => attempt && attempt.reviews.length === 0).length;
  const complete = unanswered === 0 && awaiting === 0;

  const header = [
    `# ${assessment.title} — assessment evidence for course planning`,
    "",
    `- Learner: ${input.learnerLabel}`,
    `- Unit: ${unit.subtitle}: ${unit.title} (content version ${unit.version})`,
    `- Assessment: ${assessment.title} (version ${assessment.version})`,
    `- Exported: ${when(input.exportedAt.toISOString(), timeZone)} (${timeZone})`,
    `- Status: ${complete ? "All questions submitted and reviewed" : "INCOMPLETE — not a final record"}`,
    `- Questions: ${assessment.questions.length} · not answered: ${unanswered} · awaiting review: ${awaiting}`,
    `- Private reviewer guidance included: ${input.guidance ? "yes" : "no"}`,
    `- Images included in this download: ${input.imagesIncluded ? "yes" : "no"}`,
    "",
    "Answers are reproduced exactly as submitted. Review outcomes are the reviewer's recorded judgements; “Reviewed” does not by itself mean mastered.",
  ];

  const context = [
    "## Unit context",
    "",
    "Learning objectives for the unit:",
    "",
    ...unit.learningObjectives.map((objective) => `- ${objective}`),
    "",
    "Sections:",
    "",
    ...unit.sections.map((section) => `- Section ${section.letter} — ${section.title}: ${section.summary}`),
    "",
    "Assessment instructions given to the learner:",
    "",
    ...assessment.introduction.map(blockToMarkdown),
    "",
    `Support labels: ${assessment.supportLabels.map((label) => `${label.code} = ${label.meaning}`).join("; ")}`,
    "",
    `Instruction words: ${assessment.commandWords.items.map((item) => `${item.word}: ${item.meaning}`).join("; ")}`,
  ];

  const questions = assessment.questions.map((question, index) => {
    const attempts = byQuestion.get(question.id) ?? [];
    const [current, ...earlier] = attempts;
    const sections = question.teachingReferences
      .map((reference) => unit.sections.find((section) => section.id === reference.sectionId))
      .filter((section) => section !== undefined)
      .map((section) => `Section ${section.letter} — ${section.title}`);
    const guidance = input.guidance?.get(question.id);
    return [
      `## Question ${question.number}: ${question.title}`,
      "",
      `- Question ID: ${question.id} (version ${question.version})`,
      `- Section/topic: ${[...new Set(sections)].join("; ") || "Not recorded"}`,
      `- Learning objective for this question: Not recorded`,
      question.isReflection ? "- Reflection question: not marked right or wrong" : "",
      "",
      "### Question",
      "",
      questionText(question),
      "",
      current ? `### Latest submitted answer — attempt ${current.attemptNumber}` : "### Latest submitted answer",
      "",
      current ? attemptDetails(question, current, input) : "Not answered",
      ...(earlier.length
        ? ["", `### Earlier attempts — history only (${earlier.length})`, "", ...earlier.flatMap((attempt) => [`#### Attempt ${attempt.attemptNumber}`, "", attemptDetails(question, attempt, input), ""])]
        : []),
      ...(guidance
        ? [
            "",
            "### Private reviewer guidance — not learner-facing course content",
            "",
            guidance.evidenceOfUnderstanding,
            ...guidance.cautions.map((caution) => `- ${caution}`),
          ]
        : []),
      index < assessment.questions.length - 1 ? "\n---" : "",
    ]
      .filter((line) => line !== "")
      .join("\n")
      .replace(/\n(#{2,4} )/g, "\n\n$1");
  });

  return [...header, "", ...context, "", ...questions, ""].join("\n");
}

/** Access rule: only a reviewer, and only for an assigned learner who consented. */
export function canExport(role: string | null, reviewableLearnerIds: string[], learnerId: string) {
  return role === "reviewer" && reviewableLearnerIds.includes(learnerId);
}
