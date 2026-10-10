/**
 * Presentation helpers for booking slots.
 *
 * The app no longer *generates* slots — the server publishes real
 * availability (provider hours minus what is already booked), because
 * inventing 09:00–18:00 locally offered hours nobody could actually take.
 * What is left here is grouping and labelling, which is pure and easy to
 * test.
 */

/** Midnight local time for the given day — the identity of a "day" here. */
export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export type SlotGroupType = {
  day: Date;
  slots: Date[];
};

/**
 * Groups a flat list of instants into days, preserving order.
 *
 * Days with nothing free never appear, because the server did not send any of
 * their hours. That is deliberate: an empty day in a picker is noise, and its
 * absence is the honest answer.
 */
export function groupSlotsByDay(slots: Date[]): SlotGroupType[] {
  const groups: SlotGroupType[] = [];

  for (const slot of slots) {
    const last = groups.at(-1);

    if (last && isSameDay(last.day, slot)) {
      last.slots.push(slot);
      continue;
    }

    groups.push({ day: startOfDay(slot), slots: [slot] });
  }

  return groups;
}

/** `lun 14` — short enough for a day chip, unambiguous within two weeks. */
export function formatDayLabel(day: Date, now: Date = new Date()): string {
  if (isSameDay(day, now)) return "Hoy";

  const tomorrow = startOfDay(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameDay(day, tomorrow)) return "Mañana";

  const weekday = day.toLocaleDateString("es-MX", { weekday: "short" });
  return `${weekday} ${day.getDate()}`;
}

/** `09:00`, always two digits, always 24h — no AM/PM ambiguity. */
export function formatSlotLabel(slot: Date): string {
  return `${String(slot.getHours()).padStart(2, "0")}:00`;
}

/** `lunes 14 de octubre, 09:00` — the confirmation step spells it out. */
export function formatSlotFull(slot: Date): string {
  const date = slot.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return `${date}, ${formatSlotLabel(slot)}`;
}
