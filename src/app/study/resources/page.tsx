import { auth } from "@clerk/nextjs/server";
import { PracticalCard } from "@/components/content/practical-card";
import { ResourceCard } from "@/components/content/resource-card";
import { PageShell } from "@/components/page-shell";
import { getCourse } from "@/lib/content";

export default async function ResourcesPage() {
  await auth.protect();
  const unit = getCourse().units[0];
  const listed = unit.resources.filter((resource) => resource.status !== "source-only");
  return (
    <PageShell title="Resources and practical activities">
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Supporting resources</h2>
        {unit.resourceMenuNote.map((note) => <p key={note}>{note}</p>)}
        {listed.map((resource) => <ResourceCard key={resource.id} resource={resource} showDetails />)}
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Practical activities</h2>
        {unit.practicals.map((practical) => (
          <div key={practical.id} className="space-y-2">
            <h3 className="text-lg font-semibold">{practical.title}</h3>
            <PracticalCard practical={practical} />
          </div>
        ))}
      </section>
    </PageShell>
  );
}
