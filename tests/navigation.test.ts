import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { activeHref, ancestorGroups, buildNav, type NavNode } from "../src/components/nav/nav-config.ts";

const outline = (nodes: NavNode[], depth = 0): string[] =>
  nodes.flatMap((node) => [
    `${"  ".repeat(depth)}${node.kind === "label" ? node.label.toUpperCase() : node.label}`,
    ...(node.kind === "group" ? outline(node.children, depth + 1) : []),
  ]);

const links = (nodes: NavNode[]): string[] =>
  nodes.flatMap((node) => (node.kind === "link" ? [node.href] : node.kind === "group" ? [...(node.href ? [node.href] : []), ...links(node.children)] : []));

test("nav: reviewer sees the full requested hierarchy", () => {
  assert.deepEqual(outline(buildNav("reviewer")), [
    "Student Dashboard",
    "  COURSES",
    "  Biology",
    "    Course Map",
    "    Introductory Unit",
    "    Resources",
    "    Library",
    "    Progress",
    "  Math",
    "  Chemistry",
    "Coach Dashboard",
    "  Review Queue",
    "Glossary",
    "Settings",
    "Administrator Dashboard",
    "  Glossary Editor",
  ]);
});

test("nav: learner and no-role users see no coach or administrator groups (unchanged permissions)", () => {
  for (const role of ["learner", null] as const) {
    const top = buildNav(role).map((node) => node.label);
    assert.deepEqual(top, ["Student Dashboard", "Glossary", "Settings"]);
    assert.ok(!links(buildNav(role)).includes("/study/review"));
    assert.ok(!links(buildNav(role)).includes("/study/review/glossary"));
  }
});

test("nav: the glossary editor stays available to the existing reviewer, with one reading Glossary link", () => {
  const all = links(buildNav("reviewer"));
  assert.ok(all.includes("/study/review/glossary"));
  assert.equal(all.filter((href) => href === "/study/glossary").length, 1);
});

test("nav: every destination is an existing page (existing URLs kept)", () => {
  const toFile = (href: string) => `src/app${href}/page.tsx`;
  for (const href of links(buildNav("reviewer"))) assert.ok(existsSync(toFile(href)) || existsSync(`src/app/study/units/[unitId]/page.tsx`), href);
  for (const href of ["/study", "/study/course", "/study/resources", "/study/library", "/study/progress", "/study/glossary", "/study/settings", "/study/review", "/study/review/glossary", "/study/courses/math", "/study/courses/chemistry"]) {
    assert.ok(existsSync(toFile(href)), `${href} page exists`);
  }
});

test("nav: Math and Chemistry placeholders say Coming soon", () => {
  assert.match(readFileSync("src/app/study/courses/math/page.tsx", "utf8"), /Math — Coming soon/);
  assert.match(readFileSync("src/app/study/courses/chemistry/page.tsx", "utf8"), /Chemistry — Coming soon/);
});

test("nav: active page uses the most specific match and opens its ancestor groups", () => {
  const nav = buildNav("reviewer");
  assert.equal(activeHref("/study/units/introduction/section-b", nav), "/study/units/introduction");
  assert.deepEqual(ancestorGroups("/study/units/introduction", nav), ["student", "biology"]);
  assert.equal(activeHref("/study/review/glossary", nav), "/study/review/glossary");
  assert.deepEqual(ancestorGroups("/study/review/glossary", nav), ["admin"]);
  assert.equal(activeHref("/study/review/1234", nav), "/study/review");
  assert.deepEqual(ancestorGroups("/study/review", nav), ["coach"]);
  assert.equal(activeHref("/study", nav), "/study");
  assert.deepEqual(ancestorGroups("/study", nav), []);
  assert.equal(activeHref("/study/courses/math", nav), "/study/courses/math");
  assert.deepEqual(ancestorGroups("/study/glossary", nav), []);
});

test("nav: badges stay on Progress and Review Queue", () => {
  const find = (nodes: NavNode[], id: string): NavNode | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.kind === "group") {
        const hit = find(node.children, id);
        if (hit) return hit;
      }
    }
  };
  const nav = buildNav("reviewer");
  assert.equal((find(nav, "progress") as { badge?: string }).badge, "unread-feedback");
  assert.equal((find(nav, "review-queue") as { badge?: string }).badge, "pending-review");
});

test("nav: controls are accessible buttons/links, the old flat menu is gone", () => {
  const source = readFileSync("src/components/nav/study-nav.tsx", "utf8");
  assert.match(source, /aria-expanded=\{open\}/);
  assert.match(source, /aria-controls=\{listId\}/);
  assert.match(source, /aria-label=\{`\$\{open \? "Collapse" : "Expand"\} \$\{node.label\}`\}/);
  assert.match(source, /type="button"/);
  assert.match(source, /aria-current/);
  const sidebar = readFileSync("src/components/study-sidebar.tsx", "utf8");
  assert.doesNotMatch(sidebar, /const navigation = \[/);
  assert.equal(existsSync("src/components/role-nav-links.tsx"), false);
});
