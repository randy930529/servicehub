import { z } from "zod";

/**
 * Source of truth for the service form: runtime validation *and* the TS type.
 *
 * These rules mirror the server's Zod schemas (`server/app/lib/validation`).
 * Duplicating them is intentional — the app validates for instant feedback,
 * the API validates because it can never trust a client.
 */

export const SERVICE_CATEGORY_VALUES = [
  "hogar",
  "belleza",
  "tecnologia",
  "bienestar",
  "automotriz",
] as const;

/** Category labels for the picker; the value is what the API stores. */
export const SERVICE_CATEGORY_LABELS: Record<
  (typeof SERVICE_CATEGORY_VALUES)[number],
  string
> = {
  hogar: "Hogar",
  belleza: "Belleza",
  tecnologia: "Tecnología",
  bienestar: "Bienestar",
  automotriz: "Automotriz",
};

/** 1,000,000 MXN — a ceiling that catches a misplaced decimal point. */
const MAX_PRICE_MXN = 1_000_000;

/**
 * The form takes pesos (what the user types); the API stores cents. The
 * conversion lives with the schema so the two never drift apart.
 */
export const ServiceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres")
    .max(80, "Máximo 80 caracteres"),
  description: z
    .string()
    .trim()
    .min(20, "Describe el servicio con al menos 20 caracteres")
    .max(600, "Máximo 600 caracteres"),
  category: z.enum(SERVICE_CATEGORY_VALUES, {
    message: "Elige una categoría",
  }),
  /** Kept as text: a numeric keyboard still hands back a string. */
  price: z
    .string()
    .trim()
    .min(1, "Ingresa un precio")
    .refine((value) => /^\d+([.,]\d{1,2})?$/.test(value), {
      message: "Ingresa un precio válido (ej. 450 o 450.50)",
    })
    .refine((value) => toPesos(value) <= MAX_PRICE_MXN, {
      message: `El precio no puede superar $${MAX_PRICE_MXN.toLocaleString("es-MX")}`,
    }),
});

export type ServiceForm = z.infer<typeof ServiceSchema>;

function toPesos(value: string): number {
  return Number.parseFloat(value.replace(",", "."));
}

/** Pesos as typed → integer cents, the unit the API speaks. */
export function priceToCents(value: string): number {
  return Math.round(toPesos(value) * 100);
}

/** Integer cents → the string the form field shows (no trailing ".00"). */
export function centsToPrice(cents: number): string {
  const pesos = cents / 100;
  return Number.isInteger(pesos) ? String(pesos) : pesos.toFixed(2);
}
