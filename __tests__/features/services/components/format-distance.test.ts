import { describe, expect, test } from "@jest/globals";

import { formatDistance } from "@/features/services/components/service-card";

describe("formatDistance", () => {
  test("uses metres below a kilometre", () => {
    expect(formatDistance(0.4)).toBe("400 m");
    expect(formatDistance(0.085)).toBe("85 m");
  });

  test("uses one decimal between 1 and 10 km", () => {
    expect(formatDistance(2.34)).toBe("2.3 km");
    expect(formatDistance(9.99)).toBe("10.0 km");
  });

  test("drops the decimal past 10 km, which the GPS cannot back up anyway", () => {
    expect(formatDistance(12.4)).toBe("12 km");
    expect(formatDistance(460.7)).toBe("461 km");
  });

  test("switches unit exactly at one kilometre", () => {
    expect(formatDistance(0.999)).toBe("999 m");
    expect(formatDistance(1)).toBe("1.0 km");
  });

  test("reports standing on top of it as 0 m, not an empty string", () => {
    expect(formatDistance(0)).toBe("0 m");
  });
});
