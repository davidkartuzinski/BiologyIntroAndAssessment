"use client";

import { BookA, ChevronRight, ClipboardCheck, House, Settings, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { activeHref, ancestorGroups, buildNav, type BadgeKey, type NavNode, type NavRole } from "@/components/nav/nav-config";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof House> = { student: House, coach: ClipboardCheck, glossary: BookA, settings: Settings, admin: ShieldCheck };

export type NavCounts = Partial<Record<BadgeKey, number>>;

const badgeText: Record<BadgeKey, (n: number) => string> = {
  "unread-feedback": (n) => `${n} new review${n === 1 ? "" : "s"} to read`,
  "pending-review": (n) => `${n} question${n === 1 ? "" : "s"} awaiting review`,
};

function Icon({ id }: { id: string }) {
  const Glyph = ICONS[id];
  return Glyph ? <Glyph aria-hidden /> : null;
}

function Count({ badge, counts }: { badge?: BadgeKey; counts: NavCounts }) {
  const n = badge ? (counts[badge] ?? 0) : 0;
  if (!badge || n <= 0) return null;
  return (
    <span className="ml-auto rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
      <span aria-hidden>{n}</span>
      <span className="sr-only">{badgeText[badge](n)}</span>
    </span>
  );
}

function Tree({ pathname, role, counts }: { pathname: string | null; role: NavRole; counts: NavCounts }) {
  const nav = buildNav(role);
  const active = pathname ? activeHref(pathname, nav) : null;
  const revealed = new Set(ancestorGroups(active, nav));
  // Collapsed groups are remembered per page; moving to a page inside a
  // collapsed group reopens that group so the active item is visible.
  const [state, setState] = useState<{ path: string | null; closed: Set<string> }>({ path: pathname, closed: new Set() });
  if (state.path !== pathname) {
    const closed = new Set([...state.closed].filter((id) => !revealed.has(id)));
    setState({ path: pathname, closed });
  }
  const isOpen = (id: string) => !state.closed.has(id);
  const toggle = (id: string) =>
    setState((current) => {
      const closed = new Set(current.closed);
      if (closed.has(id)) closed.delete(id);
      else closed.add(id);
      return { ...current, closed };
    });

  const renderChildren = (nodes: NavNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      if (node.kind === "label") {
        return (
          <li key={node.id} className="px-2 pt-2 pb-1 text-xs font-semibold tracking-wide text-sidebar-foreground/70 uppercase" aria-hidden={false}>
            {node.label}
          </li>
        );
      }
      if (node.kind === "link") {
        return (
          <SidebarMenuSubItem key={node.id}>
            <SidebarMenuSubButton asChild isActive={active === node.href}>
              <Link href={node.href} aria-current={active === node.href ? "page" : undefined}>
                <span>{node.label}</span>
                {node.placeholder && node.id !== "library" ? <span className="ml-auto text-xs text-sidebar-foreground/70">Coming soon</span> : null}
                {node.id === "library" ? <span className="ml-auto text-xs text-sidebar-foreground/70">Later</span> : null}
                <Count badge={node.badge} counts={counts} />
              </Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        );
      }
      const open = isOpen(node.id);
      const listId = `nav-${node.id}`;
      return (
        <SidebarMenuSubItem key={node.id}>
          <SidebarMenuSubButton asChild>
            <button type="button" aria-expanded={open} aria-controls={listId} onClick={() => toggle(node.id)} className="w-full">
              <ChevronRight className={cn("transition-transform", open && "rotate-90")} aria-hidden />
              <span>{node.label}</span>
            </button>
          </SidebarMenuSubButton>
          {open ? (
            <SidebarMenuSub id={listId} className={cn(depth > 0 && "mr-0")}>
              {renderChildren(node.children, depth + 1)}
            </SidebarMenuSub>
          ) : null}
        </SidebarMenuSubItem>
      );
    });

  return (
    <SidebarMenu>
      {nav.map((node) => {
        if (node.kind === "link") {
          return (
            <SidebarMenuItem key={node.id}>
              <SidebarMenuButton asChild isActive={active === node.href} tooltip={node.label}>
                <Link href={node.href} aria-current={active === node.href ? "page" : undefined}>
                  <Icon id={node.id} />
                  <span>{node.label}</span>
                  <Count badge={node.badge} counts={counts} />
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        }
        if (node.kind === "label") return null;
        const open = isOpen(node.id);
        const listId = `nav-${node.id}`;
        return (
          <SidebarMenuItem key={node.id}>
            {node.href ? (
              <>
                {/* Heading with its own page: the link navigates, the chevron expands. */}
                <SidebarMenuButton asChild isActive={active === node.href} tooltip={node.label}>
                  <Link href={node.href} aria-current={active === node.href ? "page" : undefined}>
                    <Icon id={node.id} />
                    <span className="font-semibold">{node.label}</span>
                  </Link>
                </SidebarMenuButton>
                <SidebarMenuAction
                  aria-expanded={open}
                  aria-controls={listId}
                  aria-label={`${open ? "Collapse" : "Expand"} ${node.label}`}
                  onClick={() => toggle(node.id)}
                >
                  <ChevronRight className={cn("transition-transform", open && "rotate-90")} aria-hidden />
                </SidebarMenuAction>
              </>
            ) : (
              <SidebarMenuButton aria-expanded={open} aria-controls={listId} onClick={() => toggle(node.id)} tooltip={node.label}>
                <Icon id={node.id} />
                <span className="font-semibold">{node.label}</span>
                <ChevronRight className={cn("ml-auto transition-transform", open && "rotate-90")} aria-hidden />
              </SidebarMenuButton>
            )}
            {open ? <SidebarMenuSub id={listId}>{renderChildren(node.children, 0)}</SidebarMenuSub> : null}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function ActiveTree(props: { role: NavRole; counts: NavCounts }) {
  return <Tree pathname={usePathname()} {...props} />;
}

/** Sidebar hierarchy. The path-aware version streams in behind Suspense. */
export function StudyNav({ role, counts }: { role: NavRole; counts: NavCounts }) {
  return (
    <Suspense fallback={<Tree pathname={null} role={role} counts={counts} />}>
      <ActiveTree role={role} counts={counts} />
    </Suspense>
  );
}
