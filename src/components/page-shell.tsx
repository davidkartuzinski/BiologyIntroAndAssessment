import type { ReactNode } from "react";

export function PageShell({ eyebrow, title, intro, children }: { eyebrow?: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 leading-7 sm:px-6">
      <header className="space-y-2">
        {eyebrow ? <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p> : null}
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {intro ? <div className="text-lg text-muted-foreground">{intro}</div> : null}
      </header>
      {children}
    </main>
  );
}
