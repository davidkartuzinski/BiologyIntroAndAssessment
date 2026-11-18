"use client";

import { useEffect } from "react";
import { markFeedbackSeenAction } from "@/app/study/actions";

/** Records that the learner has seen these reviews once they are on screen. */
export function MarkFeedbackSeen({ reviewIds }: { reviewIds: string[] }) {
  const key = reviewIds.join(",");
  useEffect(() => {
    if (key) void markFeedbackSeenAction(key.split(","));
  }, [key]);
  return null;
}
