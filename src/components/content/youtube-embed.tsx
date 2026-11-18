"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

function videoId(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1) || null;
    return parsed.searchParams.get("v");
  } catch {
    return null;
  }
}

/**
 * Click-to-load YouTube player. Nothing loads from YouTube until the learner
 * asks for it, and the player never autoplays. The external link always works
 * as a fallback.
 */
export function YouTubeEmbed({ url, title }: { url: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  const id = videoId(url);

  if (!id) return null;

  if (!loaded) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-lg border bg-muted/50 p-4 text-center">
        <Button type="button" onClick={() => setLoaded(true)}>
          <Play aria-hidden />
          Load the video here
        </Button>
        <p className="max-w-sm text-sm text-muted-foreground">
          The player loads from YouTube only when you choose to. It will not start playing by itself.
        </p>
      </div>
    );
  }

  return (
    <iframe
      className="aspect-video w-full rounded-lg border"
      src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`}
      title={title}
      allow="encrypted-media; picture-in-picture; fullscreen"
      referrerPolicy="strict-origin-when-cross-origin"
      loading="lazy"
    />
  );
}
