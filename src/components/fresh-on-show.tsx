"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

/**
 * Pages that show review results are kept alive between navigations (React
 * Activity), and reviews are saved from another person's session, so nothing
 * tells this browser that its copy is out of date. This re-fetches the page's
 * server data whenever it becomes visible again or the tab regains focus,
 * and offers a manual check.
 */
export function FreshOnShow({ label = "Check for new reviews" }: { label?: string }) {
  const router = useRouter();
  const firstShow = useRef(true);
  const [pending, startTransition] = useTransition();
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  useEffect(() => {
    // Runs on first mount and again each time Activity reveals this page.
    if (firstShow.current) firstShow.current = false;
    else router.refresh();

    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(() => {
            router.refresh();
            setCheckedAt(new Date().toLocaleTimeString());
          })
        }
      >
        {pending ? "Checking…" : label}
      </Button>
      {checkedAt ? <span className="text-sm text-muted-foreground" role="status">Checked at {checkedAt}</span> : null}
    </div>
  );
}
