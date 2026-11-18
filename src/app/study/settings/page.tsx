import { ConsentForm } from "@/components/attempts/consent-form";
import { PageShell } from "@/components/page-shell";
import { getViewer } from "@/lib/auth/viewer";
import { StoreError, getConsents } from "@/lib/attempts/store";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const viewer = await getViewer();
  let body: React.ReactNode;
  if (viewer.role !== "learner") {
    body = <p>Sharing and AI settings belong to the learner account.</p>;
  } else if (!isSupabaseConfigured()) {
    body = <p>Demo mode: settings cannot be saved until the database is connected.</p>;
  } else {
    const consents = await getConsents(viewer.userId).catch((error: unknown) =>
      error instanceof StoreError ? error.message : "Settings could not be loaded.",
    );
    body = typeof consents === "string" ? <p role="alert">{consents}</p> : <ConsentForm current={consents} />;
  }
  return (
    <PageShell title="Settings" intro="Choose who can see your work and how it is used. Nothing is shared until you switch it on.">
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Sharing and AI</h2>
        {body}
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Text size</h2>
        <p>Use the text-size buttons at the top of every page. Your choice is remembered on this device.</p>
      </section>
    </PageShell>
  );
}
