import { getServiceStatus } from "@/lib/env/services";

export function DemoBanner() {
  const status = getServiceStatus();
  if (!status.demoMode) return null;
  return (
    <p role="status" className="rounded-lg border border-amber-500/50 bg-amber-50 px-4 py-3 text-sm dark:bg-amber-950/30">
      <span className="font-semibold">Demo mode.</span> Saving is not connected yet, so nothing you do here is stored.
      Lessons, glossary and resources work normally.
    </p>
  );
}
