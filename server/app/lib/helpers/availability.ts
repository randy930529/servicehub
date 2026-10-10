/**
 * Which slots a service actually has free.
 *
 * Pure: hours in, instants out. No Mongo, no Request. Availability is the kind
 * of arithmetic that is quietly wrong for weeks — an hour that should not be
 * offered, a slot that survives its own booking — so it is worth testing
 * without a database in the room.
 */

/**
 * The market this product serves is Guadalajara, and Mexico abolished DST in
 * 2022, so a single fixed offset is correct rather than merely convenient.
 *
 * ponytail: one market, one offset. A provider in another timezone needs a
 * per-user IANA zone and a real date library; this constant is the seam where
 * that would go.
 */
export const MARKET_UTC_OFFSET_HOURS = -6;

/** Slots are whole hours. Half-hour bookings would need a duration first. */
export const SLOT_MINUTES = 60;

/** Minimum notice before a slot, so a provider is never ambushed. */
export const MIN_NOTICE_MINUTES = 60;

/** How far ahead availability is published. */
export const DEFAULT_AVAILABILITY_DAYS = 14;
export const MAX_AVAILABILITY_DAYS = 60;

export type WorkingHoursType = {
  /** First bookable hour, market local time, inclusive. */
  startHour: number;
  /** Last bookable hour, exclusive — 18 means the 17:00 slot is the last. */
  endHour: number;
  /** Days worked, 0 = Sunday, matching `Date.getUTCDay()`. */
  weekdays: number[];
};

/** Mon–Sat, 9 to 18. What a provider gets until they say otherwise. */
export const DEFAULT_WORKING_HOURS: WorkingHoursType = {
  startHour: 9,
  endHour: 18,
  weekdays: [1, 2, 3, 4, 5, 6],
};

/**
 * The UTC instant of a given market-local hour on a given UTC day.
 *
 * Written out rather than mutated through a local `Date` because the server
 * runs in whatever timezone the container happens to have, and `setHours`
 * would silently use that one.
 */
function marketHourToUtc(day: Date, hour: number): Date {
  return new Date(
    Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      hour - MARKET_UTC_OFFSET_HOURS,
      0,
      0,
      0,
    ),
  );
}

/** Market-local calendar day containing an instant, as a UTC midnight. */
function marketDayOf(instant: Date): Date {
  const shifted = new Date(
    instant.getTime() + MARKET_UTC_OFFSET_HOURS * 60 * 60 * 1000,
  );
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ),
  );
}

export type AvailabilityInputType = {
  workingHours: WorkingHoursType;
  /** Instants already booked for this service. Cancelled ones must not be here. */
  taken: Date[];
  now: Date;
  days: number;
};

/**
 * Free slots for the next `days` market days, soonest first.
 *
 * Three filters, in order of how often they matter: the provider does not work
 * then, the slot is too soon, or somebody already took it. A day with nothing
 * free simply does not appear — an empty day in a picker is noise, and the
 * absence is the honest answer.
 */
export function buildAvailability({
  workingHours,
  taken,
  now,
  days,
}: AvailabilityInputType): Date[] {
  const { startHour, endHour, weekdays } = workingHours;

  // A set of epoch numbers, not of Date objects: two Dates for the same
  // instant are different objects and would never match.
  const takenAt = new Set(taken.map((slot) => slot.getTime()));
  const earliest = now.getTime() + MIN_NOTICE_MINUTES * 60 * 1000;

  const firstDay = marketDayOf(now);
  const slots: Date[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(firstDay);
    day.setUTCDate(firstDay.getUTCDate() + offset);

    if (!weekdays.includes(day.getUTCDay())) continue;

    for (let hour = startHour; hour < endHour; hour += 1) {
      const slot = marketHourToUtc(day, hour);

      if (slot.getTime() < earliest) continue;
      if (takenAt.has(slot.getTime())) continue;

      slots.push(slot);
    }
  }

  return slots;
}

/**
 * Stable identity of "this service at this instant".
 *
 * Stored on the reservation so a unique index can enforce one active booking
 * per slot. A compound index on `{ service, scheduledFor }` would say the same
 * thing, but it could not be made to ignore cancelled rows with a partial
 * filter Mongo reliably supports — a single field that simply disappears when
 * the booking is cancelled can.
 */
export function buildSlotKey(serviceId: string, scheduledFor: Date): string {
  return `${serviceId}:${scheduledFor.toISOString()}`;
}
