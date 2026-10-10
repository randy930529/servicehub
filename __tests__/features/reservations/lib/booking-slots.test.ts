import { describe, expect, test } from "@jest/globals";

import {
  BOOKABLE_DAYS,
  buildBookableDays,
  buildDaySlots,
  CLOSING_HOUR,
  formatDayLabel,
  formatSlotLabel,
  isSameDay,
  MIN_NOTICE_MINUTES,
  OPENING_HOUR,
  startOfDay,
} from "@/features/reservations/lib/booking-slots";

/** A fixed "now" so none of this depends on when the suite runs. */
const NOW = new Date(2026, 9, 10, 11, 30); // 10 Oct 2026, 11:30 local

describe("buildBookableDays", () => {
  test("starts today and runs two weeks", () => {
    const days = buildBookableDays(NOW);

    expect(days).toHaveLength(BOOKABLE_DAYS);
    expect(isSameDay(days[0], NOW)).toBe(true);
  });

  test("every day is midnight, so days compare as days", () => {
    for (const day of buildBookableDays(NOW, 3)) {
      expect(day.getHours()).toBe(0);
      expect(day.getMinutes()).toBe(0);
    }
  });

  test("crosses a month boundary without repeating a date", () => {
    // 28 Feb + 3 days must not stall on the 28th.
    const days = buildBookableDays(new Date(2027, 1, 28), 3);

    expect(days.map((d) => d.getDate())).toEqual([28, 1, 2]);
  });
});

describe("buildDaySlots", () => {
  test("offers opening to closing on a future day", () => {
    const tomorrow = startOfDay(new Date(2026, 9, 11));
    const slots = buildDaySlots(tomorrow, NOW);

    expect(slots).toHaveLength(CLOSING_HOUR - OPENING_HOUR);
    expect(slots[0].getHours()).toBe(OPENING_HOUR);
    expect(slots.at(-1)?.getHours()).toBe(CLOSING_HOUR - 1);
  });

  test("drops hours already past today", () => {
    const slots = buildDaySlots(startOfDay(NOW), NOW);

    // 11:30 now + 60 min notice: 09:00..12:00 are gone, 13:00 is the first.
    expect(slots[0].getHours()).toBe(13);
  });

  test("respects the notice window rather than only the clock", () => {
    // 12:10 — the 13:00 slot is in the future but inside the notice window.
    const slots = buildDaySlots(startOfDay(NOW), new Date(2026, 9, 10, 12, 10));

    expect(slots[0].getHours()).toBe(14);
    expect(MIN_NOTICE_MINUTES).toBe(60);
  });

  test("returns nothing once the day is over, instead of yesterday's hours", () => {
    const slots = buildDaySlots(startOfDay(NOW), new Date(2026, 9, 10, 23, 0));

    expect(slots).toEqual([]);
  });
});

describe("labels", () => {
  test("names today and tomorrow instead of dates", () => {
    const days = buildBookableDays(NOW, 3);

    expect(formatDayLabel(days[0], NOW)).toBe("Hoy");
    expect(formatDayLabel(days[1], NOW)).toBe("Mañana");
  });

  test("falls back to weekday and day number further out", () => {
    const days = buildBookableDays(NOW, 3);

    expect(formatDayLabel(days[2], NOW)).toMatch(/\d+$/);
    expect(formatDayLabel(days[2], NOW)).not.toBe("Hoy");
  });

  test("pads the hour to 24h, with no AM/PM to misread", () => {
    expect(formatSlotLabel(new Date(2026, 9, 11, 9, 0))).toBe("09:00");
    expect(formatSlotLabel(new Date(2026, 9, 11, 17, 0))).toBe("17:00");
  });
});
