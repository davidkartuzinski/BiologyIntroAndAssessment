import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { StudySidebar } from "@/components/study-sidebar";
import { TextSizeControl } from "@/components/text-size-control";
import { ReviewerNavLink } from "@/components/reviewer-nav-link";
import { Suspense } from "react";

export default function StudyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <StudySidebar reviewerLink={<Suspense fallback={null}><ReviewerNavLink /></Suspense>} />
      <SidebarInset className="min-h-0 overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <p className="text-sm font-medium">Biology study</p>
          <div className="ml-auto">
            <TextSizeControl />
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
