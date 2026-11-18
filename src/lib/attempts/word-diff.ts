/**
 * Display-only word comparison between two submitted answers.
 * Never used to change stored text.
 */
export type DiffSegment = { type: "same" | "added" | "removed"; text: string };

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((token) => token.length > 0);
}

export function wordDiff(previous: string, current: string): DiffSegment[] {
  const a = tokenize(previous);
  const b = tokenize(current);
  // Longest common subsequence table over tokens (answers are capped at 5000 characters).
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const raw: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      raw.push({ type: "same", text: a[i] });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      raw.push({ type: "removed", text: a[i++] });
    } else {
      raw.push({ type: "added", text: b[j++] });
    }
  }
  while (i < a.length) raw.push({ type: "removed", text: a[i++] });
  while (j < b.length) raw.push({ type: "added", text: b[j++] });

  // A lone whitespace "same" between two changes belongs to the change, so
  // "fuse" → "damaged plug" reads as one replacement rather than fragments.
  const tidy = raw.map((segment, index) => {
    if (segment.type === "same" && /^\s+$/.test(segment.text)) {
      const before = raw[index - 1]?.type;
      const after = raw[index + 1]?.type;
      if (before && after && before !== "same" && after !== "same") return { ...segment, type: after };
    }
    return segment;
  });

  // Group all removals before additions inside each changed run, then merge neighbours.
  const ordered: DiffSegment[] = [];
  let run: DiffSegment[] = [];
  const flush = () => {
    ordered.push(...run.filter((s) => s.type === "removed"), ...run.filter((s) => s.type === "added"));
    run = [];
  };
  for (const segment of tidy) {
    if (segment.type === "same") {
      flush();
      ordered.push(segment);
    } else run.push(segment);
  }
  flush();

  const merged: DiffSegment[] = [];
  for (const segment of ordered) {
    const last = merged[merged.length - 1];
    if (last && last.type === segment.type) last.text += segment.text;
    else merged.push({ ...segment });
  }
  // Keep the space between a deletion and its replacement visible.
  return merged.map((segment, index) =>
    segment.type === "removed" && merged[index + 1]?.type === "added" && !/\s$/.test(segment.text) ? { ...segment, text: `${segment.text} ` } : segment,
  );
}

export function hasChanges(segments: DiffSegment[]) {
  return segments.some((segment) => segment.type !== "same");
}
