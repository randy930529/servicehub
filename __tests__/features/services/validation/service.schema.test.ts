import { describe, expect, test } from "@jest/globals";

import {
  ServiceSchema,
  centsToPrice,
  priceToCents,
  type ServiceForm,
} from "@/features/services/validation/service.schema";

const VALID: ServiceForm = {
  name: "Limpieza de hogar",
  description: "Limpieza profunda de casa o departamento, por horas.",
  category: "hogar",
  price: "450",
};

/** Message for a field, or undefined when the field validated fine. */
function errorFor(form: Partial<ServiceForm>, field: keyof ServiceForm) {
  const result = ServiceSchema.safeParse({ ...VALID, ...form });
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("ServiceSchema", () => {
  test("accepts a valid service", () => {
    expect(ServiceSchema.safeParse(VALID).success).toBe(true);
  });

  test("trims whitespace before measuring length", () => {
    const result = ServiceSchema.safeParse({ ...VALID, name: "  Podado  " });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Podado");
  });

  test("requires a name of at least 3 characters", () => {
    expect(errorFor({ name: "ab" }, "name")).toBe("Mínimo 3 caracteres");
    expect(errorFor({ name: "a".repeat(81) }, "name")).toBe(
      "Máximo 80 caracteres",
    );
  });

  test("asks for a description long enough to be useful", () => {
    expect(errorFor({ description: "Limpio casas" }, "description")).toBe(
      "Describe el servicio con al menos 20 caracteres",
    );
  });

  test("rejects an unknown category", () => {
    // Cast: the point is exactly what happens when the value isn't in the enum.
    expect(
      errorFor({ category: "submarinismo" as ServiceForm["category"] }, "category"),
    ).toBeDefined();
  });

  describe("price", () => {
    test("accepts integers and up to two decimals, with comma or dot", () => {
      for (const price of ["450", "450.5", "450.50", "450,50", "0"]) {
        expect(ServiceSchema.safeParse({ ...VALID, price }).success).toBe(true);
      }
    });

    test("rejects anything that isn't a plain amount", () => {
      for (const price of ["", "abc", "-450", "450.505", "$450", "4 5 0"]) {
        expect(errorFor({ price }, "price")).toBeDefined();
      }
    });

    test("rejects an amount past the ceiling that catches typos", () => {
      expect(errorFor({ price: "1000001" }, "price")).toBeDefined();
      expect(ServiceSchema.safeParse({ ...VALID, price: "1000000" }).success).toBe(
        true,
      );
    });
  });
});

describe("price conversion", () => {
  test("turns pesos into integer cents", () => {
    expect(priceToCents("450")).toBe(45000);
    expect(priceToCents("450.5")).toBe(45050);
    expect(priceToCents("450.55")).toBe(45055);
  });

  test("accepts the comma decimal separator used in es-MX", () => {
    expect(priceToCents("450,55")).toBe(45055);
  });

  test("never produces a fractional cent", () => {
    // 0.1 + 0.2 arithmetic: 19.99 * 100 is 1998.9999… in binary floating point.
    expect(Number.isInteger(priceToCents("19.99"))).toBe(true);
    expect(priceToCents("19.99")).toBe(1999);
  });

  test("renders cents back without a pointless .00", () => {
    expect(centsToPrice(45000)).toBe("450");
    expect(centsToPrice(45050)).toBe("450.50");
    expect(centsToPrice(0)).toBe("0");
  });

  test("round-trips a price through the form and back", () => {
    for (const price of ["450", "450.50", "0", "1000000"]) {
      expect(centsToPrice(priceToCents(price))).toBe(
        price === "450.50" ? "450.50" : price,
      );
    }
  });
});
