import { auth } from "@clerk/nextjs/server";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function NotesPage() {
  await auth.protect();

  return (
    <PlaceholderPage
      title="Notes"
      description="Study notes will be saved with each conversation once the curriculum is ready to add."
    />
  );
}
