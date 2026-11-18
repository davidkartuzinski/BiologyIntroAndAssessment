import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Citations } from "@/components/content/citations";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { getCourse, unitHref } from "@/lib/content";

export default async function CourseMapPage() {
  await auth.protect();
  const course = getCourse();
  const unit = course.units[0];

  return (
    <PageShell eyebrow={course.qualification} title="Course map">
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <Badge variant="secondary">Available now</Badge>
        <h2 className="text-xl font-semibold">
          <Link href={unitHref(unit.id)} className="underline underline-offset-4">{unit.subtitle}: {unit.title}</Link>
        </h2>
        <p>{unit.sections.length} sections and a separate assessment.</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Syllabus topics</h2>
        <p className="text-muted-foreground">Units for these topics have not been written yet.</p>
        <ol className="divide-y rounded-xl border">
          {course.syllabusTopics.map((topic) => (
            <li key={topic.number} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
              <span>{topic.number}. {topic.title}</span>
              <Badge variant="outline">Not yet available</Badge>
            </li>
          ))}
        </ol>
        <Citations citations={[{ kind: "syllabus", refId: course.syllabusTopicsReferenceId }]} unit={unit} />
      </section>
    </PageShell>
  );
}
