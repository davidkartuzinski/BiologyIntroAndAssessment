# Content import report: introductory unit

Source: "Lauren’s introductory biology learning package" (kept privately in the gitignored `docs/` folder).

## What was imported

- Learner content: `src/content/units/introduction/unit.ts` (Sections A–E, vocabulary, resources, observation activity, recap, 12 assessment questions in original order).
- Private tutor guide: `src/content/private/introduction-tutor-guide.ts` (`server-only`; never imported by learner pages).
- Teaching sentences were kept as written. `npm test` validates IDs, teaching references, teach-before-assess, and private-guidance separation.

## Syllabus references

The temporary Perplexity upload links were replaced earlier with a generic "Source: syllabus" note. Each one is now a structured reference to the syllabus section and printed page. All were checked against the local syllabus PDF (`src/content/course.ts`). For example, the characteristics of living organisms are §1.1 (p. 12), command words are on p. 58, and practical skills and variables are on pp. 50–51 and 57.

## Flags for review (not changed)

1. A line in the package's Markdown is formatted as a heading ("## The curriculum basis is …"). It was imported as an ordinary paragraph.
2. The resource called "The scientific method" uses the URL path `the-science-of-biology`. The page title has not been rechecked.
3. A Khan Academy "experiments-and-observations" page is cited in Section D but is missing from the resource menu. It was imported as source-only, with its title taken from the URL.
4. None of the resources has a date-checked value, and no video durations were supplied. Both are left blank.
5. The observation activity has no setup or observation time, so that field is blank. Its review status is "needs-review".
6. Inline definitions (dry mass, millilitre, independent, dependent and controlled variables) appear inside the running text, not in the opening word block. They do still come before their first use.
7. All content is marked `needs-review` until a human has approved it.
