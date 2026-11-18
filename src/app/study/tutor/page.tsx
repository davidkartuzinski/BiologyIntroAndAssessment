import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { AI_FEATURES_ENABLED } from "@/lib/ai/feature";
import { TutorChat } from "@/components/tutor-chat";

export default async function TutorPage() {
  await auth.protect();
  if (!AI_FEATURES_ENABLED) notFound();

  return <TutorChat />;
}
