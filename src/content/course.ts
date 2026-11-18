import type { CourseInput } from "./schema.ts";
import { introductionUnit } from "./units/introduction/unit.ts";

/**
 * Course-level content: source documents, verified syllabus references, and units.
 *
 * Syllabus references were checked against the local copy of the Cambridge
 * IGCSE Biology 0610 syllabus for 2026, 2027 and 2028. Page numbers are the
 * printed page numbers, which match the PDF page numbers in that copy.
 * The PDF itself is never published or linked.
 */
export const courseContent: CourseInput = {
  id: "igcse-biology-0610",
  version: 1,
  title: "Biology",
  qualification: "Cambridge IGCSE Biology 0610 (2026–2028 syllabus)",
  curriculumIncomplete: true,
  sourceDocuments: [
    {
      id: "syllabus-0610-2026",
      title: "Cambridge IGCSE Biology 0610 syllabus for 2026, 2027 and 2028",
      publisher: "Cambridge Assessment International Education",
      publishable: false,
    },
  ],
  syllabusReferences: [
    { id: "syl-assessment-objectives", documentId: "syllabus-0610-2026", section: "2 Syllabus overview: Assessment objectives (AO1, AO2, AO3)", pages: "10–11", verification: "verified-against-source" },
    { id: "syl-content-overview", documentId: "syllabus-0610-2026", section: "2 Syllabus overview: Content overview (topics 1–21)", pages: "8", verification: "verified-against-source" },
    { id: "syl-1-1", documentId: "syllabus-0610-2026", section: "1.1 Characteristics of living organisms", pages: "12", verification: "verified-against-source" },
    { id: "syl-2-1", documentId: "syllabus-0610-2026", section: "2.1 Cell structure", pages: "14", verification: "verified-against-source" },
    { id: "syl-3", documentId: "syllabus-0610-2026", section: "3 Movement into and out of cells", pages: "15–16", verification: "verified-against-source" },
    { id: "syl-6-1", documentId: "syllabus-0610-2026", section: "6.1 Photosynthesis", pages: "17–18", note: "Core 1 describes making carbohydrates using energy from light; Core 8 covers effects of light intensity, carbon dioxide and temperature.", verification: "verified-against-source" },
    { id: "syl-6-2", documentId: "syllabus-0610-2026", section: "6.2 Leaf structure", pages: "18", verification: "verified-against-source" },
    { id: "syl-8", documentId: "syllabus-0610-2026", section: "8 Transport in plants", pages: "22–23", verification: "verified-against-source" },
    { id: "syl-9-2", documentId: "syllabus-0610-2026", section: "9.2 Heart", pages: "24", note: "Core 1 lists the muscular wall; Supplement 10 describes contraction of the atria and ventricles.", verification: "verified-against-source" },
    { id: "syl-11-1", documentId: "syllabus-0610-2026", section: "11.1 Gas exchange in humans (breathing)", pages: "27", verification: "verified-against-source" },
    { id: "syl-12", documentId: "syllabus-0610-2026", section: "12 Respiration (12.1–12.3)", pages: "28", note: "12.1 includes growth among the uses of energy.", verification: "verified-against-source" },
    { id: "syl-14-5", documentId: "syllabus-0610-2026", section: "14.5 Tropic responses (phototropism)", pages: "33", verification: "verified-against-source" },
    { id: "syl-17", documentId: "syllabus-0610-2026", section: "17 Inheritance", pages: "36–39", verification: "verified-against-source" },
    { id: "syl-19", documentId: "syllabus-0610-2026", section: "19 Organisms and their environment", pages: "41–43", verification: "verified-against-source" },
    { id: "syl-20-2", documentId: "syllabus-0610-2026", section: "20.2 Habitat destruction", pages: "44", verification: "verified-against-source" },
    { id: "syl-21", documentId: "syllabus-0610-2026", section: "21 Biotechnology and genetic modification", pages: "46–48", verification: "verified-against-source" },
    { id: "syl-practical", documentId: "syllabus-0610-2026", section: "4 Details of the assessment: Practical assessment", pages: "50–51", note: "Lists germination as an experimental context and requires identifying independent and dependent variables, keeping variables constant, and recording observations.", verification: "verified-against-source" },
    { id: "syl-conventions-variables", documentId: "syllabus-0610-2026", section: "4 Details of the assessment: Conventions, Variables", pages: "57", verification: "verified-against-source" },
    { id: "syl-command-words", documentId: "syllabus-0610-2026", section: "4 Details of the assessment: Command words", pages: "58", verification: "verified-against-source" },
  ],
  syllabusTopicsReferenceId: "syl-content-overview",
  syllabusTopics: [
    { number: 1, title: "Characteristics and classification of living organisms" },
    { number: 2, title: "Organisation of the organism" },
    { number: 3, title: "Movement into and out of cells" },
    { number: 4, title: "Biological molecules" },
    { number: 5, title: "Enzymes" },
    { number: 6, title: "Plant nutrition" },
    { number: 7, title: "Human nutrition" },
    { number: 8, title: "Transport in plants" },
    { number: 9, title: "Transport in animals" },
    { number: 10, title: "Diseases and immunity" },
    { number: 11, title: "Gas exchange in humans" },
    { number: 12, title: "Respiration" },
    { number: 13, title: "Excretion in humans" },
    { number: 14, title: "Coordination and response" },
    { number: 15, title: "Drugs" },
    { number: 16, title: "Reproduction" },
    { number: 17, title: "Inheritance" },
    { number: 18, title: "Variation and selection" },
    { number: 19, title: "Organisms and their environment" },
    { number: 20, title: "Human influences on ecosystems" },
    { number: 21, title: "Biotechnology and genetic modification" },
  ],
  equipment: [
    { id: "balance", name: "Professional-level balance", status: "already-owned", note: "Not needed for the introductory unit." },
  ],
  units: [introductionUnit],
};
