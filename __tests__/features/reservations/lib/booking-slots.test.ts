import { describe, expect, test } from "@jest/globals";

import {
  formatDayLabel,
  formatSlotLabel,
  groupSlotsByDay,
  isSameDay,
  startOfDay,
} from "@/features/reservations/lib/booking-slots";

/** A fixed "now" so none of this depends on when the suite runs. */
const NOW = new Date(2026, 9, 12, 8, 0); // Mon 12 Oct 2026, 08:00 local

function at(day: number, hour: number): Date {
  return new Date(2026, 9, day, hour, 0, 0, 0);
}

describe("groupSlotsByDay", () => {
  test("groups consecutive slots of the same day", () => {
    const groups = groupSlotsByDay([at(12, 9), at(12, 10), at(12, 11)]);

    expect(groups).toHaveLength(1);
    expect(groups[0].slots).toHaveLength(3);
    expect(isSameDay(groups[0].day, at(12, 0))).toBe(true);
  });

  test("starts a new group when the day changes", () => {
    const groups = groupSlotsByDay([at(12, 17), at(13, 9)]);

    expect(groups).toHaveLength(2);
    expect(groups[0].slots).toHaveLength(1);
    expect(groups[1].slots).toHaveLength(1);
  });

  test("keeps the server's order instead of re-sorting", () => {
    // The API already returns slots soonest-first; re-sorting here would be a
    // second source of truth about ordering.
    const groups = groupSlotsByDay([at(12, 9), at(13, 9), at(14, 9)]);

    expect(groups.map((g) => g.day.getDate())).toEqual([12, 13, 14]);
  });

  test("returns nothing for an empty availability", () => {
    // A service with no free hours produces no day chips at all, which is the
    // honest answer — an empty day in the strip would be noise.
    expect(groupSlotsByDay([])).toEqual([]);
  });

  test("groups a day that has a single slot left", () => {
    const groups = groupSlotsByDay([at(12, 16)]);

    expect(groups).toHaveLength(1);
    expect(groups[0].slots).toEqual([at(12, 16)]);
  });

  test("normalizes the group day to midnight", () => {
    const groups = groupSlotsByDay([at(12, 15)]);

    expect(groups[0].day.getHours()).toBe(0);
    expect(groups[0].day).toEqual(startOfDay(at(12, 15)));
  });
});

describe("labels", () => {
  test("names today and tomorrow instead of dates", () => {
    expect(formatDayLabel(at(12, 0), NOW)).toBe("Hoy");
    expect(formatDayLabel(at(13, 0), NOW)).toBe("Mañana");
  });

  test("falls back to weekday and day number further out", () => {
    const label = formatDayLabel(at(15, 0), NOW);

    expect(label).not.toBe("Hoy");
    expect(label).toMatch(/15$/);
  });

  test("pads the hour to 24h, with no AM/PM to misread", () => {
    expect(formatSlotLabel(at(12, 9))).toBe("09:00");
    expect(formatSlotLabel(at(12, 17))).toBe("17:00");
  });
});
