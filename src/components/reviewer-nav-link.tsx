import { auth, currentUser } from "@clerk/nextjs/server";
import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { parseRole } from "@/lib/auth/roles";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

/** Convenience link only. The review pages enforce the reviewer role themselves. */
export async function ReviewerNavLink() {
  const { userId } = await auth();
  if (!userId) return null;
  if (parseRole((await currentUser())?.publicMetadata) !== "reviewer") return null;
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip="Review queue">
          <Link href="/study/review">
            <ClipboardCheck />
            <span>Review queue</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
