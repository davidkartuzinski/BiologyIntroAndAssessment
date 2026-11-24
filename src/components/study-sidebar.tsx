"use client";

import { SignOutButton, UserButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

export function StudySidebar({ nav }: { nav: React.ReactNode }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-4">
        <p className="truncate text-sm font-semibold">Biology study</p>
        <p className="truncate text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          Private desk
        </p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>{nav}</SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-2 p-3">
        <div className="flex items-center gap-3 px-1">
          <UserButton />
          <span className="truncate text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
            Your account
          </span>
        </div>
        <SignOutButton redirectUrl="/">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground group-data-[collapsible=icon]:justify-center"
            aria-label="Log out"
          >
            <LogOut />
            <span className="group-data-[collapsible=icon]:sr-only">Log out</span>
          </Button>
        </SignOutButton>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
