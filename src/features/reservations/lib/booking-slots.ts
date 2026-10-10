/**
 * Which slots a customer may pick.
 *
 * Pure date maths, no React and no API: this is the part that is easy to get
 * subtly wrong (an off-by-one hour, a slot offered in the past) and cheap to
 * test exhaustively.
 *
 * Real availability — the provider's calendar, already-taken slots — lands in
 * part 2. Until then every provider is assumed to work the same hours, which
 * is a placeholder, not a business rule.
 */

/** First and last bookable hour, local time, inclusive of the first. */
export const OPENING_HOUR = 9;
export const CLOSING_HOUR = 18;

/** How many days ahead the picker offers. */
export const BOOKABLE_DAYS = 14;

/**
 * Minimum notice before a slot. Offering "in 5 minutes" is how you get a
 * provider who never sees the booking until it is already late.
 */
export const MIN_NOTICE_MINUTES = 60;

/** Midnight local time for the given day — the identity of a "day" here. */
export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/**
 * The days the picker offers, starting today.
 *
 * Today is included even when it has no slots left; the day strip then shows
 * it as empty rather than silently shifting what "the first day" means.
 */
export function buildBookableDays(
  now: Date = new Date(),
  count: number = BOOKABLE_DAYS,
): Date[] {
  const first = startOfDay(now);

  return Array.from({ length: count }, (_, offset) => {
    const day = new Date(first);
    day.setDate(first.getDate() + offset);
    return day;
  });
}

/**
 * Bookable instants within one day.
 *
 * Slots already past — or too soon to give the provider notice — are dropped
 * rather than disabled: an hour that cannot be chosen is noise in a grid this
 * small, and the API would reject it anyway.
 */
export function buildDaySlots(day: Date, now: Date = new Date()): Date[] {
  const earliest = new Date(now.getTime() + MIN_NOTICE_MINUTES * 60 * 1000);
  const slots: Date[] = [];

  for (let hour = OPENING_HOUR; hour < CLOSING_HOUR; hour += 1) {
    const slot = startOfDay(day);
    slot.setHours(hour, 0, 0, 0);

    if (slot.getTime() >= earliest.getTime()) slots.push(slot);
  }

  return slots;
}

/** `lun 14` — short enough for a day chip, unambiguous within two weeks. */
export function formatDayLabel(day: Date, now: Date = new Date()): string {
  if (isSameDay(day, now)) return "Hoy";

  const tomorrow = new Date(startOfDay(now));
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameDay(day, tomorrow)) return "Mañana";

  const weekday = day.toLocaleDateString("es-MX", { weekday: "short" });
  return `${weekday} ${day.getDate()}`;
}

/** `09:00`, always two digits, always 24h — no AM/PM ambiguity. */
export function formatSlotLabel(slot: Date): string {
  return `${String(slot.getHours()).padStart(2, "0")}:00`;
}

/** `lun 14 de octubre, 09:00` — the confirmation step spells it out in full. */
export function formatSlotFull(slot: Date): string {
  const date = slot.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return `${date}, ${formatSlotLabel(slot)}`;
}
