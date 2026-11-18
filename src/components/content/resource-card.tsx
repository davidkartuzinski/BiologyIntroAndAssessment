import { ExternalLink } from "lucide-react";
import type { Resource } from "@/content/schema.ts";
import { Badge } from "@/components/ui/badge";
import { YouTubeEmbed } from "@/components/content/youtube-embed";

const statusLabel: Record<Resource["status"], string> = {
  required: "Primary resource",
  optional: "Optional",
  "source-only": "Source only",
};

export function ResourceCard({
  resource,
  instructions = [],
  reviewNote,
  showDetails = false,
}: {
  resource: Resource;
  instructions?: string[];
  reviewNote?: string;
  showDetails?: boolean;
}) {
  return (
    <article className="space-y-3 rounded-xl border bg-card p-4 sm:p-5" id={`resource-${resource.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{resource.type === "video" ? "Video" : "Reading"}</Badge>
        <Badge variant="outline">{statusLabel[resource.status]}</Badge>
      </div>
      <h4 className="text-base font-semibold">
        {resource.creator}, “{resource.title}”{resource.platform === "youtube" ? ", YouTube" : ""}
      </h4>
      {resource.platform === "youtube" ? <YouTubeEmbed url={resource.url} title={`${resource.creator}: ${resource.title}`} /> : null}
      {instructions.length > 0 ? (
        <div className="space-y-1">
          <p className="font-medium">{resource.type === "video" ? "What to look for" : "How to use it"}</p>
          <ul className="list-disc space-y-1 pl-6">
            {instructions.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {showDetails ? (
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_1fr]">
          <dt className="font-medium">When to use it</dt>
          <dd>{resource.whenToUse}</dd>
          <dt className="font-medium">Limits</dt>
          <dd>{resource.limits}</dd>
          {resource.accessLimitations ? (
            <>
              <dt className="font-medium">Note</dt>
              <dd>{resource.accessLimitations}</dd>
            </>
          ) : null}
          <dt className="font-medium">Last checked</dt>
          <dd>{resource.dateChecked ?? "No check date recorded"}</dd>
        </dl>
      ) : null}
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4"
      >
        Open on {resource.platform === "youtube" ? "YouTube" : "the Khan Academy website"}
        <ExternalLink className="size-4" aria-hidden />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
      {reviewNote ? <p className="text-sm text-muted-foreground">{reviewNote}</p> : null}
      <p className="text-sm text-muted-foreground">
        If this link stops working, continue with the lesson. No assessment answer depends on it.
      </p>
    </article>
  );
}
