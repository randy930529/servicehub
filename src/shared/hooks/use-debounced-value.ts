import { useEffect, useState } from "react";

/** Long enough to skip mid-word keystrokes, short enough to feel immediate. */
export const DEFAULT_DEBOUNCE_MS = 350;

/**
 * Returns `value` only after it has stopped changing for `delayMs`.
 *
 * Typing "limpieza" fires eight renders but one request: the timer restarts on
 * every keystroke and the effect's cleanup cancels the pending one. The value
 * is applied immediately on unmount-free first render, so the initial fetch
 * isn't delayed.
 */
export function useDebouncedValue<T>(
  value: T,
  delayMs: number = DEFAULT_DEBOUNCE_MS,
): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
