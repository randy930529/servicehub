import { ServiceCategory } from "@/app/lib/models/service";

export interface SeedService {
  name: string;
  description: string;
  category: ServiceCategory;
  priceFromCents: number;
  rating: number;
  providerName: string;
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
  },
  {
    name: "Corte y peinado a domicilio",
    description: "Estilista profesional en la comodidad de tu hogar.",
    category: "belleza",
    priceFromCents: 30000,
    rating: 4.6,
    providerName: "Estudio Bella",
  },
  {
    name: "Reparación de computadoras",
    description: "Diagnóstico y reparación de hardware y software.",
    category: "tecnologia",
    priceFromCents: 60000,
    rating: 4.9,
    providerName: "TecnoFix",
  },
  {
    name: "Masaje relajante",
    description: "Sesión de 60 minutos para liberar tensión y estrés.",
    category: "bienestar",
    priceFromCents: 55000,
    rating: 4.7,
    providerName: "Zen Spa",
  },
  {
    name: "Lavado de auto premium",
    description: "Lavado exterior e interior con encerado incluido.",
    category: "automotriz",
    priceFromCents: 25000,
    rating: 4.5,
    providerName: "AutoShine",
  },
  {
    name: "Instalación eléctrica",
    description: "Electricista certificado para instalaciones y reparaciones.",
    category: "hogar",
    priceFromCents: 70000,
    rating: 4.4,
    providerName: "ElectroHogar",
  },
];
