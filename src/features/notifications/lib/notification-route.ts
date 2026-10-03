/**
 * Where a notification is allowed to take the user.
 *
 * A push payload is attacker-influenceable in a way most app input isn't: it
 * arrives from outside, and by the time it's tapped nobody is looking. So the
 * target is checked against a list of routes this app actually has, instead of
 * navigating to whatever string came down the wire.
 */
const ALLOWED_ROUTES = [
  "/my-services",
  "/service-form",
  "/edit-profile",
  "/notifications",
  "/services",
  "/explore",
] as const;

/**
 * Extracts a safe in-app path from a notification's `data`, or `null` when
 * there is nothing to open.
 *
 * Rejects anything that isn't a relative path — `https://…`, `//evil.example`,
 * `servicehub://…` — so a notification can never bounce the user out of the app
 * or deep-link into a route that doesn't exist.
 */
export function resolveNotificationRoute(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;

  const { url } = data as { url?: unknown };
  if (typeof url !== "string") return null;

  const path = url.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path.includes("://")) return null;

  // Compare against the path only: query strings are allowed (`/service-form?id=1`)
  // but must not be able to smuggle a different route in.
  const [pathname] = path.split("?");
  const allowed = ALLOWED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  return allowed ? path : null;
}
