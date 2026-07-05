import type { Service } from "../types";

/** Simulated network latency until the real catalog API exists. */
const MOCK_NETWORK_DELAY_MS = 600;

const MOCK_SERVICES: Service[] = [
  {
    id: "svc-1",
    name: "Limpieza de hogar",
    description: "Limpieza profunda de tu casa o departamento, por horas.",
    category: "hogar",
    priceFromCents: 45000,
    rating: 4.8,
    providerName: "CleanPro",
  },
  {
    id: "svc-2",
    name: "Corte y peinado a domicilio",
    description: "Estilista profesional en la comodidad de tu hogar.",
    category: "belleza",
    priceFromCents: 30000,
    rating: 4.6,
    providerName: "Estudio Bella",
  },
  {
    id: "svc-3",
    name: "Reparación de computadoras",
    description: "Diagnóstico y reparación de hardware y software.",
    category: "tecnologia",
    priceFromCents: 60000,
    rating: 4.9,
    providerName: "TecnoFix",
  },
  {
    id: "svc-4",
    name: "Masaje relajante",
    description: "Sesión de 60 minutos para liberar tensión y estrés.",
    category: "bienestar",
    priceFromCents: 55000,
    rating: 4.7,
    providerName: "Zen Spa",
  },
  {
    id: "svc-5",
    name: "Lavado de auto premium",
    description: "Lavado exterior e interior con encerado incluido.",
    category: "automotriz",
    priceFromCents: 25000,
    rating: 4.5,
    providerName: "AutoShine",
  },
  {
    id: "svc-6",
    name: "Instalación eléctrica",
    description: "Electricista certificado para instalaciones y reparaciones.",
    category: "hogar",
    priceFromCents: 70000,
    rating: 4.4,
    providerName: "ElectroHogar",
  },
];

/**
 * Returns the service catalog.
 *
 * NOTE: mocked for now — waits and returns in-memory data. When the real API
 * lands, only this function changes; the query hook and screen stay the same.
 */
export async function getServices(): Promise<Service[]> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_NETWORK_DELAY_MS));
  return MOCK_SERVICES;
}
