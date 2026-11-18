"use client";

import { SignOutButton, UserButton } from "@clerk/nextjs";
import {
  BookOpen,
  BookA,
  House,
  Library,
  LogOut,
  Map,
  PlaySquare,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const navigation = [
  { href: "/study", label: "Dashboard", icon: House },
  { href: "/study/course", label: "Course map", icon: Map },
  { href: "/study/units/introduction", label: "Introductory unit", icon: BookOpen },
  { href: "/study/glossary", label: "Glossary", icon: BookA },
  { href: "/study/resources", label: "Resources", icon: PlaySquare },
  { href: "/study/settings", label: "Settings", icon: Settings },
  { href: "/study/library", label: "Library", icon: Library, later: true },
] as const;

function isCurrent(pathname: string, href: string) {
  if (href === "/study") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavMenu({ pathname }: { pathname: string }) {
  return (
    <SidebarMenu>
      {navigation.map((item) => {
        const Icon = item.icon;
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={isCurrent(pathname, item.href)}
              tooltip={item.label}
            >
              <Link href={item.href}>
                <Icon />
                <span>{item.label}</span>
                {"later" in item ? (
                  <Badge
                    variant="outline"
                    className="ml-auto group-data-[collapsible=icon]:hidden"
                  >
                    Later
                  </Badge>
                ) : null}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function ActiveNavMenu() {
  return <NavMenu pathname={usePathname()} />;
}

export function StudySidebar({ reviewerLink }: { reviewerLink?: React.ReactNode }) {
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
          <SidebarGroupLabel>Study</SidebarGroupLabel>
          <SidebarGroupContent>
            <Suspense fallback={<NavMenu pathname="" />}>
              <ActiveNavMenu />
            </Suspense>
            {reviewerLink}
          </SidebarGroupContent>
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
