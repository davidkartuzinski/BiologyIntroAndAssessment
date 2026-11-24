import { auth } from "@clerk/nextjs/server";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function ChemistryPage() {
  await auth.protect();

  return <PlaceholderPage title="Chemistry — Coming soon" description="Chemistry lessons have not been added yet. Biology is available now." />;
}
