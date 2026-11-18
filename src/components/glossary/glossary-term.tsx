"use client";

import { Popover } from "radix-ui";
import { useRef, useState } from "react";

/**
 * Inline definition trigger. A button (it opens a definition, it does not
 * navigate). Opens on click/tap, Enter/Space, or mouse hover; closes on
 * Escape, outside tap, or the Close button. type="button" so it can never
 * submit a form. Definition text is rendered as plain text, never as HTML.
 */
export function GlossaryTerm({ text, term, definition }: { text: string; term: string; definition: string }) {
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hoverOpen = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setOpen(true);
  };
  const hoverClose = () => {
    if (pinned.current) return;
    hoverTimer.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        // Radix calls this for Escape, outside tap, and the trigger itself.
        if (!next) pinned.current = false;
        else pinned.current = true;
        setOpen(next);
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline cursor-help rounded-sm p-0 align-baseline text-inherit underline decoration-dotted decoration-2 underline-offset-4 [font:inherit] hover:decoration-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label={`${text}: show definition`}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") hoverOpen();
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") hoverClose();
          }}
        >
          {text}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-w-[min(22rem,calc(100vw-2rem))] rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
          onPointerEnter={hoverOpen}
          onPointerLeave={hoverClose}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <p className="font-semibold">{term}</p>
          <p className="mt-1 leading-6">{definition}</p>
          <Popover.Close className="mt-2 rounded-md border px-2 py-1 text-sm" aria-label={`Close definition of ${term}`}>
            Close
          </Popover.Close>
          <Popover.Arrow className="fill-popover" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
