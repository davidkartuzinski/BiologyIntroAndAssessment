import "server-only";

import type { TutorGuideInput } from "../schema.ts";

/**
 * PRIVATE: tutor guide and answer guidance for the introductory assessment.
 *
 * Converted from Part 3 of docs/introductory-biology-package.md.
 * The `server-only` import makes any client-component import of this module a
 * build error. Learner-facing pages and content endpoints must not read it.
 */
export const introductionTutorGuide: TutorGuideInput = {
  unitId: "introduction",
  assessmentId: "introduction-assessment",
  version: 1,
  purpose:
    "This assessment checks the introductory material, not Lauren’s readiness for an A or for the full IGCSE examination.",
  notAssessed: [
    "Recall of all seven formal life-process definitions.",
    "Cell-part identification.",
    "Chemical equations.",
    "Algebra, percentages, or graph plotting.",
    "Details mentioned only in optional resources.",
    "Full explanations of preview topics.",
  ],
  syllabusNote: {
    text: "The syllabus values understanding, application, and practical reasoning; this pilot samples those areas at an introductory level.",
    syllabusReferenceId: "syl-assessment-objectives",
  },
  administration: [
    "Confirm Lauren has studied all five sections.",
    "Give her Part 2 without this guide.",
    "Explain that she can say “I’m not sure.”",
    "Preserve her original responses.",
    "Record assistance without treating it as misconduct.",
    "Discuss feedback after the first attempt is saved.",
    "Use selected retry questions rather than automatically repeating everything.",
  ],
  undefinedTermRule:
    "If she reports an undefined term, record it as a content defect to fix—even if its meaning seems obvious to the tutor.",
  markingGuidance: [
    {
      questionId: "intro-q1",
      questionVersion: 1,
      evidenceOfUnderstanding: "Biology studies living things/how they work or interact; gives relevant human and nonhuman questions.",
      cautions: ["Do not require the phrase “scientific study” if she clearly communicates the idea."],
    },
    {
      questionId: "intro-q2",
      questionVersion: 1,
      evidenceOfUnderstanding: "Both are individual living things. An organism can consist of one cell or many cells.",
    },
    {
      questionId: "intro-q3",
      questionVersion: 1,
      evidenceOfUnderstanding: "Distinguishes arrangement/parts from what something does; heart structure includes muscular walls, and its function includes pumping blood.",
      cautions: ["“The heart pumps blood” states a function, not a description of its structure."],
    },
    {
      questionId: "intro-q4",
      questionVersion: 1,
      evidenceOfUnderstanding: "Movement can occur in nonliving objects; one feature alone is insufficient.",
    },
    {
      questionId: "intro-q5",
      questionVersion: 1,
      evidenceOfUnderstanding: "Respiration involves chemical reactions in cells releasing energy; breathing moves air into and out of lungs.",
      cautions: ["“Respiration is breathing” requires clarification, even if other vocabulary is accurate."],
    },
    {
      questionId: "intro-q6",
      questionVersion: 1,
      evidenceOfUnderstanding: "Gives a sensible connection between two taught topic areas. Detailed mechanisms are not required.",
      cautions: ["Assess the connection, not whether she can explain an untaught mechanism."],
    },
    {
      questionId: "intro-q7",
      questionVersion: 1,
      evidenceOfUnderstanding: "A is observation; B proposes a cause/explanation beyond what was directly seen.",
    },
    {
      questionId: "intro-q8",
      questionVersion: 1,
      evidenceOfUnderstanding: "Changes water amount; measures number of seeds beginning growth; keeps two relevant conditions the same.",
      cautions: ["Accept “what we change” instead of “independent variable.”"],
      acceptableAlternatives: ["“what we change” instead of “independent variable”"],
    },
    {
      questionId: "intro-q9",
      questionVersion: 1,
      evidenceOfUnderstanding: "C; seven compared with three; cannot generalize to every seed type from this limited test.",
      cautions: ["Accept “Group C had four more” only if the requested seven-versus-three comparison is also supplied or clarified."],
    },
    {
      questionId: "intro-q10",
      questionVersion: 1,
      evidenceOfUnderstanding: "Suggests repeating, testing additional water amounts, or another relevant extension, and explains its purpose.",
      cautions: ["“Repeat it” needs a short purpose, such as checking whether similar results occur again."],
    },
    {
      questionId: "intro-q11",
      questionVersion: 1,
      evidenceOfUnderstanding: "Distinguishes a recorded visible feature from a proposed reason or question.",
      cautions: ["Do not assess artistic quality or require identification of an unknown plant."],
    },
    {
      questionId: "intro-q12",
      questionVersion: 1,
      evidenceOfUnderstanding: "No correctness judgement. Use to adjust teaching and select future examples.",
      notJudgedForCorrectness: true,
    },
  ],
  feedbackCategories: [
    { id: "clear", label: "Clear", meaning: "Accurate explanation with the important relationship included." },
    { id: "developing", label: "Developing", meaning: "Partly correct, but a distinction or detail needs clarification." },
    { id: "revisit", label: "Revisit", meaning: "The central idea is missing, confused, or not yet explained." },
    { id: "not-assessed", label: "Not assessed", meaning: "Unanswered, unclear submission, or interrupted attempt." },
  ],
  feedbackCategoryNote: [
    "Record support separately: I, N, or H.",
    "These are local teaching categories, not Cambridge grades. Do not convert them into an estimated A–G grade.",
  ],
  correctionProcedure: {
    intro: "For a developing or revisit response:",
    steps: [
      "Ask Lauren to read the question and identify unclear words.",
      "Ask her to explain the important terms in ordinary language.",
      "Return to the mapped teaching section.",
      "Check whether that section fully and clearly taught the required idea.",
      "Clarify with an example and, where useful, a contrasting example.",
      "Invite a revised answer.",
      "Save both attempts.",
    ],
    example:
      "“You correctly noticed that movement matters. Let us check what ‘enough evidence’ means. The lesson explains that nonliving objects can move too. What else would we need before deciding something is alive?”",
    closing:
      "If vocabulary is clear but the relationship remains difficult, offer a different explanation. Do not infer that a word must be misunderstood solely because an answer is wrong.",
  },
  retryPrompts: {
    intro: "Use only where relevant:",
    prompts: [
      "“Explain how one cell can also be one whole organism.”",
      "“Give a new example of a nonliving object moving.”",
      "“Write one observation about an everyday object, then a possible explanation.”",
      "“Why would changing water and temperature together make the seed test harder to interpret?”",
      "“What does a test of two water amounts leave unknown?”",
    ],
    closing: "These revisit the taught ideas without requiring the original answer to be memorized.",
  },
  usingResults: {
    items: [
      "If organism/cell explanations are clear, proceed to a more detailed introduction to cells.",
      "If observation/explanation distinctions are weak, add another short observation discussion before formal experiment planning.",
      "If Section D is difficult to read, split future investigations into smaller steps.",
      "If she gives strong oral answers but struggles in writing, use oral explanation followed by supported written expression.",
      "If several terms are unclear, revise the relevant lesson’s vocabulary section before increasing difficulty.",
    ],
    closing:
      "Do not hold the whole course until every sentence is perfect. Resolve foundational misunderstandings and carry forward an explicit review list.",
  },
  practicalRegister: {
    rows: [
      { item: "Required equipment", status: "Paper, pencil, familiar plant or suitable viewing location" },
      { item: "Optional equipment", status: "Phone camera" },
      { item: "Chemical purchases", status: "None" },
      { item: "Existing balance", status: "Not needed" },
      { item: "Activity", status: "Observation and comparison only" },
      { item: "Home-lab spending", status: "Defer until specific later investigations are planned" },
    ],
    note: "This original activity teaches observation skills. It is not presented as a reproduction of a particular textbook experiment. The later textbook-practical audit remains to be completed.",
  },
  responseTemplate: {
    intro: "Copy this and attach photographs where convenient:",
    text: `Lauren — Introductory Biology Pilot

Dates studied:
Approximate time by section:
A:
B:
C:
D:
E:

Words needing clarification:
Sections needing a different explanation:
Resources used and whether they helped:

Q1:
Support: I / N / H
Unclear words:

Q2:
Support:
Unclear words:

[Continue through Q12]

Observation activity:
[Attach photograph or written record]

Tutor observations:
- Reading:
- Oral explanation:
- Written explanation:
- Table interpretation:
- Most useful support:
- Any teaching material that seemed incomplete or unclear:

Revised answers:
[Keep separate from original answers]`,
    closing:
      "Return the first answers even if some are incomplete. They will provide the basis for the next unit’s vocabulary, pacing, and explanation depth.",
  },
};
