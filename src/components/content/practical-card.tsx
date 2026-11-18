import type { PracticalActivity } from "@/content/schema.ts";

export function PracticalCard({ practical }: { practical: PracticalActivity }) {
  return (
    <article className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" id={`practical-${practical.id}`}>
      <p>
        <span className="font-semibold">Purpose: </span>
        {practical.learningPurpose}
      </p>
      <div>
        <p className="font-semibold">Materials:</p>
        <ul className="list-disc space-y-1 pl-6">
          {practical.materials.map((material) => (
            <li key={material.item}>
              {material.optional ? `Optional ${material.item.toLowerCase()}` : material.item}
              {material.quantity ? ` (${material.quantity})` : ""}.
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-amber-500/50 bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
        <p className="font-semibold">Safety</p>
        <ul className="list-disc space-y-1 pl-6">
          {practical.safety.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-semibold">Steps</p>
        <ol className="list-decimal space-y-1 pl-6">
          {practical.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    </article>
  );
}
