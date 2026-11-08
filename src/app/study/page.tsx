import { auth } from "@clerk/nextjs/server";
import { TutorChat } from "@/components/tutor-chat";

export default async function StudyPage() {
  await auth.protect();

  return <TutorChat />;
}
