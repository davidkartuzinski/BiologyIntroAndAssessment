import { auth } from "@clerk/nextjs/server";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function LibraryPage() {
  await auth.protect();

  return (
    <PlaceholderPage
      title="Library"
      description="Textbooks and PDFs will live here. The chat route already has a retrieval step ready for those materials."
    />
  );
}
