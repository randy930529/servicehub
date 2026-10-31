/**
 * Timestamps as a chat shows them: the clock for today, the date before that.
 *
 * `now` is a parameter rather than a `Date.now()` call inside: reading the
 * clock during render is impure, and the React Compiler is free to memoize a
 * render — which would freeze "is this today?" at whatever it was the first
 * time the screen mounted.
 */
export function formatChatTime(iso: string | null, now: number): string {
  if (!iso) return "";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const sameDay = new Date(now).toDateString() === date.toDateString();

  return sameDay
    ? date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}
