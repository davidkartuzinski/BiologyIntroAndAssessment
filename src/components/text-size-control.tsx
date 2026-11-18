"use client";

import { useEffect, useState } from "react";

const SIZES = [
  { id: "standard", label: "Standard" },
  { id: "large", label: "Large" },
  { id: "larger", label: "Larger" },
] as const;

type TextSize = (typeof SIZES)[number]["id"];
const STORAGE_KEY = "study-text-size";

function readStoredSize(): TextSize {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return SIZES.some((size) => size.id === stored) ? (stored as TextSize) : "standard";
  } catch {
    return "standard";
  }
}

/** Text size preference for this browser. Scales all rem-based text on the page. */
export function TextSizeControl() {
  const [size, setSize] = useState<TextSize>("standard");

  useEffect(() => {
    const stored = readStoredSize();
    document.documentElement.setAttribute("data-text-size", stored);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with a browser-only preference after hydration
    setSize(stored);
  }, []);

  function choose(next: TextSize) {
    setSize(next);
    document.documentElement.setAttribute("data-text-size", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Preference simply will not persist.
    }
  }

  return (
    <fieldset className="flex items-center gap-1">
      <legend className="sr-only">Text size</legend>
      <span aria-hidden className="mr-1 hidden text-sm text-muted-foreground sm:inline">
        Text size
      </span>
      {SIZES.map((option, index) => (
        <label
          key={option.id}
          className="cursor-pointer rounded-md border px-2 py-1 text-sm has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring"
        >
          <input
            type="radio"
            name="text-size"
            value={option.id}
            checked={size === option.id}
            onChange={() => choose(option.id)}
            className="sr-only"
          />
          <span aria-hidden style={{ fontSize: `${0.8 + index * 0.15}rem` }}>
            A
          </span>
          <span className="sr-only">{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
