import { apiClient } from "@/shared/lib/api-client";

import type { Service, ServiceCategory } from "../types";

/** A service as returned by the backend (`GET /api/services`). */
interface ApiService {
  _id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  priceFromCents: number;
  rating: number;
  providerName: string;
}

interface ServicesResponse {
  data: ApiService[];
  meta: unknown;
}

/** Maps the API shape (`_id`, Mongo fields) to the domain `Service` (`id`). */
function toService(api: ApiService): Service {
  return {
    id: api._id,
    name: api.name,
    description: api.description,
    category: api.category,
    priceFromCents: api.priceFromCents,
    rating: api.rating,
    providerName: api.providerName,
  };
}

/**
 * Fetches the service catalog from the backend.
 *
 * Requests a large page size so the screen gets the full catalog for now
 * (pagination params are available server-side for future use). Signature is
 * unchanged (`Promise<Service[]>`), so the query hook and screen are untouched.
 */
export async function getServices(): Promise<Service[]> {
  const { data } = await apiClient.get<ServicesResponse>("/api/services", {
    params: { limit: 100 },
  });
  return data.data.map(toService);
}
