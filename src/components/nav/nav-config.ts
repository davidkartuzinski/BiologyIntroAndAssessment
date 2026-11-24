/**
 * Sidebar structure. Pure data, so the hierarchy, destinations and
 * visibility rules are unit-tested. Visibility mirrors the permission each
 * destination page already enforces; it never grants or removes access.
 */
export type NavRole = "learner" | "reviewer" | null;
export type BadgeKey = "unread-feedback" | "pending-review";

export type NavLink = { kind: "link"; id: string; label: string; href: string; badge?: BadgeKey; placeholder?: boolean };
export type NavLabel = { kind: "label"; id: string; label: string };
export type NavGroup = {
  kind: "group";
  id: string;
  label: string;
  /** Existing page for the group heading, if one exists. */
  href?: string;
  children: NavNode[];
};
export type NavNode = NavLink | NavLabel | NavGroup;

/** Who may open each restricted destination (matches requireRole checks in those pages). */
const REVIEWER_ONLY = new Set(["/study/review", "/study/review/glossary"]);

export function buildNav(role: NavRole): NavNode[] {
  const tree: NavNode[] = [
    {
      kind: "group",
      id: "student",
      label: "Student Dashboard",
      href: "/study",
      children: [
        { kind: "label", id: "courses", label: "Courses" },
        {
          kind: "group",
          id: "biology",
          label: "Biology",
          children: [
            { kind: "link", id: "course-map", label: "Course Map", href: "/study/course" },
            { kind: "link", id: "intro-unit", label: "Introductory Unit", href: "/study/units/introduction" },
            { kind: "link", id: "resources", label: "Resources", href: "/study/resources" },
            { kind: "link", id: "library", label: "Library", href: "/study/library", placeholder: true },
            { kind: "link", id: "progress", label: "Progress", href: "/study/progress", badge: "unread-feedback" },
          ],
        },
        { kind: "link", id: "math", label: "Math", href: "/study/courses/math", placeholder: true },
        { kind: "link", id: "chemistry", label: "Chemistry", href: "/study/courses/chemistry", placeholder: true },
      ],
    },
    {
      kind: "group",
      id: "coach",
      label: "Coach Dashboard",
      children: [{ kind: "link", id: "review-queue", label: "Review Queue", href: "/study/review", badge: "pending-review" }],
    },
    { kind: "link", id: "glossary", label: "Glossary", href: "/study/glossary" },
    { kind: "link", id: "settings", label: "Settings", href: "/study/settings" },
    {
      kind: "group",
      id: "admin",
      label: "Administrator Dashboard",
      children: [{ kind: "link", id: "glossary-editor", label: "Glossary Editor", href: "/study/review/glossary" }],
    },
  ];
  return prune(tree, role);
}

function canSee(href: string, role: NavRole) {
  return !REVIEWER_ONLY.has(href) || role === "reviewer";
}

/** Removes links the role cannot open, then groups left with no links. */
function prune(nodes: NavNode[], role: NavRole): NavNode[] {
  const out: NavNode[] = [];
  for (const node of nodes) {
    if (node.kind === "link") {
      if (canSee(node.href, role)) out.push(node);
    } else if (node.kind === "group") {
      const children = prune(node.children, role);
      if (children.some((child) => child.kind !== "label") || node.href) out.push({ ...node, children });
    } else out.push(node);
  }
  return out;
}

/** Longest-prefix match, so /study/review/glossary activates only the editor, not the queue. */
export function activeHref(pathname: string, nodes: NavNode[]): string | null {
  const hrefs: string[] = [];
  const walk = (list: NavNode[]) => {
    for (const node of list) {
      if (node.kind === "link") hrefs.push(node.href);
      if (node.kind === "group") {
        if (node.href) hrefs.push(node.href);
        walk(node.children);
      }
    }
  };
  walk(nodes);
  const matches = hrefs.filter((href) => pathname === href || (href !== "/study" && pathname.startsWith(`${href}/`)));
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}

/** Ids of groups containing the active destination; these are opened to reveal it. */
export function ancestorGroups(href: string | null, nodes: NavNode[]): string[] {
  if (!href) return [];
  for (const node of nodes) {
    if (node.kind !== "group") continue;
    if (node.href === href) return [];
    const inside = (list: NavNode[]): boolean =>
      list.some((child) => (child.kind === "link" && child.href === href) || (child.kind === "group" && (child.href === href || inside(child.children))));
    if (inside(node.children)) return [node.id, ...ancestorGroups(href, node.children)];
  }
  return [];
}
