import { auth } from "@clerk/nextjs/server";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function ProgressPage() {
  await auth.protect();

  return (
    <PlaceholderPage
      title="Progress"
      description="A simple record of topics and practice can be added here after the course materials exist."
    />
  );
}
