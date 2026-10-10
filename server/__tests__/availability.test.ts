import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAvailability,
  buildSlotKey,
  DEFAULT_WORKING_HOURS,
  MARKET_UTC_OFFSET_HOURS,
  MIN_NOTICE_MINUTES,
} from "@/app/lib/helpers";

/** Monday 12 Oct 2026, 08:00 market time (UTC-6) → 14:00 UTC. */
const MONDAY_8AM = new Date("2026-10-12T14:00:00.000Z");

/** The UTC instant of a market-local hour on that Monday. */
function monday(hour: number): Date {
  return new Date(
    Date.UTC(2026, 9, 12, hour - MARKET_UTC_OFFSET_HOURS, 0, 0, 0),
  );
}

function slots(overrides: Partial<Parameters<typeof buildAvailability>[0]> = {}) {
  return buildAvailability({
    workingHours: DEFAULT_WORKING_HOURS,
    taken: [],
    now: MONDAY_8AM,
    days: 1,
    ...overrides,
  });
}

describe("buildAvailability", () => {
  it("offers the provider's hours in market local time", () => {
    const result = slots();

    // 09:00..17:00 market time, once the 1h notice clears 08:00 → 09:00 is in.
    assert.equal(result.length, 9);
    assert.equal(result[0].toISOString(), monday(9).toISOString());
    assert.equal(result.at(-1)?.toISOString(), monday(17).toISOString());
  });

  it("respects the notice window rather than only the clock", () => {
    // 09:10 market time: the 10:00 slot is in the future but inside notice.
    const result = slots({
      now: new Date(monday(9).getTime() + 10 * 60 * 1000),
    });

    assert.equal(result[0].toISOString(), monday(11).toISOString());
    assert.equal(MIN_NOTICE_MINUTES, 60);
  });

  it("drops an hour that is already booked", () => {
    const result = slots({ taken: [monday(11)] });

    assert.equal(result.length, 8);
    assert.ok(!result.some((s) => s.getTime() === monday(11).getTime()));
  });

  it("matches a booked slot by instant, not by object identity", () => {
    // Same moment, a different Date object — a naive `includes` would miss it.
    const result = slots({ taken: [new Date(monday(11).toISOString())] });

    assert.ok(!result.some((s) => s.getTime() === monday(11).getTime()));
  });

  it("skips days the provider does not work", () => {
    // Sunday only: the Monday horizon yields nothing.
    const result = slots({
      workingHours: { ...DEFAULT_WORKING_HOURS, weekdays: [0] },
    });

    assert.deepEqual(result, []);
  });

  it("omits a fully booked day instead of showing it empty", () => {
    const wholeDay = Array.from({ length: 9 }, (_, i) => monday(9 + i));
    const result = slots({ taken: wholeDay });

    assert.deepEqual(result, []);
  });

  it("treats endHour as exclusive", () => {
    const result = slots({
      workingHours: { ...DEFAULT_WORKING_HOURS, startHour: 9, endHour: 10 },
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].toISOString(), monday(9).toISOString());
  });

  it("spans several days, soonest first", () => {
    const result = slots({ days: 3 });

    // Mon + Tue + Wed, all working days, 9 slots each.
    assert.equal(result.length, 27);
    for (let i = 1; i < result.length; i += 1) {
      assert.ok(
        result[i].getTime() > result[i - 1].getTime(),
        "slots must be ordered",
      );
    }
  });

  it("returns nothing when the provider works zero days", () => {
    const result = slots({
      workingHours: { ...DEFAULT_WORKING_HOURS, weekdays: [] },
    });

    assert.deepEqual(result, []);
  });
});

describe("buildSlotKey", () => {
  it("is stable for the same service and instant", () => {
    const a = buildSlotKey("svc1", monday(9));
    const b = buildSlotKey("svc1", new Date(monday(9).toISOString()));

    assert.equal(a, b);
  });

  it("differs by service and by hour", () => {
    assert.notEqual(buildSlotKey("svc1", monday(9)), buildSlotKey("svc2", monday(9)));
    assert.notEqual(buildSlotKey("svc1", monday(9)), buildSlotKey("svc1", monday(10)));
  });
});
