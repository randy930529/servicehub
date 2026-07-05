/**
 * Services domain models.
 */

export type ServiceCategory =
  | "hogar"
  | "belleza"
  | "tecnologia"
  | "bienestar"
  | "automotriz";

export interface Service {
  id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  /** Starting price in MXN cents (integer, avoids float rounding issues). */
  priceFromCents: number;
  /** Average rating, 0–5. */
  rating: number;
  providerName: string;
}
