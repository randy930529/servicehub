import { describe, expect, test } from "@jest/globals";

import { resolveNotificationRoute } from "@/features/notifications/lib/notification-route";

describe("resolveNotificationRoute", () => {
  test("returns known in-app routes", () => {
    expect(resolveNotificationRoute({ url: "/my-services" })).toBe(
      "/my-services",
    );
    expect(resolveNotificationRoute({ url: "/notifications" })).toBe(
      "/notifications",
    );
  });

  test("keeps the query string of a route that needs one", () => {
    expect(resolveNotificationRoute({ url: "/service-form?id=svc-1" })).toBe(
      "/service-form?id=svc-1",
    );
  });

  test("accepts a nested path under a known route", () => {
    expect(resolveNotificationRoute({ url: "/services/svc-1" })).toBe(
      "/services/svc-1",
    );
  });

  test("refuses to leave the app", () => {
    // A push payload comes from outside and is tapped when nobody is looking:
    // navigating to whatever string arrived would be a redirect primitive.
    for (const url of [
      "https://evil.example",
      "http://evil.example/my-services",
      "//evil.example",
      "servicehub://my-services",
    ]) {
      expect(resolveNotificationRoute({ url })).toBeNull();
    }
  });

  test("refuses routes the app doesn't have", () => {
    expect(resolveNotificationRoute({ url: "/admin" })).toBeNull();
    expect(resolveNotificationRoute({ url: "/" })).toBeNull();
  });

  test("does not let a query string smuggle a different route in", () => {
    expect(
      resolveNotificationRoute({ url: "/admin?next=/my-services" }),
    ).toBeNull();
  });

  test("does not accept a route that merely starts like an allowed one", () => {
    expect(resolveNotificationRoute({ url: "/my-services-admin" })).toBeNull();
  });

  test("returns null when there is nothing to open", () => {
    expect(resolveNotificationRoute(undefined)).toBeNull();
    expect(resolveNotificationRoute(null)).toBeNull();
    expect(resolveNotificationRoute({})).toBeNull();
    expect(resolveNotificationRoute({ url: 42 })).toBeNull();
    expect(resolveNotificationRoute("/my-services")).toBeNull();
  });

  test("trims surrounding whitespace before deciding", () => {
    expect(resolveNotificationRoute({ url: "  /my-services  " })).toBe(
      "/my-services",
    );
  });
});
