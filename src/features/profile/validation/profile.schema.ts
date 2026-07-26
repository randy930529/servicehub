import { z } from "zod";

/**
 * Source of truth for the profile form: runtime validation *and* the TS type.
 *
 * These rules mirror the server's Zod schemas (`server/app/lib/validation`).
 * Duplicating them is intentional — the app validates for instant feedback,
 * the API validates because it can never trust a client.
 */

/** Phone formats vary too much per country to parse; only shape is checked. */
const PHONE_PATTERN = /^[+]?[\d\s()-]{7,20}$/;

export const ProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(60, "Máximo 60 caracteres"),
  bio: z.string().trim().max(280, "Máximo 280 caracteres"),
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || PHONE_PATTERN.test(value), {
      message: "Ingresa un teléfono válido",
    }),
});

export type ProfileForm = z.infer<typeof ProfileSchema>;
