import { auth } from "@clerk/nextjs/server";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function MathPage() {
  await auth.protect();

  return <PlaceholderPage title="Math — Coming soon" description="Math lessons have not been added yet. Biology is available now." />;
}
