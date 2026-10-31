import { describe, expect, test } from "@jest/globals";

import { formatChatTime } from "@/features/chat/lib/format-chat-time";

/**
 * `now` is injected, which is the point: the function never reads the clock,
 * so "is this today?" cannot be frozen by a memoized render.
 */
const NOW = new Date("2026-10-31T18:00:00.000Z").getTime();

describe("formatChatTime", () => {
  test("shows the clock for a message from today", () => {
    const formatted = formatChatTime("2026-10-31T15:30:00.000Z", NOW);

    // Locale and timezone decide the exact text; what matters is that it is
    // a time, not a date.
    expect(formatted).toMatch(/\d{1,2}:\d{2}/);
  });

  test("shows a date for an older message", () => {
    const formatted = formatChatTime("2026-10-20T15:30:00.000Z", NOW);

    expect(formatted).not.toMatch(/:/);
    expect(formatted).toMatch(/20/);
  });

  test("renders nothing for a missing timestamp", () => {
    expect(formatChatTime(null, NOW)).toBe("");
  });

  test("renders nothing for an unparseable timestamp", () => {
    // A bad value must not put "Invalid Date" in a chat bubble.
    expect(formatChatTime("ayer", NOW)).toBe("");
  });
});
