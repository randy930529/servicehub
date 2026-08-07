import { ServiceCategory } from "@/app/lib/models";

export interface SeedService {
  name: string;
  description: string;
  category: ServiceCategory;
  priceFromCents: number;
  rating: number;
  providerName: string;
  /** GeoJSON point, `[longitude, latitude]` — feeds the distance filter. */
  location: { type: "Point"; coordinates: [number, number] };
}

/**
 * Seed coordinates spread across the Guadalajara metro area so the distance
 * filter has something meaningful to cut: a 5 km radius from the centre keeps
 * the first few and drops Zapopan/Tlaquepaque.
 */
function at(longitude: number, latitude: number) {
  return { type: "Point" as const, coordinates: [longitude, latitude] as [number, number] };
}

/**
 * Seed catalog — mirrors the mobile app's mock data
 * (`src/features/services/domain/use-cases/get-services.ts`) so the real API
 * returns the same services the app already renders.
 */
export const SEED_SERVICES: SeedService[] = [
  {
    name: "Limpieza de hogar",
    description: "Limpieza profunda de tu casa o departamento, por horas.",
    category: "hogar",
    priceFromCents: 45000,
    rating: 4.8,
    providerName: "CleanPro",
    // Centro histórico, Guadalajara.
    location: at(-103.3496, 20.6597),
  },
  {
    name: "Corte y peinado a domicilio",
    description: "Estilista profesional en la comodidad de tu hogar.",
    category: "belleza",
    priceFromCents: 30000,
    rating: 4.6,
    providerName: "Estudio Bella",
    // Colonia Americana (~2 km del centro).
    location: at(-103.3697, 20.6736),
  },
  {
    name: "Reparación de computadoras",
    description: "Diagnóstico y reparación de hardware y software.",
    category: "tecnologia",
    priceFromCents: 60000,
    rating: 4.9,
    providerName: "TecnoFix",
    // Providencia (~4 km).
    location: at(-103.3889, 20.7008),
  },
  {
    name: "Masaje relajante",
    description: "Sesión de 60 minutos para liberar tensión y estrés.",
    category: "bienestar",
    priceFromCents: 55000,
    rating: 4.7,
    providerName: "Zen Spa",
    // Zapopan centro (~9 km).
    location: at(-103.3918, 20.7214),
  },
  {
    name: "Lavado de auto premium",
    description: "Lavado exterior e interior con encerado incluido.",
    category: "automotriz",
    priceFromCents: 25000,
    rating: 4.5,
    providerName: "AutoShine",
    // Tlaquepaque (~8 km).
    location: at(-103.3117, 20.6409),
  },
  {
    name: "Instalación eléctrica",
    description: "Electricista certificado para instalaciones y reparaciones.",
    category: "hogar",
    priceFromCents: 70000,
    rating: 4.4,
    providerName: "ElectroHogar",
    // Chapalita (~5 km).
    location: at(-103.4028, 20.6689),
  },
];
